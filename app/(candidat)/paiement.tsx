import * as Clipboard from 'expo-clipboard';
import * as DocumentPicker from 'expo-document-picker';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Text, View } from 'react-native';

import {
  AmountCard,
  Button,
  EmptyState,
  ErrorState,
  Icone,
  InfoBanner,
  LoadingState,
  ScreenContainer,
  SelectField,
  StatusPill,
  TextField,
  UploadTile,
  formaterMontantAriary,
  type StatutPill,
  type StatutUpload,
} from '../../src/components/ui';
import {
  TAILLE_MAX_FICHIER_MO,
  TAILLE_MAX_FICHIER_OCTETS,
  TYPES_MIME_AUTORISES,
  type BucketStockage,
  type ModePaiement,
  type OperateurPaiement,
  type StatutPaiement,
  type TypeMime,
  type TypePaiement,
} from '../../src/models';
import type {
  ErreurApp,
  EtatPaiementCandidat,
  FichierDepose,
  OptionsPaiementCandidat,
} from '../../src/services/contracts';
import { obtenirHistoriqueDossiers } from '../../src/services/local/historiqueDossiers';
import { mockCandidateApi } from '../../src/services/mocks';
import { colors } from '../../src/theme/colors';

/**
 * Écran N — Paiement candidat (public, sans menu).
 *
 * Règles impératives appliquées ici :
 * - montant, modes, opérateurs et coordonnées viennent EXCLUSIVEMENT du service ;
 * - aucun succès n'est annoncé avant la confirmation du serveur
 *   (`paiement.statut = 'REUSSI'` obtenu par polling) ;
 * - Mobile Money : confirmation automatique (polling) ; virement : statut
 *   `EN_ATTENTE_VERIFICATION_AGENT` (jamais de succès immédiat, vérification
 *   humaine de la preuve) ;
 * - le bouton « Payer » reste neutre (`secondary`) : aucun vert `status-success`
 *   n'est affiché tant que le paiement n'est pas confirmé.
 */

/* -------------------------------------------------------------- Constantes */

/** Bucket de destination de la preuve de virement (JPEG, PNG, PDF). */
const BUCKET_PREUVES: BucketStockage = 'preuves';

/** Formats acceptés pour la preuve de virement (rappelés dans les messages). */
const LIBELLE_FORMATS_PREUVE = 'JPEG, PNG ou PDF';

/** Préfixe international imposé à tous les numéros Mobile Money. */
const PREFIXE_TELEPHONE = '+261';

/** Longueur minimale d'un numéro valide (`+261` + 9 chiffres). */
const LONGUEUR_MIN_NUMERO = PREFIXE_TELEPHONE.length + 9;

/** Intervalle entre deux interrogations du statut (polling Mobile Money). */
const INTERVALLE_POLLING_MS = 2500;

/** Durée maximale d'attente d'une confirmation de l'opérateur. */
const DELAI_MAX_POLLING_MS = 120000;

/** Statuts pour lesquels le serveur ne changera plus rien (succès ou échec). */
const STATUTS_FINAUX: StatutPaiement[] = [
  'REUSSI',
  'REJETE',
  'ECHEC_AUTRE',
  'ECHEC_SOLDE_INSUFFISANT',
];

/** Objet affiché pour chaque type de paiement (le montant vient du service). */
const OBJETS_PAIEMENT: Record<TypePaiement, string> = {
  ADHESION: 'Frais d’adhésion',
  DEPOT_OEUVRE: 'Frais de dépôt d’œuvre',
  COTISATION: 'Cotisation annuelle',
};

/** Messages distincts imposés pour chaque issue défavorable du paiement. */
const MESSAGES_ECHEC: Partial<Record<StatutPaiement, { titre: string; message: string }>> = {
  ECHEC_SOLDE_INSUFFISANT: {
    titre: 'Solde insuffisant',
    message:
      'Votre compte Mobile Money ne dispose pas d’un solde suffisant pour régler ces frais. Rechargez votre compte ou utilisez un autre numéro, puis relancez le paiement.',
  },
  ECHEC_AUTRE: {
    titre: 'Paiement non abouti',
    message:
      'L’opérateur n’a pas pu confirmer votre paiement. Aucun débit n’a été confirmé : vous pouvez relancer le paiement.',
  },
  REJETE: {
    titre: 'Paiement rejeté',
    message:
      'Vous avez refusé ou annulé la demande de paiement sur votre téléphone. Aucun montant n’a été débité. Vous pouvez relancer le paiement.',
  },
};

/* ------------------------------------------------------------- Utilitaires */

type EtatEcran = 'chargement' | 'erreur' | 'vide' | 'contenu';

/** Fichier retenu localement avant son dépôt (preuve de virement). */
type FichierSelectionne = {
  uri: string;
  nom: string;
  mime_type: TypeMime;
  taille_octets: number;
};

/** Suivi du dépôt de la preuve de virement. */
type EnvoiPreuve = {
  statut: StatutUpload;
  progression: number;
  selection: FichierSelectionne | null;
  depose: FichierDepose | null;
  erreur: string | null;
};

const PREUVE_VIDE: EnvoiPreuve = {
  statut: 'vide',
  progression: 0,
  selection: null,
  depose: null,
  erreur: null,
};

