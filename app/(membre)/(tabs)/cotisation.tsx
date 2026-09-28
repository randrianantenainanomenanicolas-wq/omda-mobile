import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { Text, View } from 'react-native';

import {
  AmountCard,
  Button,
  EmptyState,
  ErrorState,
  Icone,
  InfoBanner,
  LoadingState,
  ScreenContainer,
  StatusPill,
  type StatutPill,
} from '../../../src/components/ui';
import type { Cotisation, StatutCotisation } from '../../../src/models';
import type { ErreurApp } from '../../../src/services/contracts';
import { mockMemberRepository } from '../../../src/services/mocks';

/**
 * Écran T — Cotisation (onglet 3/5).
 *
 * Règles appliquées :
 * - année, montant, statut et date de paiement viennent EXCLUSIVEMENT de
 *   `mockMemberRepository.listerCotisations()` : aucun montant n'est codé ici ;
 * - le bouton « Payer ma cotisation » n'est proposé que si le serveur annonce
 *   `NON_PAYEE` (règle métier : une cotisation déjà `PAYEE` n'est pas payable) ;
 * - la pastille verte `PAYEE` n'apparaît qu'après la confirmation du serveur
 *   (paiement `REUSSI` → effet serveur `cotisation.statut = PAYEE`) ;
 * - 4 états obligatoires : chargement / erreur + « Réessayer » / vide / contenu.
 */

type EtatEcran = 'chargement' | 'erreur' | 'vide' | 'contenu';

/** Statuts de cotisation : « payée » seulement si le serveur l'a confirmé. */
const STATUTS_COTISATION: Record<StatutCotisation, { variante: StatutPill; libelle: string }> = {
  PAYEE: { variante: 'success', libelle: 'Cotisation payée' },
  NON_PAYEE: { variante: 'pending', libelle: 'Cotisation à régler' },
};

