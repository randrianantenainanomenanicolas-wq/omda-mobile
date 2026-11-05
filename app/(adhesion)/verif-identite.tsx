import * as ImagePicker from 'expo-image-picker';
import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  Button,
  Icone,
  InfoBanner,
  LoadingState,
  ScreenContainer,
  StepProgress,
  UploadTile,
  type NomIcone,
  type StatutUpload,
} from '../../src/components/ui';
import { useAdhesionDraft, type AdhesionDraft } from '../../src/context/AdhesionDraftContext';
import {
  BULLETIN_VIDE,
  PIECES_IDENTITE,
  TAILLE_MAX_FICHIER_MO,
  TAILLE_MAX_FICHIER_OCTETS,
  bulletinEstComplet,
  pieceImportationDepuisType,
  type BucketStockage,
  type TypeMime,
} from '../../src/models';
import type { ErreurApp, FichierDepose } from '../../src/services/contracts';
import { candidateApi, estModeMockCandidat } from '../../src/services/factory';
import { enregistrerDossierSoumis } from '../../src/services/local/historiqueDossiers';
import {
  MESSAGE_SELFI_DOUBLON,
  compresserSiImage,
  controleLisibiliteSelfie,
  empreinteDejaPrise,
  empreinteFichier,
  natureDepuisPiece,
  renommerFichier,
  signatureDossier,
} from '../../src/utils';

/* -------------------------------------------------------------- Constantes */

/** Bucket de destination des pièces justificatives (dont le selfie). */
const BUCKET_PIECES: BucketStockage = 'pieces';

/** Nombre minimum d'attestations de diffusion par œuvre (règle métier 8). */
const NOMBRE_MINIMUM_ATTESTATIONS = 1;

/** Types MIME image acceptés pour le selfie (un PDF n'est pas un selfie). */
const MIMES_SELFI: readonly string[] = ['image/jpeg', 'image/png'];

const EXTENSION_PAR_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
};

/** Message affiché quand la caméra est refusée (permission demandée au bon moment). */
const MESSAGE_CAMERA_REFUSEE =
  "L'accès à la caméra est nécessaire pour prendre le selfie de vérification. Autorisez-le dans les réglages du téléphone puis réessayez.";

/** Message affiché quand l'accès à la galerie est refusé. */
const MESSAGE_GALERIE_REFUSEE =
  "L'accès à vos photos est nécessaire pour importer le selfie. Autorisez-le dans les réglages du téléphone puis réessayez.";

/** Message affiché après un échec d'envoi (reprise possible, rien n'est perdu). */
const MESSAGE_SELFI_ENVOI_ECHEC =
  "L'envoi du selfie a échoué. Votre saisie est conservée : vous pouvez réessayer.";

/* ------------------------------------------------------------------- Types */

type EtatEcran = 'chargement' | 'contenu' | 'verrouille';

/** Éléments encore manquants, chacun avec un lien vers l'écran qui le corrige. */
type ElementManquant = {
  libelle: string;
  detail: string;
  route: string;
  params?: Record<string, string>;
};

/** Fichier selfie retenu localement avant envoi (dimensions pour le contrôle). */
type SelectionSelfie = {
  uri: string;
  nom: string;
  mime_type: TypeMime;
  taille_octets: number;
};

/** Suivi de l'envoi du selfie (4 états : manquant / en cours / importé / erreur). */
type EnvoiSelfie = {
  statut: StatutUpload;
  progression: number;
  selection: SelectionSelfie | null;
  depose: FichierDepose | null;
  erreur: string | null;
};

const ENVOI_VIDE: EnvoiSelfie = {
  statut: 'vide',
  progression: 0,
  selection: null,
  depose: null,
  erreur: null,
};

/* ------------------------------------------------------------- Utilitaires */

/** Message français affichable pour une erreur de la couche data. */
function messageErreurEnvoi(erreur: ErreurApp): string {
  if (erreur.type === 'metier') {
    return erreur.message;
  }
  if (erreur.type === 'reseau') {
    return "Impossible de joindre le serveur. Vérifiez votre connexion Internet puis réessayez.";
  }
  return 'Le service est momentanément indisponible. Veuillez réessayer dans un instant.';
}