/** Libellés des statuts de paiement (le vert = succès confirmé uniquement). */
const STATUTS_PAIEMENT_AFFICHES: Record<StatutPaiement, { variante: StatutPill; libelle: string }> = {
  INITIE: { variante: 'pending', libelle: 'Paiement initié' },
  EN_ATTENTE_CONFIRMATION: { variante: 'pending', libelle: 'Attente de confirmation' },
  EN_ATTENTE_PREUVE: { variante: 'pending', libelle: 'Preuve de virement attendue' },
  EN_ATTENTE_VERIFICATION_AGENT: { variante: 'pending', libelle: 'Vérification par un agent' },
  REUSSI: { variante: 'success', libelle: 'Paiement confirmé' },
  ECHEC_SOLDE_INSUFFISANT: { variante: 'error', libelle: 'Solde insuffisant' },
  ECHEC_AUTRE: { variante: 'error', libelle: 'Paiement non abouti' },
  REJETE: { variante: 'error', libelle: 'Paiement rejeté' },
};

/** Extensions reconnues lorsque le système ne fournit pas de type MIME. */
const MIME_PAR_EXTENSION: Record<string, TypeMime> = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  pdf: 'application/pdf',
};

const MIMES_PREUVES: readonly string[] = [...TYPES_MIME_AUTORISES.preuves];

function estMimePreuve(valeur: string): valeur is TypeMime {
  return MIMES_PREUVES.includes(valeur);
}

/** Déduit un type MIME autorisé à partir du type système, sinon de l'extension. */
function deduireMime(nomFichier: string, mimeFourni: string | null | undefined): TypeMime | null {
  const propre = (mimeFourni ?? '').trim().toLowerCase();
  const normalise = propre === 'image/jpg' ? 'image/jpeg' : propre;
  if (estMimePreuve(normalise)) {
    return normalise;
  }
  const extension = nomFichier.split('.').pop()?.trim().toLowerCase() ?? '';
  return MIME_PAR_EXTENSION[extension] ?? null;
}

function parametreTexte(valeur: string | string[] | undefined): string {
  if (typeof valeur === 'string') return valeur.trim();
  if (Array.isArray(valeur) && valeur.length > 0 && typeof valeur[0] === 'string') {
    return valeur[0].trim();
  }
  return '';
}

function traduireErreur(erreur: ErreurApp): string {
  if (erreur.type === 'metier') return erreur.message;
  if (erreur.type === 'reseau') {
    return 'Impossible de joindre le serveur OMDA. Vérifiez votre connexion Internet puis réessayez.';
  }
  return 'Le service de paiement est momentanément indisponible. Veuillez réessayer dans quelques instants.';
}

/** Message affiché lorsqu'un envoi de fichier échoue. */
function messageErreurEnvoi(erreur: ErreurApp): string {
  if (erreur.type === 'metier') return erreur.message;
  if (erreur.type === 'reseau') {
    return 'La connexion a été interrompue pendant l’envoi de la preuve. Vérifiez votre réseau puis réessayez.';
  }
  return 'Le dépôt de la preuve a échoué (service indisponible). Veuillez réessayer.';
}

/** Numéro Mobile Money au format international `+261…` (chiffres uniquement). */
function numeroValide(numero: string): boolean {
  const propre = numero.trim().replace(/[\s.-]/g, '');
  if (!propre.startsWith(PREFIXE_TELEPHONE)) return false;
  if (propre.length < LONGUEUR_MIN_NUMERO) return false;
  return /^\+[0-9]+$/.test(propre);
}