/** Message compréhensible selon la famille d'erreur (`Result`). */
function traduireErreur(erreur: ErreurApp): string {
  if (erreur.type === 'metier') return erreur.message;
  if (erreur.type === 'reseau') {
    return 'Impossible de joindre le serveur OMDA. Vérifiez votre connexion Internet puis réessayez.';
  }
  return 'Votre cotisation est momentanément indisponible. Veuillez réessayer dans quelques instants.';
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

type PropsLigneHistorique = {
  cotisation: Cotisation;
};

/** Ligne d'une cotisation antérieure : année, montant, statut et date. */
function LigneHistorique({ cotisation }: PropsLigneHistorique) {
  const statut = STATUTS_COTISATION[cotisation.statut];
  const datePaiement = formaterDateCourte(cotisation.date_paiement);

  return (
    <View className="w-full rounded-xl border border-omda-borderGray bg-omda-white p-4">
      <View className="flex-row items-center">
        <Icone nom="calendar" taille={16} classeCouleur="text-omda-textGray" />
        <Text className="ml-2 flex-1 text-base font-semibold text-omda-black">
          {`Cotisation ${cotisation.annee}`}
        </Text>
      </View>

      <View className="mt-2">
        <StatusPill statut={statut.variante} libelle={statut.libelle} />
      </View>

      {datePaiement ? (
        <Text className="mt-2 text-sm text-omda-textGray">{`Payée le ${datePaiement}`}</Text>
      ) : (
        <Text className="mt-2 text-sm text-omda-textGray">Aucun paiement enregistré.</Text>
      )}
    </View>
  );
}

export default function CotisationScreen() {
  const [etat, setEtat] = useState<EtatEcran>('chargement');
  const [messageErreur, setMessageErreur] = useState('');
  const [cotisations, setCotisations] = useState<Cotisation[]>([]);

  const anneeCourante = useMemo(() => new Date().getFullYear(), []);

  /** Cotisations du membre (année décroissante côté service). */
  const chargerCotisations = useCallback(async () => {
    setEtat('chargement');
    setMessageErreur('');

    try {
      const reponse = await mockMemberRepository.listerCotisations();

      if (!reponse.ok) {
        setCotisations([]);
        setMessageErreur(traduireErreur(reponse.erreur));
        setEtat('erreur');
        return;
      }

      setCotisations(reponse.valeur);
      setEtat(reponse.valeur.length === 0 ? 'vide' : 'contenu');
    } catch {
      setCotisations([]);
      setMessageErreur(
        'Une erreur inattendue est survenue pendant le chargement de votre cotisation. Veuillez réessayer.',
      );
      setEtat('erreur');
    }
  }, []);

  /** Recharge à chaque retour sur l'onglet (le statut change après paiement). */
  useFocusEffect(
    useCallback(() => {
      void chargerCotisations();
    }, [chargerCotisations]),
  );

  const cotisationCourante = useMemo(
    () => cotisations.find((element) => element.annee === anneeCourante) ?? null,
    [anneeCourante, cotisations],
  );

  const historique = useMemo(
    () => cotisations.filter((element) => element.id !== cotisationCourante?.id),
    [cotisationCourante, cotisations],
  );

  /** Paiement de la cotisation due (écran unique de paiement du membre). */
  const payerCotisation = useCallback((cotisation: Cotisation) => {
    router.push({
      pathname: '/(membre)/paiement-membre',
      params: { type: 'COTISATION', cotisation_id: cotisation.id, annee: `${cotisation.annee}` },
    });
  }, []);

  if (etat === 'chargement') {
    return (
      <ScreenContainer titre="Cotisation" afficherRetour={false}>
        <LoadingState message="Chargement de votre cotisation…" />
      </ScreenContainer>
    );
  }

  if (etat === 'erreur') {
    return (
      <ScreenContainer titre="Cotisation" afficherRetour={false}>
        <ErrorState
          titre="Cotisation indisponible"
          message={messageErreur}
          libelleAction="Réessayer"
          onReessayer={() => void chargerCotisations()}
        />
      </ScreenContainer>
    );
  }

  if (etat === 'vide') {
    return (
      <ScreenContainer titre="Cotisation" afficherRetour={false}>
        <EmptyState
          titre="Aucune cotisation enregistrée"
          message="Aucune cotisation n’est encore rattachée à votre compte adhérent. Elle apparaîtra ici dès que l’OMDA l’aura créée."
          icone="money-bill-wave"
          actionLibelle="Actualiser"
          onAction={() => void chargerCotisations()}
        />
      </ScreenContainer>
    );
  }

  const statutCourant = cotisationCourante
    ? STATUTS_COTISATION[cotisationCourante.statut]
    : null;
  const datePaiementCourante = cotisationCourante
    ? formaterDateCourte(cotisationCourante.date_paiement)
    : '';

  return (
    <ScreenContainer titre="Cotisation" afficherRetour={false}>
      <Text className="text-base text-omda-textGray">
        Cotisation annuelle des auteurs adhérents : montant officiel, statut et date de paiement.
      </Text>

      {cotisationCourante ? (
        <View className="mt-5 gap-4">
          <AmountCard
            objet={`Cotisation annuelle ${cotisationCourante.annee}`}
            montant={cotisationCourante.montant}
            mention="Montant officiel communiqué par le serveur OMDA."
          />

          <View className="w-full rounded-2xl border border-omda-borderGray bg-omda-white p-5">
            {statutCourant ? (
              <StatusPill statut={statutCourant.variante} libelle={statutCourant.libelle} />
            ) : null}

            <View className="mt-3 flex-row items-center">
              <Icone nom="calendar" taille={16} classeCouleur="text-omda-textGray" />
              <Text className="ml-2 flex-1 text-base text-omda-black">
                {datePaiementCourante
                  ? `Paiement enregistré le ${datePaiementCourante}`
                  : 'Aucun paiement enregistré pour cette année.'}
              </Text>
            </View>

            {cotisationCourante.statut === 'NON_PAYEE' ? (
              <View className="mt-4 gap-3">
                <InfoBanner
                  variante="pending"
                  titre="Cotisation à régler"
                  message={`Le règlement de la cotisation ${cotisationCourante.annee} est attendu. Vous pouvez le faire dès maintenant par Mobile Money.`}
                />
                <Button
                  libelle="Payer ma cotisation"
                  variante="secondary"
                  icone="money-bill-wave"
                  pleineLargeur
                  onPress={() => payerCotisation(cotisationCourante)}
                />
              </View>
            ) : (
              <View className="mt-4">
                <InfoBanner
                  variante="success"
                  titre="Cotisation confirmée"
                  message="Le serveur OMDA a confirmé le paiement de votre cotisation."
                />
              </View>
            )}
          </View>
        </View>
      ) : (
        <View className="mt-5">
          <InfoBanner
            variante="info"
            titre={`Cotisation ${anneeCourante}`}
            message="Aucune cotisation n’est enregistrée pour l’année en cours."
          />
        </View>
      )}

      {historique.length > 0 ? (
        <View className="mt-6 gap-3">
          <Text className="text-base font-semibold text-omda-black">Historique</Text>
          {historique.map((cotisation) => (
            <LigneHistorique key={cotisation.id} cotisation={cotisation} />
          ))}
        </View>
      ) : null}

      <View className="mt-6 gap-3">
        <Button
          libelle="Actualiser"
          variante="secondary"
          icone="rotate-right"
          pleineLargeur
          onPress={() => void chargerCotisations()}
        />
        <Button
          libelle="Accueil"
          variante="secondary"
          icone="house"
          pleineLargeur
          onPress={() => router.push('/(membre)/(tabs)/accueil')}
        />
      </View>
    </ScreenContainer>
  );
}