/** Le selfie est-il une image (JPEG/PNG) et non un PDF ? */
function estMimeSelfie(mime: string): mime is TypeMime {
  return MIMES_SELFI.includes(mime);
}

/** Signature du dossier : change si un formulaire ou une pièce est modifié. */
function partiesSignature(draft: AdhesionDraft): string[] {
  const i = draft.identite;
  const pieces = draft.pieces
    .map((piece) => `${piece.type}:${piece.chemin_stockage}:${piece.taille_octets}`)
    .sort();
  const oeuvres = draft.oeuvres
    .map(
      (oeuvre) =>
        `${oeuvre.cle_locale ?? ''}|${oeuvre.titre.trim()}|${oeuvre.fichier.chemin_stockage}|${oeuvre.attestations
          .map((attestation) => attestation.chemin_stockage)
          .join(',')}`,
    )
    .sort();
  const bulletins = Object.entries(draft.bulletins)
    .map(([cle, bulletin]) => `${cle}:${JSON.stringify(bulletin)}`)
    .sort();

  return [
    `identite:${i.nom}|${i.prenom}|${i.date_naissance}|${i.cin}|${i.telephone}|${i.email}|${i.adresse}`,
    `categorie:${draft.categorie_id ?? ''}`,
    `engagement:${draft.engagement.accepte ? 1 : 0}|${draft.engagement.mention_saisie}|${draft.engagement.lieu}|${draft.engagement.date_jour}`,
    `pieces:${pieces.join(';')}`,
    `oeuvres:${oeuvres.join(';')}`,
    `bulletins:${bulletins.join(';')}`,
  ];
}

/**
 * Liste précise des éléments manquants (formulaires incomplets ou pièces non
 * importées). Chaque entrée porte le lien de l'écran qui la corrige : la
 * vérification d'identité reste VERROUILLÉE tant que cette liste n'est pas vide.
 */
function elementsManquants(draft: AdhesionDraft, mineur15A17: boolean): ElementManquant[] {
  const liste: ElementManquant[] = [];
  const typesImportes = new Set(draft.pieces.map((piece) => piece.type));

  if (draft.identite.nom.trim() === '' || draft.identite.prenom.trim() === '') {
    liste.push({
      libelle: 'Identité',
      detail: 'Nom et prénom du candidat à renseigner.',
      route: '/(adhesion)/identite',
    });
  }

  if (draft.categorie_id === null) {
    liste.push({
      libelle: "Catégorie d'adhésion",
      detail: 'Aucune catégorie sélectionnée.',
      route: '/(adhesion)/categorie',
    });
  }

  if (!draft.engagement.accepte) {
    liste.push({
      libelle: "Engagement sur l'honneur",
      detail: "L'engagement n'a pas été validé.",
      route: '/(adhesion)/engagement',
    });
  }

  for (const piece of PIECES_IDENTITE) {
    if (!typesImportes.has(piece.type)) {
      liste.push({
        libelle: piece.libelle,
        detail: 'Pièce non importée.',
        route: '/(adhesion)/documents-oeuvres',
      });
    }
  }

  if (mineur15A17 && !typesImportes.has('AUTORISATION_PARENTALE')) {
    liste.push({
      libelle: 'Autorisation parentale',
      detail: 'Obligatoire de 15 à 17 ans : pièce non importée.',
      route: '/(adhesion)/documents-oeuvres',
    });
  }

  draft.oeuvres.forEach((oeuvre, index) => {
    const cle = oeuvre.cle_locale ?? '';
    const titre = oeuvre.titre.trim();
    const nom = titre || `Œuvre ${index + 1}`;
    const params = cle ? { cle, titre: nom } : undefined;

    if (!titre) {
      liste.push({
        libelle: `Œuvre ${index + 1} : titre`,
        detail: 'Le titre de l’œuvre est vide.',
        route: '/(adhesion)/documents-oeuvres',
      });
    }
    if (!oeuvre.fichier.chemin_stockage) {
      liste.push({
        libelle: `${nom} : fichier de l’œuvre`,
        detail: "Le fichier de l'œuvre n'est pas importé.",
        route: '/(adhesion)/documents-oeuvres',
      });
    }
    if (oeuvre.attestations.length < NOMBRE_MINIMUM_ATTESTATIONS) {
      liste.push({
        libelle: `${nom} : attestation de diffusion`,
        detail: "L'attestation de diffusion n'est pas importée.",
        route: '/(adhesion)/documents-oeuvres',
      });
    }
    if (!bulletinEstComplet(draft.bulletins[cle] ?? BULLETIN_VIDE)) {
      liste.push({
        libelle: `${nom} : bulletin de déclaration`,
        detail: 'Le bulletin de déclaration est à compléter.',
        route: '/(adhesion)/bulletin',
        params,
      });
    }
  });

  if (draft.oeuvres.length < 2) {
    liste.push({
      libelle: 'Œuvres',
      detail: 'Au moins 2 œuvres sont exigées.',
      route: '/(adhesion)/documents-oeuvres',
    });
  }

  return liste;
}

