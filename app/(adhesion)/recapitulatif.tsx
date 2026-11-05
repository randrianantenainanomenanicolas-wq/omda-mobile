import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  EmptyState,
  ErrorState,
  Icone,
  InfoBanner,
  LoadingState,
  ScreenContainer,
  StepProgress,
  type NomIcone,
} from '../../src/components/ui';
import { useAdhesionDraft, type AdhesionDraft } from '../../src/context/AdhesionDraftContext';
import {
  BULLETIN_VIDE,
  PIECES_IDENTITE,
  bulletinEstComplet,
  type Categorie,
  type TypePiece,
} from '../../src/models';
import { mockPublicContentService } from '../../src/services/mocks';

type EtatEcran = 'chargement' | 'erreur' | 'vide' | 'contenu';

/* -------------------------------------------------------------- Constantes */

/** Nombre minimum d'œuvres exigé par la règle métier 8 (identique à l'écran J). */
const NOMBRE_MINIMUM_OEUVRES = 2;

/** Nombre minimum d'attestations de diffusion par œuvre (règle métier 8). */
const NOMBRE_MINIMUM_ATTESTATIONS = 1;

type ExigencePiece = {
  type: TypePiece;
  libelle: string;
};

/**
 * Pièces obligatoires contrôlées au récapitulatif : ordre et libellés issus de
 * la SOURCE UNIQUE `PIECES_IDENTITE` (`src/models/importation.ts`, règle 11).
 * Aucune pièce n'est codée en dur dans l'écran.
 */
const PIECES_OBLIGATOIRES: ExigencePiece[] = PIECES_IDENTITE.map((piece) => ({
  type: piece.type,
  libelle: piece.libelle,
}));

/** Pièce supplémentaire exigée de 15 à 17 ans (règle métier 7). */
const PIECE_AUTORISATION_PARENTALE: ExigencePiece = {
  type: 'AUTORISATION_PARENTALE',
  libelle: 'Autorisation parentale',
};

/* ------------------------------------------------------------- Utilitaires */

/** Date ISO (`AAAA-MM-JJ`) affichée en `JJ/MM/AAAA` ; renvoie la valeur brute si invalide. */
function formaterDate(date: string): string {
  const propre = date.trim();
  const correspondance = /^(\d{4})-(\d{2})-(\d{2})$/.exec(propre);
  if (!correspondance) {
    return propre;
  }
  return `${correspondance[3]}/${correspondance[2]}/${correspondance[1]}`;
}

/** Dernier segment d'un chemin de stockage : nom du fichier déposé. */
function nomFichier(chemin: string): string {
  const segments = chemin.split('/');
  return segments[segments.length - 1] || chemin;
}

/** Un brouillon totalement vide n'a rien à récapituler (état vide). */
function brouillonVide(draft: AdhesionDraft): boolean {
  return (
    !draft.identite.nom.trim() &&
    !draft.identite.prenom.trim() &&
    draft.categorie_id === null &&
    draft.pieces.length === 0 &&
    draft.oeuvres.length === 0
  );
}

/* ------------------------------------------------------------------ Blocs */

type PropsSection = {
  titre: string;
  icone: NomIcone;
  /** Retour à l'étape correspondante du parcours (navigation linéaire). */
  onModifier: () => void;
  children: ReactNode;
};

/** Bloc éditable du récapitulatif : en-tête + bouton « Modifier » + contenu. */
function Section({ titre, icone, onModifier, children }: PropsSection) {
  return (
    <View className="mt-5 rounded-2xl border border-omda-borderGray bg-omda-white p-4">
      <View className="flex-row items-center">
        <Icone nom={icone} taille={16} classeCouleur="text-omda-textGray" />
        <Text className="ml-2 flex-1 text-base font-bold text-omda-black">{titre}</Text>
      </View>

      <View className="mt-3">{children}</View>

      <View className="mt-4">
        <Button
          libelle={`Modifier : ${titre}`}
          icone="pen-to-square"
          variante="secondary"
          pleineLargeur
          onPress={onModifier}
        />
      </View>
    </View>
  );
}

/** Ligne « libellé — valeur » d'une section du récapitulatif. */
function Ligne({ libelle, valeur }: { libelle: string; valeur: string }) {
  return (
    <View className="flex-row items-start justify-between py-1">
      <Text className="mr-3 text-sm text-omda-textGray">{libelle}</Text>
      <Text className="flex-1 text-right text-sm font-semibold text-omda-black">{valeur}</Text>
    </View>
  );
}