function formaterDateHeure(dateIso: string | null): string {
  if (!dateIso) return '';
  const date = new Date(dateIso);
  if (Number.isNaN(date.getTime())) return '';
  const jour = String(date.getDate()).padStart(2, '0');
  const mois = String(date.getMonth() + 1).padStart(2, '0');
  const annee = date.getFullYear();
  const heures = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${jour}/${mois}/${annee} à ${heures}:${minutes}`;
}

function isStatutFinal(statut: StatutPaiement): boolean {
  return STATUTS_FINAUX.includes(statut);
}


/* ------------------------------------------------------------------ Écran */

export default function PaiementScreen() {
  const parametres = useLocalSearchParams<{
    numero_dossier?: string;
    code_suivi?: string;
  }>();

  const [numeroDossier, setNumeroDossier] = useState('');
  const [codeSuivi, setCodeSuivi] = useState('');

  const [etat, setEtat] = useState<EtatEcran>('chargement');
  const [erreurChargement, setErreurChargement] = useState<string | null>(null);
  const [options, setOptions] = useState<OptionsPaiementCandidat | null>(null);

  const [modeChoisi, setModeChoisi] = useState<ModePaiement | null>(null);
  const [operateurChoisi, setOperateurChoisi] = useState<OperateurPaiement | null>(null);
  const [numeroTelephone, setNumeroTelephone] = useState('');
  const [erreurNumero, setErreurNumero] = useState<string | null>(null);

  const [paiement, setPaiement] = useState<EtatPaiementCandidat | null>(null);
  const [initiationEnCours, setInitiationEnCours] = useState(false);
  const [erreurInitiation, setErreurInitiation] = useState<string | null>(null);
  const [delaiDepasse, setDelaiDepasse] = useState(false);
  const [verificationEnCours, setVerificationEnCours] = useState(false);
  const [erreurVerification, setErreurVerification] = useState<string | null>(null);

  const [preuve, setPreuve] = useState<EnvoiPreuve>(PREUVE_VIDE);
  const [referenceVirement, setReferenceVirement] = useState('');
  const [declarationEnCours, setDeclarationEnCours] = useState(false);
  const [erreurPreuve, setErreurPreuve] = useState<string | null>(null);
  const [copieReussie, setCopieReussie] = useState(false);

  /** Début de la fenêtre d'attente du polling (non réinitialisé à chaque poll). */
  const debutPollingRef = useRef<number | null>(null);
  /** Vrai tant que l'écran est affiché (aucun `setState` après démontage). */
  const monteRef = useRef(true);

  useEffect(() => {
    monteRef.current = true;
    return () => {
      monteRef.current = false;
    };
  }, []);

  /* ----------------------------------------------- Chargement (4 états) */

  const chargerOptions = useCallback(async (numero: string, code: string) => {
    const numeroNettoye = numero.trim().toUpperCase();
    const codeNettoye = code.trim().toUpperCase();

    if (!numeroNettoye || !codeNettoye) {
      setPaiement(null);
      setOptions(null);
      setErreurChargement(
        'Les informations de votre dossier sont incomplètes. Revenez au suivi de votre demande pour relancer le paiement.',
      );
      setEtat('erreur');
      return;
    }

    setEtat('chargement');
    setErreurChargement(null);

    const reponse = await mockCandidateApi.obtenirOptionsPaiement({
      numero_dossier: numeroNettoye,
      code_suivi: codeNettoye,
    });

    if (!monteRef.current) return;

    if (!reponse.ok) {
      setOptions(null);
      setErreurChargement(traduireErreur(reponse.erreur));
      setEtat('erreur');
      return;
    }

    setOptions(reponse.valeur);
    setModeChoisi(reponse.valeur.modes[0]?.mode ?? null);
    setEtat(reponse.valeur.modes.length > 0 ? 'contenu' : 'vide');
  }, []);

  useEffect(() => {
    const numeroParam = parametreTexte(parametres.numero_dossier);
    const codeParam = parametreTexte(parametres.code_suivi);

    if (numeroParam && codeParam) {
      setNumeroDossier(numeroParam);
      setCodeSuivi(codeParam);
      void chargerOptions(numeroParam, codeParam);
      return;
    }

    // Repli : dernier dossier envoyé conservé sur le téléphone (écran L).
    void (async () => {
      const historique = await obtenirHistoriqueDossiers();
      if (!monteRef.current) return;
      const dernier = historique.ok ? historique.valeur[0] : undefined;
      const numero = dernier?.numero_dossier ?? '';
      const code = dernier?.code_suivi ?? '';
      setNumeroDossier(numero);
      setCodeSuivi(code);
      await chargerOptions(numero, code);
    })();
  }, [chargerOptions, parametres.code_suivi, parametres.numero_dossier]);

  /* ------------------------------ Polling Mobile Money (serveur uniquement) */

  const referenceCourante = paiement?.reference_interne ?? null;
  const statutCourant = paiement?.statut ?? null;
  const modeCourant = paiement?.mode ?? null;

  useEffect(() => {
    if (!referenceCourante || !statutCourant) return;
    if (modeCourant !== 'MOBILE_MONEY') return;
    if (isStatutFinal(statutCourant) || delaiDepasse) return;

    let annule = false;
    let minuteur: ReturnType<typeof setTimeout> | null = null;

    const interroger = async () => {
      if (annule || !monteRef.current) return;

      const debut = debutPollingRef.current ?? Date.now();
      if (Date.now() - debut > DELAI_MAX_POLLING_MS) {
        if (monteRef.current) setDelaiDepasse(true);
        return;
      }

      const reponse = await mockCandidateApi.obtenirEtatPaiement(referenceCourante);
      if (annule || !monteRef.current) return;

      if (reponse.ok) {
        setPaiement(reponse.valeur);
      }
      // Panne réseau/serveur : l'application n'invente jamais un succès, elle réinterroge.
      minuteur = setTimeout(() => void interroger(), INTERVALLE_POLLING_MS);
    };

    minuteur = setTimeout(() => void interroger(), INTERVALLE_POLLING_MS);

    return () => {
      annule = true;
      if (minuteur) clearTimeout(minuteur);
    };
  }, [delaiDepasse, modeCourant, referenceCourante, statutCourant]);


  /* ------------------------------------------------------- Valeurs dérivées */

  const modeSelectionne = useMemo(() => {
    if (!options || !modeChoisi) return null;
    return options.modes.find((mode) => mode.mode === modeChoisi) ?? null;
  }, [modeChoisi, options]);

  const operateursDisponibles = useMemo(() => {
    if (!modeSelectionne) return [];
    return modeSelectionne.operateurs.map((operateur) => ({
      valeur: operateur.code,
      libelle: operateur.libelle,
    }));
  }, [modeSelectionne]);

  const coordonneesDisponibles = useMemo(
    () => modeSelectionne?.coordonnees_bancaires ?? [],
    [modeSelectionne],
  );

  const infoStatutPaiement = paiement ? STATUTS_PAIEMENT_AFFICHES[paiement.statut] : null;
  const paiementConfirme = paiement?.statut === 'REUSSI';
  const messageEchec = paiement ? (MESSAGES_ECHEC[paiement.statut] ?? null) : null;
  const paiementEnAttente = Boolean(paiement) && !paiementConfirme && !messageEchec && !delaiDepasse;

  /** Coordonnées bancaires copiables (valeurs fournies par le service). */
  const texteCoordonnees = useMemo(
    () =>
      coordonneesDisponibles
        .map((coordonnees) =>
          [
            `Banque : ${coordonnees.banque}`,
            `Titulaire : ${coordonnees.titulaire}`,
            `Numéro de compte : ${coordonnees.numero_compte}`,
            coordonnees.iban ? `IBAN : ${coordonnees.iban}` : '',
            coordonnees.swift ? `SWIFT : ${coordonnees.swift}` : '',
            `Référence à indiquer : ${numeroDossier}`,
          ]
            .filter((ligne) => ligne.length > 0)
            .join('\n'),
        )
        .join('\n\n'),
    [coordonneesDisponibles, numeroDossier],
  );

  /* ------------------------------------------------------------- Actions */

  const retourSuivi = useCallback(() => {
    router.push({
      pathname: '/(candidat)/suivi',
      params: { numero_dossier: numeroDossier, code_suivi: codeSuivi },
    });
  }, [codeSuivi, numeroDossier]);

  const ouvrirConfirmation = useCallback(() => {
    if (!paiement) return;
    router.push({
      pathname: '/(candidat)/succes-adhesion',
      params: {
        numero_dossier: numeroDossier,
        code_suivi: codeSuivi,
        reference_interne: paiement.reference_interne,
      },
    });
  }, [codeSuivi, numeroDossier, paiement]);

  /** Après un échec : efface le paiement suivi pour proposer une nouvelle tentative. */
  const relancerPaiement = useCallback(() => {
    debutPollingRef.current = null;
    setPaiement(null);
    setDelaiDepasse(false);
    setErreurInitiation(null);
    setErreurVerification(null);
    setErreurPreuve(null);
    setPreuve(PREUVE_VIDE);
    setReferenceVirement('');
  }, []);

  /** Mobile Money : initiation puis confirmation uniquement via le serveur. */
  const payerMobileMoney = useCallback(async () => {
    if (!numeroDossier || !codeSuivi) {
      setErreurInitiation(
        'Les informations de votre dossier sont incomplètes. Revenez au suivi de votre demande.',
      );
      return;
    }
    if (modeSelectionne?.mode !== 'MOBILE_MONEY') return;
    if (!operateurChoisi) {
      setErreurInitiation('Sélectionnez l’opérateur Mobile Money qui sera débité.');
      return;
    }
    if (!numeroValide(numeroTelephone)) {
      setErreurNumero(
        'Indiquez le numéro Mobile Money au format international, par exemple +261340000001.',
      );
      return;
    }

    const numeroNettoye = numeroTelephone.trim().replace(/[\s.-]/g, '');
    setErreurNumero(null);
    setErreurInitiation(null);
    setDelaiDepasse(false);
    setInitiationEnCours(true);

    const reponse = await mockCandidateApi.initierPaiement({
      numero_dossier: numeroDossier,
      code_suivi: codeSuivi,
      mode: 'MOBILE_MONEY',
      operateur: operateurChoisi,
      numero_telephone: numeroNettoye,
    });

    if (!monteRef.current) return;
    setInitiationEnCours(false);

    if (!reponse.ok) {
      setErreurInitiation(traduireErreur(reponse.erreur));
      return;
    }

    // Statut `INITIE` : la confirmation (ou l'échec) viendra du serveur (polling).
    debutPollingRef.current = Date.now();
    setPaiement(reponse.valeur);
  }, [codeSuivi, modeSelectionne, numeroDossier, numeroTelephone, operateurChoisi]);

  /** Virement : initiation (le paiement reste à `EN_ATTENTE_PREUVE`). */
  const initierVirement = useCallback(async () => {
    if (!numeroDossier || !codeSuivi) {
      setErreurInitiation(
        'Les informations de votre dossier sont incomplètes. Revenez au suivi de votre demande.',
      );
      return;
    }
    if (modeSelectionne?.mode !== 'VIREMENT_BANCAIRE') return;

    setErreurInitiation(null);
    setInitiationEnCours(true);

    const reponse = await mockCandidateApi.initierPaiement({
      numero_dossier: numeroDossier,
      code_suivi: codeSuivi,
      mode: 'VIREMENT_BANCAIRE',
    });

    if (!monteRef.current) return;
    setInitiationEnCours(false);

    if (!reponse.ok) {
      setErreurInitiation(traduireErreur(reponse.erreur));
      return;
    }

    setPaiement(reponse.valeur);
  }, [codeSuivi, modeSelectionne, numeroDossier]);

  /** Interrogation manuelle du statut (virement, ou après un délai dépassé). */
  const verifierStatut = useCallback(async () => {
    if (!paiement) return;

    setVerificationEnCours(true);
    setErreurVerification(null);

    const reponse = await mockCandidateApi.obtenirEtatPaiement(paiement.reference_interne);

    if (!monteRef.current) return;
    setVerificationEnCours(false);

    if (!reponse.ok) {
      setErreurVerification(traduireErreur(reponse.erreur));
      return;
    }

    debutPollingRef.current = Date.now();
    setDelaiDepasse(false);
    setPaiement(reponse.valeur);
  }, [paiement]);


  /* ------------------------------------------------ Preuve de virement */

  /** Dépôt de la preuve : URL signée (bucket `preuves`) puis téléversement suivi. */
  const televerserPreuve = useCallback(
    async (selection: FichierSelectionne) => {
      if (!paiement) return;

      setErreurPreuve(null);
      setPreuve({ statut: 'enCours', progression: 0, selection, depose: null, erreur: null });

      const urlSignee = await mockCandidateApi.obtenirUrlTeleversementPreuve({
        paiement_id: paiement.paiement_id,
        nom_fichier: selection.nom,
        mime_type: selection.mime_type,
        taille_octets: selection.taille_octets,
      });

      if (!monteRef.current) return;

      if (!urlSignee.ok) {
        setPreuve({
          statut: 'erreur',
          progression: 0,
          selection,
          depose: null,
          erreur: messageErreurEnvoi(urlSignee.erreur),
        });
        return;
      }

      const envoi = await mockCandidateApi.televerserFichier(
        {
          bucket: BUCKET_PREUVES,
          chemin_stockage: urlSignee.valeur.chemin_stockage,
          fichier_uri: selection.uri,
          nom_fichier: selection.nom,
          mime_type: selection.mime_type,
          taille_octets: selection.taille_octets,
        },
        {
          onProgression: (pourcentage) => {
            if (!monteRef.current) return;
            setPreuve((precedent) => ({ ...precedent, progression: pourcentage }));
          },
        },
      );

      if (!monteRef.current) return;

      if (!envoi.ok) {
        setPreuve({
          statut: 'erreur',
          progression: 0,
          selection,
          depose: null,
          erreur: messageErreurEnvoi(envoi.erreur),
        });
        return;
      }

      setPreuve({
        statut: 'reussi',
        progression: 100,
        selection,
        depose: envoi.valeur,
        erreur: null,
      });
    },
    [paiement],
  );

  /** Sélection du justificatif : formats JPEG/PNG/PDF et 20 Mo contrôlés avant envoi. */
  const selectionnerPreuve = useCallback(async () => {
    try {
      const resultat = await DocumentPicker.getDocumentAsync({
        type: [...TYPES_MIME_AUTORISES.preuves],
        multiple: false,
        copyToCacheDirectory: true,
      });

      if (resultat.canceled) {
        // Annulation par l'utilisateur : la saisie en cours est conservée.
        return;
      }

      const actif = resultat.assets[0];
      if (!actif) return;

      const nom = actif.name ?? 'preuve-virement';
      const mime = deduireMime(nom, actif.mimeType);
      const taille = actif.size ?? 0;

      if (!mime) {
        setPreuve({
          statut: 'erreur',
          progression: 0,
          selection: null,
          depose: null,
          erreur: `Format non accepté : utilisez ${LIBELLE_FORMATS_PREUVE}.`,
        });
        return;
      }

      if (taille > TAILLE_MAX_FICHIER_OCTETS) {
        setPreuve({
          statut: 'erreur',
          progression: 0,
          selection: null,
          depose: null,
          erreur: `Le fichier dépasse la taille maximale de ${TAILLE_MAX_FICHIER_MO} Mo.`,
        });
        return;
      }

      await televerserPreuve({ uri: actif.uri, nom, mime_type: mime, taille_octets: taille });
    } catch (erreur) {
      console.warn('[Paiement] Sélection de la preuve impossible :', erreur);
      if (!monteRef.current) return;
      setPreuve({
        statut: 'erreur',
        progression: 0,
        selection: null,
        depose: null,
        erreur: 'La sélection du fichier a échoué. Veuillez réessayer.',
      });
    }
  }, [televerserPreuve]);

  /** Reprise après une coupure : relance l'envoi retenu, sinon rouvre le sélecteur. */
  const reessayerPreuve = useCallback(() => {
    if (preuve.selection) {
      void televerserPreuve(preuve.selection);
      return;
    }
    void selectionnerPreuve();
  }, [preuve.selection, selectionnerPreuve, televerserPreuve]);

  const supprimerPreuve = useCallback(() => {
    setPreuve(PREUVE_VIDE);
    setErreurPreuve(null);
  }, []);

  /** Déclaration de la preuve : statut final `EN_ATTENTE_VERIFICATION_AGENT`. */
  const declarerPreuve = useCallback(async () => {
    if (!paiement || !preuve.depose) return;

    setDeclarationEnCours(true);
    setErreurPreuve(null);

    const reponse = await mockCandidateApi.declarerPreuveVirement({
      paiement_id: paiement.paiement_id,
      chemin_stockage: preuve.depose.chemin_stockage,
      mime_type: preuve.depose.mime_type,
      taille_octets: preuve.depose.taille_octets,
      reference_fournie: referenceVirement.trim().length > 0 ? referenceVirement.trim() : null,
    });

    if (!monteRef.current) return;
    setDeclarationEnCours(false);

    if (!reponse.ok) {
      setErreurPreuve(traduireErreur(reponse.erreur));
      return;
    }

    // Le serveur renvoie `EN_ATTENTE_VERIFICATION_AGENT` : jamais un succès immédiat.
    setPaiement(reponse.valeur);
  }, [paiement, preuve.depose, referenceVirement]);

  const copierCoordonnees = useCallback(async () => {
    if (!texteCoordonnees) return;
    await Clipboard.setStringAsync(texteCoordonnees);
    if (monteRef.current) setCopieReussie(true);
  }, [texteCoordonnees]);


  /* --------------------------------------------------------------- Rendu */

  return (
    <ScreenContainer titre="Paiement des frais" sousTitre="Dossier validé">
      {etat === 'chargement' ? <LoadingState message="Préparation de votre paiement…" /> : null}

      {etat === 'erreur' ? (
        <View className="gap-4">
          <ErrorState
            titre="Paiement indisponible"
            message={erreurChargement ?? 'Impossible de préparer votre paiement pour le moment.'}
            libelleAction="Réessayer"
            onReessayer={() => void chargerOptions(numeroDossier, codeSuivi)}
          />

          <Button
            libelle="Suivre ma demande"
            variante="secondary"
            icone="magnifying-glass"
            pleineLargeur
            onPress={retourSuivi}
          />
        </View>
      ) : null}

      {etat === 'vide' ? (
        <View className="gap-4">
          <EmptyState
            icone="money-bill-wave"
            titre="Aucun moyen de paiement proposé"
            message="Le serveur OMDA ne propose aucun moyen de paiement pour le moment. Vérifiez le suivi de votre demande puis réessayez plus tard."
            actionLibelle="Actualiser"
            onAction={() => void chargerOptions(numeroDossier, codeSuivi)}
          />

          <Button
            libelle="Suivre ma demande"
            variante="secondary"
            icone="magnifying-glass"
            pleineLargeur
            onPress={retourSuivi}
          />
        </View>
      ) : null}

      {etat === 'contenu' && options ? (
        <View className="gap-5">
          {/* Montant dû : fourni par le serveur, jamais modifiable */}
          <AmountCard
            objet={OBJETS_PAIEMENT[options.paiement_du.type]}
            montant={options.paiement_du.montant}
            mention="Montant officiel communiqué par le serveur OMDA."
            icone="money-bill-wave"
          />

          <View className="rounded-2xl border border-omda-borderGray bg-omda-white p-5">
            <Text className="text-xs font-semibold uppercase tracking-wider text-omda-textGray">
              Dossier concerné
            </Text>
            <Text selectable className="mt-1 text-lg font-bold text-omda-black">
              {numeroDossier}
            </Text>
            <Text className="mt-2 text-sm text-omda-textGray">
              Les frais affichés proviennent du serveur OMDA et ne peuvent pas être modifiés depuis
              l’application.
            </Text>
          </View>

          {/* Choix du mode : uniquement tant qu'aucun paiement n'est suivi */}
          {!paiement ? (
            <SelectField
              libelle="Mode de paiement"
              obligatoire
              options={options.modes.map((mode) => ({ valeur: mode.mode, libelle: mode.libelle }))}
              valeur={modeChoisi}
              onChangeValeur={(valeur) => {
                setModeChoisi(valeur as ModePaiement);
                setOperateurChoisi(null);
                setNumeroTelephone('');
                setErreurNumero(null);
                setErreurInitiation(null);
                setCopieReussie(false);
              }}
              aide="Liste fournie par le serveur : un moyen désactivé n’apparaît pas ici."
              libelleAucuneOption="Aucun mode de paiement disponible pour le moment."
            />
          ) : null}
          {/* Mobile Money : opérateur actif + numéro +261, puis « Payer » (neutre) */}
          {!paiement && modeSelectionne?.mode === 'MOBILE_MONEY' ? (
            <View className="gap-4 rounded-2xl border border-omda-borderGray bg-omda-white p-5">
              <View className="flex-row items-center">
                <Icone nom="mobile-screen-button" taille={18} classeCouleur="text-omda-textGray" />
                <Text className="ml-2 flex-1 text-base font-bold text-omda-black">
                  Paiement par Mobile Money
                </Text>
              </View>

              <Text className="text-sm text-omda-textGray">
                Choisissez votre opérateur puis indiquez le numéro qui sera débité. Vous validerez la
                demande sur votre téléphone.
              </Text>

              <SelectField
                libelle="Opérateur Mobile Money"
                obligatoire
                options={operateursDisponibles}
                valeur={operateurChoisi}
                onChangeValeur={(valeur) => {
                  setOperateurChoisi(valeur as OperateurPaiement);
                  setErreurInitiation(null);
                }}
                aide="Seuls les opérateurs actifs sont proposés par le serveur."
                libelleAucuneOption="Aucun opérateur Mobile Money n’est disponible pour le moment."
              />

              <TextField
                libelle="Numéro Mobile Money"
                obligatoire
                valeur={numeroTelephone}
                onChangeValeur={setNumeroTelephone}
                placeholder="+261340000001"
                aide="Numéro au format international, précédé de +261."
                erreur={erreurNumero ?? undefined}
                clavier="phone-pad"
              />

              <Button
                libelle="Payer"
                variante="secondary"
                icone="mobile-screen-button"
                pleineLargeur
                chargement={initiationEnCours}
                desactive={!operateurChoisi || numeroTelephone.trim().length === 0}
                onPress={() => void payerMobileMoney()}
              />

              {erreurInitiation ? (
                <InfoBanner variante="error" titre="Paiement non démarré" message={erreurInitiation} />
              ) : null}

              <InfoBanner
                variante="info"
                titre="Confirmation indispensable"
                message="Votre paiement ne sera considéré comme réussi qu’après la confirmation de l’opérateur. Aucun succès n’est annoncé à l’avance."
              />
            </View>
          ) : null}

          {/* Virement : coordonnées bancaires actives fournies par le service */}
          {modeSelectionne?.mode === 'VIREMENT_BANCAIRE' ? (
            <View className="gap-4">
              {coordonneesDisponibles.map((coordonnees) => (
                <View
                  key={coordonnees.id}
                  className="rounded-2xl border border-omda-borderGray bg-omda-white p-5"
                >
                  <View className="flex-row items-center">
                    <Icone nom="building-columns" taille={18} classeCouleur="text-omda-textGray" />
                    <Text className="ml-2 flex-1 text-base font-bold text-omda-black">
                      {coordonnees.banque}
                    </Text>
                  </View>

                  <Text selectable className="mt-3 text-base text-omda-black">
                    {`Titulaire : ${coordonnees.titulaire}`}
                  </Text>
                  <Text selectable className="mt-1 text-base text-omda-black">
                    {`Numéro de compte : ${coordonnees.numero_compte}`}
                  </Text>
                  {coordonnees.iban ? (
                    <Text selectable className="mt-1 text-base text-omda-black">
                      {`IBAN : ${coordonnees.iban}`}
                    </Text>
                  ) : null}
                  {coordonnees.swift ? (
                    <Text selectable className="mt-1 text-base text-omda-black">
                      {`SWIFT : ${coordonnees.swift}`}
                    </Text>
                  ) : null}
                  {coordonnees.instructions ? (
                    <Text className="mt-3 text-sm text-omda-textGray">
                      {coordonnees.instructions}
                    </Text>
                  ) : null}
                </View>
              ))}

              <Button
                libelle="Copier les coordonnées bancaires"
                variante="secondary"
                icone="clipboard"
                pleineLargeur
                onPress={() => void copierCoordonnees()}
              />

              {copieReussie ? (
                <InfoBanner
                  variante="info"
                  icone="clipboard-check"
                  titre="Coordonnées copiées"
                  message="Collez ces informations dans votre application bancaire pour effectuer le virement."
                />
              ) : null}

              {!paiement ? (
                <View className="gap-3">
                  <Button
                    libelle="J’ai effectué le virement"
                    variante="secondary"
                    icone="building-columns"
                    pleineLargeur
                    chargement={initiationEnCours}
                    onPress={() => void initierVirement()}
                  />

                  {erreurInitiation ? (
                    <InfoBanner
                      variante="error"
                      titre="Virement non enregistré"
                      message={erreurInitiation}
                    />
                  ) : null}

                  <InfoBanner
                    variante="info"
                    titre="Preuve obligatoire"
                    message="Après le virement, joignez la preuve (reçu ou capture) : elle sera vérifiée par un agent avant toute confirmation."
                  />
                </View>
              ) : null}
            </View>
          ) : null}


          {/* Suivi du paiement Mobile Money : statut fourni par le serveur (polling) */}
          {paiement && modeCourant === 'MOBILE_MONEY' && infoStatutPaiement ? (
            <View className="gap-4 rounded-2xl border border-omda-borderGray bg-omda-white p-5">
              <StatusPill statut={infoStatutPaiement.variante} libelle={infoStatutPaiement.libelle} />

              <Text className="text-base text-omda-black">
                {`Référence interne : ${paiement.reference_interne}`}
              </Text>
              <Text className="text-sm text-omda-textGray">
                {`Montant : ${formaterMontantAriary(paiement.montant)}`}
              </Text>
              {paiement.reference_externe ? (
                <Text className="text-sm text-omda-textGray">
                  {`Référence opérateur : ${paiement.reference_externe}`}
                </Text>
              ) : null}

              {paiementEnAttente ? (
                <View className="flex-row items-center">
                  <ActivityIndicator color={colors.status.pending} />
                  <Text className="ml-3 flex-1 text-base text-omda-black">
                    {paiement.instruction ?? 'En attente de la confirmation de l’opérateur…'}
                  </Text>
                </View>
              ) : null}

              {delaiDepasse ? (
                <View className="gap-3">
                  <InfoBanner
                    variante="pending"
                    titre="Délai d’attente dépassé"
                    message="L’opérateur n’a pas encore répondu dans le délai prévu. Aucun paiement n’est confirmé à ce stade : aucun débit n’est annoncé. Vous pouvez vérifier à nouveau ou relancer le paiement."
                    actionLibelle="Vérifier à nouveau"
                    onAction={() => void verifierStatut()}
                  />

                  {!paiementConfirme ? (
                    <Button
                      libelle="Relancer le paiement"
                      variante="secondary"
                      icone="arrows-rotate"
                      pleineLargeur
                      onPress={relancerPaiement}
                    />
                  ) : null}
                </View>
              ) : null}

              {erreurVerification ? (
                <InfoBanner
                  variante="error"
                  titre="Vérification impossible"
                  message={erreurVerification}
                  actionLibelle="Réessayer"
                  onAction={() => void verifierStatut()}
                />
              ) : null}

              {messageEchec ? (
                <InfoBanner
                  variante="error"
                  titre={messageEchec.titre}
                  message={
                    paiement.motif_echec
                      ? `${messageEchec.message} Motif transmis : ${paiement.motif_echec}`
                      : messageEchec.message
                  }
                  actionLibelle="Relancer le paiement"
                  onAction={relancerPaiement}
                />
              ) : null}

              {paiementConfirme ? (
                <BlocPaiementConfirme paiement={paiement} onVoirConfirmation={ouvrirConfirmation} />
              ) : null}
            </View>
          ) : null}


          {/* Virement : dépôt de la preuve — statut final EN_ATTENTE_VERIFICATION_AGENT */}
          {paiement && modeCourant === 'VIREMENT_BANCAIRE' ? (
            <View className="gap-4 rounded-2xl border border-omda-borderGray bg-omda-white p-5">
              <View className="flex-row items-center">
                <Icone nom="cloud-arrow-up" taille={18} classeCouleur="text-omda-textGray" />
                <Text className="ml-2 flex-1 text-base font-bold text-omda-black">
                  Preuve de virement
                </Text>
              </View>

              {paiement.statut === 'EN_ATTENTE_PREUVE' ? (
                <View className="gap-4">
                  <Text className="text-sm text-omda-textGray">
                    Joignez le reçu de votre virement : il sera transmis au serveur OMDA avec votre
                    dossier.
                  </Text>

                  <UploadTile
                    libelle="Preuve de virement"
                    obligatoire
                    statut={preuve.statut}
                    nomFichier={
                      preuve.selection?.nom ?? preuve.depose?.chemin_stockage.split('/').pop()
                    }
                    progression={preuve.progression}
                    message={
                      preuve.erreur ??
                      `Formats acceptés : ${LIBELLE_FORMATS_PREUVE} — ${TAILLE_MAX_FICHIER_MO} Mo maximum.`
                    }
                    onSelectionner={() => void selectionnerPreuve()}
                    onReessayer={reessayerPreuve}
                    onRemplacer={() => void selectionnerPreuve()}
                    onSupprimer={supprimerPreuve}
                  />

                  <TextField
                    libelle="Référence du virement (facultatif)"
                    valeur={referenceVirement}
                    onChangeValeur={setReferenceVirement}
                    placeholder="Ex. VIR-2026-000123"
                    aide="Référence figurant sur votre ordre de virement."
                    desactive={declarationEnCours}
                  />

                  <Button
                    libelle="Déposer ma preuve"
                    variante="secondary"
                    icone="paper-plane"
                    pleineLargeur
                    chargement={declarationEnCours}
                    desactive={preuve.statut !== 'reussi'}
                    onPress={() => void declarerPreuve()}
                  />

                  {erreurPreuve ? (
                    <InfoBanner
                      variante="error"
                      titre="Dépôt impossible"
                      message={erreurPreuve}
                    />
                  ) : null}

                  <InfoBanner
                    variante="info"
                    titre="Aucun succès immédiat"
                    message="Un virement n’est jamais confirmé automatiquement : la preuve est vérifiée par un agent de l’OMDA."
                  />
                </View>
              ) : (
                <View className="gap-4">
                  <InfoBanner
                    variante="pending"
                    titre="Preuve reçue"
                    message={
                      paiement.instruction ??
                      'Votre preuve de virement a été reçue : elle sera vérifiée par un agent.'
                    }
                  />

                  <Text className="text-sm text-omda-textGray">
                    La vérification est réalisée par un agent de l’OMDA. Vous serez informé par e-mail
                    dès que la décision sera prise.
                  </Text>

                  <Button
                    libelle="Vérifier le statut"
                    variante="secondary"
                    icone="arrows-rotate"
                    pleineLargeur
                    chargement={verificationEnCours}
                    onPress={() => void verifierStatut()}
                  />

                  {erreurVerification ? (
                    <InfoBanner
                      variante="error"
                      titre="Vérification impossible"
                      message={erreurVerification}
                    />
                  ) : null}

                  {messageEchec ? (
                    <InfoBanner
                      variante="error"
                      titre={messageEchec.titre}
                      message={messageEchec.message}
                      actionLibelle="Relancer le paiement"
                      onAction={relancerPaiement}
                    />
                  ) : null}

                  {paiementConfirme ? (
                    <BlocPaiementConfirme
                      paiement={paiement}
                      onVoirConfirmation={ouvrirConfirmation}
                    />
                  ) : null}
                </View>
              )}
            </View>
          ) : null}


          {/* Rappel de la règle de confirmation + navigation linéaire (sans menu) */}
          <View className="gap-3">
            <InfoBanner
              variante="info"
              titre="Confirmation par le serveur uniquement"
              message="L’OMDA ne considère un paiement comme réussi qu’après la confirmation du serveur (opérateur Mobile Money ou vérification d’un agent). L’application n’anticipe jamais un succès."
            />

            <Button
              libelle="Suivre ma demande"
              variante="secondary"
              icone="magnifying-glass"
              pleineLargeur
              onPress={retourSuivi}
            />

            <Button
              libelle="Retour à l’accueil"
              variante="secondary"
              pleineLargeur
              onPress={() => router.push('/(public)/accueil')}
            />
          </View>

        </View>
      ) : null}
    </ScreenContainer>
  );
}

/* ------------------------------------------------- Sous-composant local */

/** Bloc affiché UNIQUEMENT lorsque le serveur a confirmé `REUSSI`. */
function BlocPaiementConfirme({
  paiement,
  onVoirConfirmation,
}: {
  paiement: EtatPaiementCandidat;
  onVoirConfirmation: () => void;
}) {
  return (
    <View className="gap-4 rounded-xl border border-status-success bg-omda-white p-4">
      <View className="flex-row items-center">
        <Icone nom="circle-check" taille={22} classeCouleur="text-status-success" />
        <Text className="ml-3 flex-1 text-base font-bold text-status-success">
          Paiement confirmé.
        </Text>
      </View>

      <Text className="text-base text-omda-black">
        {paiement.date_confirmation
          ? `Confirmation reçue du serveur OMDA le ${formaterDateHeure(paiement.date_confirmation)}.`
          : 'Confirmation reçue du serveur OMDA.'}
      </Text>

      <Button
        libelle="Voir la confirmation"
        variante="secondary"
        icone="circle-check"
        pleineLargeur
        onPress={onVoirConfirmation}
      />
    </View>
  );
}