/* ------------------------------------------------------------------ Écran */

/**
 * Étape 6 — Vérification d'identité par selfie (écran distinct et DERNIER du
 * parcours, avant confirmation).
 *
 * Verrouillage (`docs/REGLES_METIER_V2.md` §5, `docs/FORMULAIRES.md` §11) :
 * la vérification n'est accessible que lorsque TOUS les formulaires sont
 * complets et TOUTES les pièces importées. Sinon, l'écran reste verrouillé et
 * affiche la liste précise de ce qui manque, avec un lien vers chaque élément.
 *
 * Selfie : pris à la CAMÉRA (permission demandée au moment du clic, message
 * clair si refusée) ou importé depuis la galerie, en tenant la CIN. La consigne
 * est affichée AVANT la prise. Traitement identique aux autres pièces (étape
 * 29B : compression + renommage). Contrôles locaux : refus d'une image trop
 * petite pour être lisible et du même fichier qu'une autre pièce (empreinte).
 *
 * ⚠️ AUCUNE reconnaissance faciale : l'application ne compare aucun visage.
 * C'est un agent OMDA qui examine la photo au back-office ; le texte de l'écran
 * le dit explicitement.
 *
 * Réinvalidation : « Envoyer ma demande » n'est accessible qu'après un selfie
 * importé avec succès. Si le candidat modifie ensuite un formulaire ou une
 * pièce, la signature du dossier change, le selfie est effacé et le bouton
 * redevient inaccessible (selfie à refaire).
 *
 * 4 états pour le selfie (manquant, envoi en cours, importé, erreur + reprise) ;
 * la reprise après échec ne fait perdre aucune autre donnée du dossier.
 */