/** Ligne « point du dossier » : présent (coché) ou manquant (à compléter). */
function LigneControle({
  libelle,
  detail,
  present,
}: {
  libelle: string;
  detail: string | null;
  present: boolean;
}) {
  return (
    <View className="mt-2 flex-row items-start">
      <Icone
        nom={present ? 'circle-check' : 'circle-xmark'}
        taille={16}
        classeCouleur={present ? 'text-status-success' : 'text-status-error'}
      />
      <View className="ml-2 flex-1">
        <Text className="text-sm font-semibold text-omda-black">{libelle}</Text>
        {detail ? <Text className="mt-0.5 text-xs text-omda-textGray">{detail}</Text> : null}
      </View>
    </View>
  );
}

/* ------------------------------------------------------------------- Écran */

/**
 * Étape 5 — Récapitulatif modifiable (écran K du cahier des charges).
 *
 * Navigation linéaire (sans menu) : chaque section propose « Modifier » et
 * renvoie à l'étape correspondante (1 identité, 2 catégorie, 3 documents/œuvres).
 *
 * ⚠️ L'envoi n'est PLUS fait ici (ÉTAPE 29C) : le bouton « Continuer » mène à
 * la vérification d'identité (étape 6, selfie). « Envoyer ma demande » est
 * porté par cet écran distinct et n'est accessible qu'après un selfie importé.
 *
 * Aucun paiement n'est demandé (règle métier 1) : aucune information de
 * paiement n'est affichée ici.
 *
 * 4 états obligatoires : chargement, erreur (+ « Réessayer »), vide et contenu.
 */
