import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  EmptyState,
  ErrorState,
  Icone,
  InfoBanner,
  LoadingState,
  ScreenContainer,
  SelectField,
  StatusPill,
  type StatutPill,
} from '../../../src/components/ui';
import {
  STATUTS_OEUVRE,
  type Categorie,
  type Oeuvre,
  type StatutOeuvre,
} from '../../../src/models';
import type { ErreurApp } from '../../../src/services/contracts';
import { mockMemberRepository, mockPublicContentService } from '../../../src/services/mocks';

/**
 * Écran Q — Œuvres du membre (onglet 2/5).
 *
 * Règles appliquées :
 * - données exclusivement issues de `mockMemberRepository.listerOeuvres()` (le
 *   filtre par statut est appliqué CÔTÉ SERVICE, jamais dans l'UI) et libellés de
 *   catégories issus de `mockPublicContentService.listerCategories()` ;
 * - 4 états obligatoires : chargement / erreur + « Réessayer » / vide / contenu ;
 * - une seule pastille verte est autorisée : `DEPOT_FINALISE` (effet serveur
 *   après un paiement `REUSSI`) — `VALIDEE` reste en `info`, jamais en vert,
 *   puisque les frais de dépôt ne sont pas encore réglés ;
 * - aucun statut n'est inventé : les libellés dérivent de l'ENUM `STATUTS_OEUVRE`
 *   (source unique de vérité du schéma).
 */

type EtatEcran = 'chargement' | 'erreur' | 'vide' | 'contenu';

/** Valeur du filtre « toutes les œuvres » : aucun statut transmis au service. */
const FILTRE_TOUS = 'TOUS';

/** Libellés et pastilles des statuts d'œuvre (cahier des charges §6). */
const STATUTS_AFFICHES: Record<StatutOeuvre, { variante: StatutPill; libelle: string }> = {
  BROUILLON: { variante: 'pending', libelle: 'Brouillon' },
  ENVOYEE: { variante: 'pending', libelle: 'Envoyée à l’OMDA' },
  EN_COURS_DE_VALIDATION: { variante: 'pending', libelle: 'En cours de validation' },
  VALIDEE: { variante: 'info', libelle: 'Validée — frais de dépôt à régler' },
  REJETEE: { variante: 'error', libelle: 'Rejetée' },
  DEPOT_FINALISE: { variante: 'success', libelle: 'Dépôt finalisé' },
};

/** Message compréhensible selon la famille d'erreur (`Result`). */
function traduireErreur(erreur: ErreurApp): string {
  if (erreur.type === 'metier') return erreur.message;
  if (erreur.type === 'reseau') {
    return 'Impossible de joindre le serveur OMDA. Vérifiez votre connexion Internet puis réessayez.';
  }
  return 'Vos œuvres sont momentanément indisponibles. Veuillez réessayer dans quelques instants.';
}

/** Date ISO affichée en `JJ/MM/AAAA` (formatage manuel, sans `Intl`). */
function formaterDateCourte(dateIso: string | null): string {
  if (!dateIso) return '';
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return '';
  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  return `${jour}/${mois}/${date.getFullYear()}`;
}

type PropsCarteOeuvre = {
  oeuvre: Oeuvre;
  libelleCategorie: string;
  onOuvrir: () => void;
};

/** Carte d'une œuvre : titre, catégorie, année, statut et motif de rejet éventuel. */
function CarteOeuvre({ oeuvre, libelleCategorie, onOuvrir }: PropsCarteOeuvre) {
  const statut = STATUTS_AFFICHES[oeuvre.statut];
  const dateSoumission = formaterDateCourte(oeuvre.date_soumission);

  return (
    <View className="w-full rounded-2xl border border-omda-borderGray bg-omda-white p-5">
      <Text className="text-lg font-bold text-omda-black">{oeuvre.titre}</Text>

      <View className="mt-2 flex-row items-center">
        <Icone nom="tag" taille={14} classeCouleur="text-omda-textGray" />
        <Text className="ml-2 flex-1 text-base text-omda-textGray">
          {oeuvre.annee ? `${libelleCategorie} — ${oeuvre.annee}` : libelleCategorie}
        </Text>
      </View>

      <View className="mt-3">
        <StatusPill statut={statut.variante} libelle={statut.libelle} />
      </View>

      {dateSoumission ? (
        <Text className="mt-3 text-sm text-omda-textGray">{`Envoyée le ${dateSoumission}`}</Text>
      ) : null}

      {oeuvre.statut === 'REJETEE' && oeuvre.motif_rejet ? (
        <Text className="mt-3 text-sm text-status-error">
          {`Motif du rejet : ${oeuvre.motif_rejet}`}
        </Text>
      ) : null}

      <View className="mt-4">
        <Button
          libelle="Ouvrir la fiche"
          variante="secondary"
          icone="file-lines"
          pleineLargeur
          onPress={onOuvrir}
        />
      </View>
    </View>
  );
}