export default function VerifIdentiteScreen() {
  const {
    brouillon,
    estCharge,
    estMineur15A17,
    definirSelfie,
    effacerSelfie,
    definirIdentifiantsDossier,
    reinitialiserBrouillon,
  } = useAdhesionDraft();

  const [envoi, setEnvoi] = useState<EnvoiSelfie>(ENVOI_VIDE);
  const [selfieInvalide, setSelfieInvalide] = useState(false);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);

  /* -------------------------------------- Complétude + signature du dossier */

  const manques = useMemo(
    () => elementsManquants(brouillon, estMineur15A17),
    [brouillon, estMineur15A17],
  );
  const dossierComplet = manques.length === 0;

  const signatureCourante = useMemo(() => signatureDossier(partiesSignature(brouillon)), [brouillon]);

  /** Empreintes des fichiers déjà retenus pour une autre pièce (anti-doublon). */
  const empreintesAutresPieces = useMemo(
    () => Object.values(brouillon.empreintes_pieces),
    [brouillon.empreintes_pieces],
  );

  /** Selfie présent ET signé sur le même état du dossier (sinon à refaire). */
  const selfieValide =
    brouillon.selfie !== null &&
    brouillon.empreinte_dossier_au_selfie === signatureCourante &&
    envoi.statut === 'reussi';

  /* ---- Réinvalidation : le dossier a changé depuis le selfie → selfie à refaire */

  useEffect(() => {
    if (brouillon.selfie && brouillon.empreinte_dossier_au_selfie !== signatureCourante) {
      void effacerSelfie();
      setEnvoi(ENVOI_VIDE);
      setSelfieInvalide(true);
    }
  }, [brouillon.selfie, brouillon.empreinte_dossier_au_selfie, signatureCourante, effacerSelfie]);

  /* ------------------------------------------------- Moteur d'envoi du selfie */

  const televerserSelfie = useCallback(
    async (selection: SelectionSelfie) => {
      setEnvoi((precedent) => ({
        ...precedent,
        statut: 'enCours',
        progression: 0,
        selection,
        depose: null,
        erreur: null,
      }));

      // Étape 29B : compression JPEG des images + renommage (nature SELFIE_CIN).
      const prepare = await compresserSiImage(
        {
          fichier_uri: selection.uri,
          mime_type: selection.mime_type,
          taille_octets: selection.taille_octets,
          nom_fichier: selection.nom,
        },
        estModeMockCandidat,
      );
      const mimeFinal = prepare.mime_type as TypeMime;

      const { nom, prenom, pseudonyme } = brouillon.identite;
      const extension =
        EXTENSION_PAR_MIME[mimeFinal] ?? prepare.nom_fichier.split('.').pop()?.toLowerCase() ?? 'jpg';
      const nommage = renommerFichier({
        nature: natureDepuisPiece('SELFIE_CIN'),
        nom,
        prenom,
        pseudonyme: pseudonyme || undefined,
        extension,
      });

      const dossier = brouillon.numero_dossier ?? 'BROUILLON';
      const resultat = await candidateApi.televerserFichier(
        {
          bucket: BUCKET_PIECES,
          chemin_stockage: `${BUCKET_PIECES}/${dossier}/${nommage.cle_storage}`,
          fichier_uri: prepare.fichier_uri,
          nom_fichier: prepare.nom_fichier,
          mime_type: mimeFinal,
          taille_octets: prepare.taille_octets,
          nom_lisible: nommage.nom_lisible,
        },
        { onProgression: (pourcentage) => setEnvoi((p) => ({ ...p, progression: pourcentage })) },
      );

      if (!resultat.ok) {
        setEnvoi((p) => ({
          ...p,
          statut: 'erreur',
          erreur: messageErreurEnvoi(resultat.erreur),
        }));
        return;
      }

      const depose = resultat.valeur;
      setEnvoi((p) => ({ ...p, statut: 'reussi', progression: 100, depose, erreur: null }));
      // Le selfie est couplé à la signature du dossier au moment de la prise.
      await definirSelfie({ type: 'SELFIE_CIN', ...depose }, signatureCourante);
      setSelfieInvalide(false);
    },
    [brouillon.identite, brouillon.numero_dossier, definirSelfie, signatureCourante],
  );

  /* --------------------------------------------------- Choix du selfie (caméra/galerie) */

  const traiterAsset = useCallback(
    async (asset: ImagePicker.ImagePickerAsset): Promise<void> => {
      // Contrôle local 1 : image trop petite pour être lisible.
      const lisibilite = controleLisibiliteSelfie({
        largeur: asset.width ?? 0,
        hauteur: asset.height ?? 0,
      });
      if (lisibilite) {
        setEnvoi({ ...ENVOI_VIDE, statut: 'erreur', erreur: lisibilite });
        return;
      }

      const mime = (asset.mimeType ?? 'image/jpeg').toLowerCase();
      if (!estMimeSelfie(mime)) {
        setEnvoi({
          ...ENVOI_VIDE,
          statut: 'erreur',
          erreur: 'Le selfie doit être une image (JPEG ou PNG).',
        });
        return;
      }

      const taille = asset.fileSize ?? 0;
      if (taille > TAILLE_MAX_FICHIER_OCTETS) {
        setEnvoi({
          ...ENVOI_VIDE,
          statut: 'erreur',
          erreur: `Ce fichier dépasse ${TAILLE_MAX_FICHIER_MO} Mo. Choisissez une image plus légère.`,
        });
        return;
      }

      // Contrôle local 2 : même fichier qu'une autre pièce (empreinte).
      const empreinte = empreinteFichier({ uri: asset.uri, taille_octets: taille });
      if (empreinteDejaPrise(empreinte, empreintesAutresPieces)) {
        setEnvoi({ ...ENVOI_VIDE, statut: 'erreur', erreur: MESSAGE_SELFI_DOUBLON });
        return;
      }

      const selection: SelectionSelfie = {
        uri: asset.uri,
        nom: asset.fileName ?? 'selfie.jpg',
        mime_type: mime,
        taille_octets: taille,
      };
      await televerserSelfie(selection);
    },
    [empreintesAutresPieces, televerserSelfie],
  );

  const depuisCamera = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) {
        setEnvoi((p) => ({ ...p, statut: 'erreur', erreur: MESSAGE_CAMERA_REFUSEE }));
        return;
      }
      const resultat = await ImagePicker.launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 });
      if (resultat.canceled) {
        return; // Annulation : la saisie précédente est conservée.
      }
      const asset = resultat.assets[0];
      if (asset) {
        await traiterAsset(asset);
      }
    } catch (erreur) {
      console.warn('[VerifIdentite] Caméra impossible :', erreur);
      setEnvoi((p) => ({ ...p, statut: 'erreur', erreur: MESSAGE_SELFI_ENVOI_ECHEC }));
    }
  }, [traiterAsset]);

  const depuisGalerie = useCallback(async () => {
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setEnvoi((p) => ({ ...p, statut: 'erreur', erreur: MESSAGE_GALERIE_REFUSEE }));
        return;
      }
      const resultat = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        quality: 0.8,
      });
      if (resultat.canceled) {
        return;
      }
      const asset = resultat.assets[0];
      if (asset) {
        await traiterAsset(asset);
      }
    } catch (erreur) {
      console.warn('[VerifIdentite] Galerie impossible :', erreur);
      setEnvoi((p) => ({ ...p, statut: 'erreur', erreur: MESSAGE_SELFI_ENVOI_ECHEC }));
    }
  }, [traiterAsset]);

  /** Reprise : renvoie le selfie déjà retenu, sinon rouvre la caméra. */
  const reessayer = useCallback(async () => {
    if (envoi.selection) {
      await televerserSelfie(envoi.selection);
      return;
    }
    await depuisCamera();
  }, [depuisCamera, envoi.selection, televerserSelfie]);

  const supprimerSelfie = useCallback(() => {
    setEnvoi(ENVOI_VIDE);
    void effacerSelfie();
    setSelfieInvalide(false);
  }, [effacerSelfie]);

  /* --------------------------------------------------------- Envoi de la demande */

  const envoyer = useCallback(async () => {
    if (!selfieValide || envoiEnCours || !brouillon.selfie) {
      return;
    }
    setEnvoiEnCours(true);
    setErreurEnvoi(null);

    try {
      // 1. Numéro de dossier et code de suivi : créés une seule fois.
      let numeroDossier = brouillon.numero_dossier;
      let codeSuivi = brouillon.code_suivi;

      if ((!numeroDossier || !codeSuivi) && brouillon.categorie_id) {
        const creation = await candidateApi.creerDemande({
          identite: {
            nom: brouillon.identite.nom.trim(),
            prenom: brouillon.identite.prenom.trim(),
            date_naissance: brouillon.identite.date_naissance,
            cin: brouillon.identite.cin.trim(),
            telephone: brouillon.identite.telephone.trim(),
            email: brouillon.identite.email.trim(),
            adresse: brouillon.identite.adresse.trim(),
          },
          categorie_id: brouillon.categorie_id,
        });
        if (!creation.ok) {
          setErreurEnvoi(messageErreurEnvoi(creation.erreur));
          return;
        }
        numeroDossier = creation.valeur.numero_dossier;
        codeSuivi = creation.valeur.code_suivi;
        await definirIdentifiantsDossier(numeroDossier, codeSuivi);
      }

      if (!numeroDossier || !codeSuivi || !brouillon.categorie_id) {
        setErreurEnvoi("Dossier introuvable : revenez au récapitulatif et réessayez.");
        return;
      }

      // 2. Envoi du dossier complet AVEC le selfie (contrôle revalidé côté serveur).
      const envoiDemande = await candidateApi.soumettreDemande({
        numero_dossier: numeroDossier,
        code_suivi: codeSuivi,
        categorie_id: brouillon.categorie_id,
        pieces: brouillon.pieces,
        oeuvres: brouillon.oeuvres,
        selfie: brouillon.selfie,
      });
      if (!envoiDemande.ok) {
        setErreurEnvoi(messageErreurEnvoi(envoiDemande.erreur));
        return;
      }

      // 3. Historique local (l'échec d'écriture n'annule pas l'envoi confirmé).
      const historique = await enregistrerDossierSoumis({
        numero_dossier: envoiDemande.valeur.numero_dossier,
        code_suivi: envoiDemande.valeur.code_suivi,
        statut: envoiDemande.valeur.statut,
        date_soumission: envoiDemande.valeur.date_soumission,
        delai_indicatif_heures: envoiDemande.valeur.delai_indicatif_heures,
      });
      if (!historique.ok) {
        console.warn('[VerifIdentite] Historique local non enregistré :', historique.erreur.message);
      }

      // 4. Brouillon effacé seulement après confirmation, puis écran de confirmation.
      await reinitialiserBrouillon();

      router.replace({
        pathname: '/(adhesion)/confirmation',
        params: {
          numero_dossier: envoiDemande.valeur.numero_dossier,
          code_suivi: envoiDemande.valeur.code_suivi,
          statut: envoiDemande.valeur.statut,
          delai_indicatif_heures: String(envoiDemande.valeur.delai_indicatif_heures),
          date_soumission: envoiDemande.valeur.date_soumission,
        },
      });
    } catch (erreur) {
      console.warn('[VerifIdentite] Envoi impossible :', erreur);
      setErreurEnvoi(
        "L'envoi de votre demande a échoué. Vérifiez votre connexion Internet puis réessayez.",
      );
    } finally {
      setEnvoiEnCours(false);
    }
  }, [
    brouillon,
    definirIdentifiantsDossier,
    envoiEnCours,
    reinitialiserBrouillon,
    selfieValide,
  ]);

  /* --------------------------------------------------------------- Rendu */

  const confSelfie = pieceImportationDepuisType('SELFIE_CIN');

  if (!estCharge) {
    return (
      <ScreenContainer titre="Vérification d’identité" sousTitre="Demande d’adhésion">
        <StepProgress etapeCourante={6} />
        <LoadingState message="Chargement de votre dossier…" />
      </ScreenContainer>
    );
  }

  // Écran verrouillé : tant qu'un formulaire ou une pièce manque, la vérification
  // n'est pas accessible. La liste précise des manquants est affichée avec un
  // lien vers chaque élément.
  if (!dossierComplet) {
    return (
      <ScreenContainer titre="Vérification d’identité" sousTitre="Demande d’adhésion">
        <StepProgress etapeCourante={6} />

        <InfoBanner
          variante="pending"
          titre="Vérification verrouillée"
          message="Le selfie de vérification n'est possible qu'une fois tous les formulaires complétés et toutes les pièces importées. Voici ce qui manque encore :"
        />

        <View className="mt-4 gap-3">
          {manques.map((element, index) => (
            <Pressable
              key={`${element.route}-${index}`}
              accessibilityRole="button"
              accessibilityLabel={`${element.libelle} — y accéder`}
              onPress={() =>
                element.params
                  ? router.push({ pathname: element.route as never, params: element.params })
                  : router.push(element.route as never)
              }
              className="min-h-12 flex-row items-center rounded-2xl border border-omda-borderGray bg-omda-white p-4"
            >
              <Icone nom="circle-exclamation" taille={18} classeCouleur="text-status-pending" />
              <View className="ml-3 flex-1">
                <Text className="text-sm font-semibold text-omda-black">{element.libelle}</Text>
                <Text className="mt-0.5 text-xs text-omda-textGray">{element.detail}</Text>
              </View>
              <Icone nom="chevron-right" taille={16} classeCouleur="text-omda-textGray" />
            </Pressable>
          ))}
        </View>

        <View className="mt-8">
          <Button
            libelle="Retour au récapitulatif"
            variante="secondary"
            pleineLargeur
            onPress={() => router.back()}
          />
        </View>
      </ScreenContainer>
    );
  }

  // Écran déverrouillé : consigne avant la prise, capture/import, contrôles, envoi.
  return (
    <ScreenContainer titre="Vérification d’identité" sousTitre="Demande d’adhésion">
      <StepProgress etapeCourante={6} />

      <View className="rounded-2xl border border-omda-borderGray bg-omda-white p-4">
        <View className="flex-row items-center">
          <Icone nom="circle-check" taille={18} classeCouleur="text-status-success" />
          <Text className="ml-2 flex-1 text-sm font-semibold text-omda-black">
            Dossier complet : il ne reste que le selfie de vérification.
          </Text>
        </View>
      </View>

      {/* Consigne affichée AVANT la prise */}
      <View className="mt-5 rounded-2xl border border-omda-borderGray bg-omda-white p-4">
        <Text className="text-base font-bold text-omda-black">Consigne avant la photo</Text>
        <Text className="mt-2 text-sm text-omda-textGray">
          Tenez votre CIN bien visible à la main, en plus de votre visage. Prenez la photo dans un
          lieu éclairé, sans bouger, le visage et la CIN nets et lisibles.
        </Text>
      </View>

      <View className="mt-4 gap-3">
        <Button
          libelle="Prendre le selfie (caméra)"
          icone={confSelfie.icone as NomIcone}
          pleineLargeur
          onPress={() => void depuisCamera()}
        />
        <Button
          libelle="Importer depuis la galerie"
          icone="image"
          variante="secondary"
          pleineLargeur
          onPress={() => void depuisGalerie()}
        />
      </View>

      {/* État du selfie : manquant / envoi en cours / importé / erreur avec reprise */}
      <View className="mt-4">
        <UploadTile
          libelle={confSelfie.libelle}
          icone={confSelfie.icone as NomIcone}
          obligatoire
          statut={envoi.statut}
          nomFichier={envoi.depose ? envoi.depose.chemin_stockage.split('/').pop() : undefined}
          progression={envoi.progression}
          message={
            envoi.statut === 'erreur'
              ? envoi.erreur ?? MESSAGE_SELFI_ENVOI_ECHEC
              : envoi.statut === 'reussi'
                ? 'Selfie importé. Un agent OMDA le vérifiera au back-office.'
                : envoi.statut === 'enCours'
                  ? 'Envoi en cours : ne quittez pas cet écran.'
                  : confSelfie.aide
          }
          onSelectionner={() => void depuisCamera()}
          onReessayer={() => void reessayer()}
          onRemplacer={() => void depuisCamera()}
          onSupprimer={supprimerSelfie}
        />
      </View>

      {selfieInvalide && envoi.statut !== 'reussi' ? (
        <View className="mt-4">
          <InfoBanner
            variante="error"
            titre="Selfie à refaire"
            message="Votre dossier a changé depuis le selfie : celui-ci a été retiré. Reprenez le selfie avant l'envoi."
          />
        </View>
      ) : null}

      {/* Aucune reconnaissance faciale : transparence pour le candidat */}
      <View className="mt-4">
        <InfoBanner
          variante="info"
          titre="Pas de reconnaissance faciale"
          message="L'application ne compare aucun visage automatiquement. Votre selfie est simplement transmis : c'est un agent OMDA qui l'examine manuellement au back-office pour vérifier votre identité."
        />
      </View>

      {/* Erreur d'envoi (reprise sans perte des autres données) */}
      {erreurEnvoi ? (
        <View className="mt-4">
          <InfoBanner
            variante="error"
            titre="Envoi impossible"
            message={erreurEnvoi}
            actionLibelle="Réessayer"
            onAction={() => void envoyer()}
          />
        </View>
      ) : null}

      <View className="mt-8 gap-3">
        <Button
          libelle="Envoyer ma demande"
          icone="paper-plane"
          pleineLargeur
          // Accessible uniquement après un selfie importé et valide (dossier inchangé).
          desactive={!selfieValide}
          chargement={envoiEnCours}
          onPress={() => void envoyer()}
        />
        <Button
          libelle="Retour au récapitulatif"
          variante="secondary"
          pleineLargeur
          onPress={() => router.back()}
        />
      </View>
    </ScreenContainer>
  );
}