export default function RecapitulatifScreen() {
  const { brouillon, estCharge, estMineur15A17, identiteEstValide } = useAdhesionDraft();

  const [etat, setEtat] = useState<EtatEcran>('chargement');
  const [messageErreur, setMessageErreur] = useState('');
  const [categorieRetenue, setCategorieRetenue] = useState<Categorie | null>(null);

  /** Pièces exigées : les 4 obligatoires + l'autorisation parentale si 15–17 ans. */
  const exigences = useMemo<ExigencePiece[]>(
    () =>
      estMineur15A17 ? [...PIECES_OBLIGATOIRES, PIECE_AUTORISATION_PARENTALE] : PIECES_OBLIGATOIRES,
    [estMineur15A17],
  );

  /* --------------------------------------------- Chargement des données */

  /** Charge les catégories (données dynamiques) puis reprend le brouillon local. */
  const initialiserEcran = useCallback(async (draft: AdhesionDraft) => {
    setEtat('chargement');
    setMessageErreur('');

    const resultat = await mockPublicContentService.listerCategories();
    if (!resultat.ok) {
      setMessageErreur(
        resultat.erreur.type === 'reseau'
          ? 'Impossible de joindre le serveur OMDA. Vérifiez votre connexion Internet et réessayez.'
          : 'Le service des catégories d’adhésion est momentanément indisponible.',
      );
      setEtat('erreur');
      return;
    }

    const categorie =
      draft.categorie_id === null
        ? null
        : (resultat.valeur.find((element) => element.id === draft.categorie_id) ?? null);

    setCategorieRetenue(categorie);
    setEtat(brouillonVide(draft) ? 'vide' : 'contenu');
  }, []);

  useEffect(() => {
    if (!estCharge) {
      return;
    }
    // Le brouillon (données locales relues d'AsyncStorage) n'est repris qu'au montage.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    void initialiserEcran(brouillon);
  }, [estCharge, initialiserEcran]);

  /* ------------------------------------------ Complétude du dossier */

  /** Pièces confirmées, indexées par type (une seule pièce par type). */
  const piecesParType = useMemo(() => {
    const index = new Map<TypePiece, string>();
    for (const piece of brouillon.pieces) {
      index.set(piece.type, nomFichier(piece.chemin_stockage));
    }
    return index;
  }, [brouillon.pieces]);

  /** Œuvres complètes : titre + fichier + attestation + bulletin renseigné. */
  const oeuvresCompletes = useMemo(
    () =>
      brouillon.oeuvres.filter(
        (oeuvre) =>
          oeuvre.titre.trim().length > 0 &&
          oeuvre.fichier.chemin_stockage.length > 0 &&
          oeuvre.attestations.length >= NOMBRE_MINIMUM_ATTESTATIONS &&
          bulletinEstComplet(brouillon.bulletins[oeuvre.cle_locale ?? ''] ?? BULLETIN_VIDE),
      ),
    [brouillon.bulletins, brouillon.oeuvres],
  );

  /** Points manquants : affichés en clair et utilisés pour bloquer l'envoi. */
  const manques = useMemo<string[]>(() => {
    const liste: string[] = [];

    if (!identiteEstValide) {
      liste.push(
        'Identité : informations incomplètes, date de naissance invalide ou âge inférieur à 15 ans.',
      );
    }

    if (!categorieRetenue) {
      liste.push('Catégorie d’adhésion : aucune catégorie active n’est sélectionnée.');
    }

    for (const exigence of exigences) {
      if (!piecesParType.has(exigence.type)) {
        liste.push(`Documents : ${exigence.libelle} à fournir.`);
      }
    }

    brouillon.oeuvres.forEach((oeuvre, index) => {
      const nom = `Œuvre ${index + 1}`;
      if (!oeuvre.titre.trim()) {
        liste.push(`${nom} : indiquez le titre.`);
      }
      if (!oeuvre.fichier.chemin_stockage) {
        liste.push(`${nom} : fichier de l’œuvre à envoyer.`);
      }
      if (oeuvre.attestations.length < NOMBRE_MINIMUM_ATTESTATIONS) {
        liste.push(`${nom} : attestation de diffusion obligatoire.`);
      }
      if (!bulletinEstComplet(brouillon.bulletins[oeuvre.cle_locale ?? ''] ?? BULLETIN_VIDE)) {
        liste.push(`${nom} : bulletin de déclaration à compléter.`);
      }
    });

    if (oeuvresCompletes.length < NOMBRE_MINIMUM_OEUVRES) {
      liste.push(
        `${NOMBRE_MINIMUM_OEUVRES} œuvres complètes minimum (${oeuvresCompletes.length} validée${
          oeuvresCompletes.length > 1 ? 's' : ''
        }).`,
      );
    }

    return liste;
  }, [
    brouillon.bulletins,
    brouillon.oeuvres,
    categorieRetenue,
    exigences,
    identiteEstValide,
    oeuvresCompletes.length,
    piecesParType,
  ]);

  const dossierComplet = manques.length === 0;

  /* ------------------------------------ Continuation vers la vérification */

  /**
   * Le récapitulatif n'envoie plus la demande (ÉTAPE 29C) : il mène à la
   * vérification d'identité (étape 6), où le selfie débloquera l'envoi.
   */
  const continuer = useCallback(() => {
    if (!dossierComplet) {
      return;
    }
    router.push('/(adhesion)/verif-identite');
  }, [dossierComplet]);

  /* --------------------------------------------------------------- Rendu */

  if (etat === 'chargement') {
    return (
      <ScreenContainer titre="Récapitulatif" sousTitre="Demande d’adhésion">
        <StepProgress etapeCourante={5} />
        <LoadingState message="Chargement de votre dossier et des catégories d’adhésion…" />
      </ScreenContainer>
    );
  }

  if (etat === 'erreur') {
    return (
      <ScreenContainer titre="Récapitulatif" sousTitre="Demande d’adhésion">
        <StepProgress etapeCourante={5} />
        <ErrorState
          titre="Récapitulatif indisponible"
          message={messageErreur}
          onReessayer={() => void initialiserEcran(brouillon)}
        />
      </ScreenContainer>
    );
  }

  if (etat === 'vide') {
    return (
      <ScreenContainer titre="Récapitulatif" sousTitre="Demande d’adhésion">
        <StepProgress etapeCourante={5} />
        <EmptyState
          titre="Aucune demande en cours"
          message="Votre demande d’adhésion est vide : commencez par vos informations d’identité, puis choisissez une catégorie et joignez vos pièces."
          actionLibelle="Commencer ma demande"
          onAction={() => router.push('/(adhesion)/identite')}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer titre="Récapitulatif" sousTitre="Demande d’adhésion">
      <StepProgress etapeCourante={5} />

      <Text className="text-base text-omda-textGray">
        Vérifiez les informations ci-dessous. Chaque section peut être modifiée jusqu’à l’envoi :
        aucun paiement n’est demandé à ce stade.
      </Text>

      {/* 1. Identité */}
      <Section
        titre="Identité"
        icone="id-card"
        onModifier={() => router.push('/(adhesion)/identite')}
      >
        <Ligne
          libelle="Nom et prénoms"
          valeur={`${brouillon.identite.nom} ${brouillon.identite.prenom}`.trim() || '—'}
        />
        <Ligne
          libelle="Date de naissance"
          valeur={formaterDate(brouillon.identite.date_naissance) || '—'}
        />
        <Ligne libelle="CIN" valeur={brouillon.identite.cin || '—'} />
        <Ligne libelle="Téléphone" valeur={brouillon.identite.telephone || '—'} />
        <Ligne libelle="E-mail" valeur={brouillon.identite.email || '—'} />
        <Ligne libelle="Adresse" valeur={brouillon.identite.adresse || '—'} />
      </Section>

      {/* 2. Catégorie d'adhésion */}
      <Section
        titre="Catégorie d’adhésion"
        icone="layer-group"
        onModifier={() => router.push('/(adhesion)/categorie')}
      >
        {categorieRetenue ? (
          <>
            <Ligne libelle="Catégorie" valeur={categorieRetenue.libelle} />
            {categorieRetenue.description ? (
              <Text className="mt-1 text-sm text-omda-textGray">
                {categorieRetenue.description}
              </Text>
            ) : null}
          </>
        ) : (
          <Text className="text-sm font-semibold text-status-error">
            Aucune catégorie d’adhésion active sélectionnée.
          </Text>
        )}
      </Section>

      {/* 3. Documents */}
      <Section
        titre="Documents"
        icone="paperclip"
        onModifier={() => router.push('/(adhesion)/documents-oeuvres')}
      >
        <Text className="text-sm text-omda-textGray">
          {`Pièces enregistrées : ${
            exigences.filter((exigence) => piecesParType.has(exigence.type)).length
          } / ${exigences.length}`}
        </Text>

        {exigences.map((exigence) => {
          const fichier = piecesParType.get(exigence.type) ?? null;
          return (
            <LigneControle
              key={exigence.type}
              libelle={exigence.libelle}
              detail={fichier}
              present={fichier !== null}
            />
          );
        })}

        {estMineur15A17 ? (
          <Text className="mt-3 text-sm text-omda-textGray">
            Vous avez entre 15 et 17 ans : l’autorisation parentale est obligatoire.
          </Text>
        ) : null}
      </Section>

      {/* 4. Œuvres */}
      <Section
        titre="Œuvres"
        icone="music"
        onModifier={() => router.push('/(adhesion)/documents-oeuvres')}
      >
        <Text className="text-sm text-omda-textGray">
          {`Œuvres complètes : ${oeuvresCompletes.length} / ${NOMBRE_MINIMUM_OEUVRES} minimum`}
        </Text>

        {brouillon.oeuvres.map((oeuvre, index) => (
          <View key={`${oeuvre.titre}-${index}`} className="mt-3">
            <Text className="text-sm font-bold text-omda-black">
              {`Œuvre ${index + 1} — ${oeuvre.titre.trim() || 'titre à compléter'}`}
            </Text>
            <LigneControle
              libelle="Fichier de l’œuvre"
              detail={
                oeuvre.fichier.chemin_stockage
                  ? nomFichier(oeuvre.fichier.chemin_stockage)
                  : null
              }
              present={oeuvre.fichier.chemin_stockage.length > 0}
            />
            <LigneControle
              libelle="Attestation de diffusion"
              detail={
                oeuvre.attestations[0] ? nomFichier(oeuvre.attestations[0].chemin_stockage) : null
              }
              present={oeuvre.attestations.length >= NOMBRE_MINIMUM_ATTESTATIONS}
            />
            <LigneControle
              libelle="Bulletin de déclaration"
              detail={
                bulletinEstComplet(brouillon.bulletins[oeuvre.cle_locale ?? ''] ?? BULLETIN_VIDE)
                  ? 'Complété'
                  : null
              }
              present={bulletinEstComplet(brouillon.bulletins[oeuvre.cle_locale ?? ''] ?? BULLETIN_VIDE)}
            />
          </View>
        ))}
      </Section>

      {/* Complétude du dossier */}
      {dossierComplet ? (
        <View className="mt-6">
          <InfoBanner
            variante="info"
            titre="Dossier complet"
            message="Toutes les informations exigées sont présentes. Vous pouvez passer à la vérification d’identité : aucun paiement n’est demandé à ce stade."
          />
        </View>
      ) : (
        <View className="mt-6">
          <InfoBanner
            variante="pending"
            titre="Dossier incomplet"
            message={manques.map((element) => `• ${element}`).join('\n')}
            actionLibelle="Compléter mon dossier"
            onAction={() => router.push('/(adhesion)/documents-oeuvres')}
          />
        </View>
      )}

      <View className="mt-8 gap-3">
        <Button
          libelle="Continuer vers la vérification d’identité"
          icone="shield-halved"
          pleineLargeur
          desactive={!dossierComplet}
          onPress={continuer}
        />
        <Button
          libelle="Retour aux documents et œuvres"
          variante="secondary"
          pleineLargeur
          onPress={() => router.back()}
        />
      </View>
    </ScreenContainer>
  );
}