export default function OeuvresScreen() {
  const [etat, setEtat] = useState<EtatEcran>('chargement');
  const [messageErreur, setMessageErreur] = useState('');
  const [oeuvres, setOeuvres] = useState<Oeuvre[]>([]);
  const [categories, setCategories] = useState<Categorie[]>([]);
  const [filtre, setFiltre] = useState<string>(FILTRE_TOUS);

  const statutFiltre: StatutOeuvre | null =
    filtre === FILTRE_TOUS ? null : (filtre as StatutOeuvre);

  /** Charge les œuvres (filtre transmis au service) et le référentiel des catégories. */
  const chargerOeuvres = useCallback(async (statut: StatutOeuvre | null) => {
    setEtat('chargement');
    setMessageErreur('');

    try {
      const [reponseOeuvres, reponseCategories] = await Promise.all([
        mockMemberRepository.listerOeuvres(statut ? { statut } : undefined),
        mockPublicContentService.listerCategories(),
      ]);

      if (!reponseOeuvres.ok) {
        setOeuvres([]);
        setMessageErreur(traduireErreur(reponseOeuvres.erreur));
        setEtat('erreur');
        return;
      }

      if (!reponseCategories.ok) {
        setOeuvres([]);
        setMessageErreur(traduireErreur(reponseCategories.erreur));
        setEtat('erreur');
        return;
      }

      setOeuvres(reponseOeuvres.valeur);
      setCategories(reponseCategories.valeur);
      setEtat(reponseOeuvres.valeur.length === 0 ? 'vide' : 'contenu');
    } catch {
      setOeuvres([]);
      setMessageErreur(
        'Une erreur inattendue est survenue pendant le chargement de vos œuvres. Veuillez réessayer.',
      );
      setEtat('erreur');
    }
  }, []);

  /** Recharge à chaque retour sur l'onglet (un statut évolue côté serveur). */
  useFocusEffect(
    useCallback(() => {
      void chargerOeuvres(statutFiltre);
    }, [chargerOeuvres, statutFiltre]),
  );

  /** Libellés de catégories (repli explicite si le référentiel ne la contient plus). */
  const libellesCategories = useMemo(() => {
    const table = new Map<string, string>();
    categories.forEach((categorie) => table.set(categorie.id, categorie.libelle));
    return table;
  }, [categories]);

  const optionsFiltre = useMemo(
    () => [
      { valeur: FILTRE_TOUS, libelle: 'Toutes mes œuvres' },
      ...STATUTS_OEUVRE.map((statut) => ({
        valeur: statut,
        libelle: STATUTS_AFFICHES[statut].libelle,
      })),
    ],
    [],
  );

  const ouvrirDepot = useCallback(() => {
    router.push('/(membre)/depot-oeuvre');
  }, []);

  const ouvrirFiche = useCallback((oeuvre: Oeuvre) => {
    router.push({ pathname: '/(membre)/fiche-oeuvre', params: { oeuvre_id: oeuvre.id } });
  }, []);

  if (etat === 'chargement') {
    return (
      <ScreenContainer titre="Œuvres" afficherRetour={false}>
        <LoadingState message="Chargement de vos œuvres…" />
      </ScreenContainer>
    );
  }

  if (etat === 'erreur') {
    return (
      <ScreenContainer titre="Œuvres" afficherRetour={false}>
        <ErrorState
          titre="Œuvres indisponibles"
          message={messageErreur}
          libelleAction="Réessayer"
          onReessayer={() => void chargerOeuvres(statutFiltre)}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer titre="Œuvres" afficherRetour={false}>
      <Text className="text-base text-omda-textGray">
        Retrouvez ici toutes vos œuvres et l’avancement de leur dépôt auprès de l’OMDA.
      </Text>

      <View className="mt-5">
        <SelectField
          libelle="Filtrer par statut"
          options={optionsFiltre}
          valeur={filtre}
          onChangeValeur={setFiltre}
          aide="Le filtre est appliqué par le serveur OMDA."
        />
      </View>

      {etat === 'vide' ? (
        <View className="mt-5">
          <EmptyState
            titre={
              statutFiltre ? 'Aucune œuvre dans ce statut' : 'Aucune œuvre déposée pour le moment'
            }
            message={
              statutFiltre
                ? 'Changez de filtre ou déposez une nouvelle œuvre pour la voir apparaître ici.'
                : 'Déposez votre première œuvre : titre, catégorie, fichier et attestation de diffusion. Aucun paiement n’est demandé à l’envoi.'
            }
            icone="folder-open"
            actionLibelle="Déposer une œuvre"
            onAction={ouvrirDepot}
          />
        </View>
      ) : (
        <View className="mt-5 gap-4">
          <Text className="text-base font-semibold text-omda-black">
            {oeuvres.length > 1 ? `${oeuvres.length} œuvres` : `${oeuvres.length} œuvre`}
          </Text>

          {oeuvres.map((oeuvre) => (
            <CarteOeuvre
              key={oeuvre.id}
              oeuvre={oeuvre}
              libelleCategorie={
                libellesCategories.get(oeuvre.categorie_id) ?? 'Catégorie non précisée'
              }
              onOuvrir={() => ouvrirFiche(oeuvre)}
            />
          ))}

          <InfoBanner
            variante="info"
            titre="Dépôt d’œuvre"
            message="L’envoi d’une œuvre ne déclenche aucun paiement : les frais de dépôt ne sont réglés qu’après la validation de l’œuvre par l’OMDA."
          />
        </View>
      )}

      <View className="mt-6 gap-3">
        <Button libelle="Déposer une œuvre" icone="plus" pleineLargeur onPress={ouvrirDepot} />
        <Button
          libelle="Actualiser"
          variante="secondary"
          icone="rotate-right"
          pleineLargeur
          onPress={() => void chargerOeuvres(statutFiltre)}
        />
      </View>
    </ScreenContainer>
  );
}
