import type {
  Categorie,
  DateISO,
  Documentation,
  HorodatageISO,
  OperateurMobileMoney,
  RoleUtilisateur,
  StatutDemande,
  StatutOeuvre,
  StatutPaiement,
  StatutUtilisateur,
  Tarif,
  TypeNotification,
  TypeOperationTarif,
  TypePiece,
  UUID,
} from '../../models';

/**
 * Fixtures du mode mock (« base de données » de test, lue par les 4 mocks).
 *
 * Toutes les valeurs sont réalistes et FIXES pour que `docs/DONNEES_TEST.md`
 * décrive exactement ce que l'app affiche. Aucune de ces valeurs ne doit être
 * recopiée dans l'UI : elles passent toujours par un service.
 */

/* ------------------------------------------------------------ Identifiants */

/** UUID v4 fixes des fixtures (données reproductibles d'un lancement à l'autre). */
export const IDS_TEST = {
  categorie_artiste_auteur: '11111111-1111-4111-8111-111111111111',
  categorie_ecrivain: '22222222-2222-4222-8222-222222222222',
  categorie_musicien: '33333333-3333-4333-8333-333333333333',
  categorie_arts_numeriques: '44444444-4444-4444-8444-444444444444',
  oeuvre_validee: 'a0000000-0000-4000-8000-000000000001',
  oeuvre_en_validation: 'a0000000-0000-4000-8000-000000000002',
  oeuvre_rejetee: 'a0000000-0000-4000-8000-000000000003',
  cotisation_2026: 'b0000000-0000-4000-8000-000000000001',
  cotisation_2025: 'b0000000-0000-4000-8000-000000000002',
} as const;

/* ----------------------------------------------------------- Référentiels */

/** Catégories d'adhésion : 3 actives + 1 inactive (qui ne doit JAMAIS s'afficher). */
export const CATEGORIES_TEST: Categorie[] = [
  {
    id: IDS_TEST.categorie_artiste_auteur,
    code: 'ARTISTE_AUTEUR',
    libelle: 'Artiste-auteur',
    description: 'Œuvres originales, créations plastiques et visuelles.',
    actif: true,
    created_at: '2026-01-05T06:00:00.000Z',
    updated_at: '2026-01-05T06:00:00.000Z',
  },
  {
    id: IDS_TEST.categorie_ecrivain,
    code: 'ECRIVAIN',
    libelle: 'Écrivain',
    description: 'Romans, poésie, essais et textes dramatiques.',
    actif: true,
    created_at: '2026-01-05T06:00:00.000Z',
    updated_at: '2026-01-05T06:00:00.000Z',
  },
  {
    id: IDS_TEST.categorie_musicien,
    code: 'MUSICIEN',
    libelle: 'Musicien',
    description: 'Compositions, interprétations et arrangements.',
    actif: true,
    created_at: '2026-01-05T06:00:00.000Z',
    updated_at: '2026-01-05T06:00:00.000Z',
  },
  {
    id: IDS_TEST.categorie_arts_numeriques,
    code: 'ARTS_NUMERIQUES',
    libelle: 'Arts numériques',
    description: 'Catégorie désactivée : ne doit pas apparaître dans l’application.',
    actif: false,
    created_at: '2026-01-05T06:00:00.000Z',
    updated_at: '2026-02-01T06:00:00.000Z',
  },
];

/** Grille tarifaire (montants en Ariary entiers — jamais codés en dur dans l'UI). */
export const TARIFS_TEST: Tarif[] = [
  {
    id: 'c0000000-0000-4000-8000-000000000001',
    type_operation: 'ADHESION',
    categorie_id: null,
    montant: 150000,
    devise: 'MGA',
    actif: true,
    date_debut: '2026-01-01',
    date_fin: null,
    created_at: '2026-01-01T05:00:00.000Z',
    updated_at: '2026-01-01T05:00:00.000Z',
  },
  {
    id: 'c0000000-0000-4000-8000-000000000002',
    type_operation: 'DEPOT_OEUVRE',
    categorie_id: null,
    montant: 50000,
    devise: 'MGA',
    actif: true,
    date_debut: '2026-01-01',
    date_fin: null,
    created_at: '2026-01-01T05:00:00.000Z',
    updated_at: '2026-01-01T05:00:00.000Z',
  },
  {
    id: 'c0000000-0000-4000-8000-000000000003',
    type_operation: 'COTISATION',
    categorie_id: null,
    montant: 100000,
    devise: 'MGA',
    actif: true,
    date_debut: '2026-01-01',
    date_fin: null,
    created_at: '2026-01-01T05:00:00.000Z',
    updated_at: '2026-01-01T05:00:00.000Z',
  },
  {
    id: 'c0000000-0000-4000-8000-000000000004',
    type_operation: 'ADHESION',
    categorie_id: IDS_TEST.categorie_musicien,
    montant: 120000,
    devise: 'MGA',
    actif: true,
    date_debut: '2026-01-01',
    date_fin: null,
    created_at: '2026-01-01T05:00:00.000Z',
    updated_at: '2026-01-01T05:00:00.000Z',
  },
];

/** Articles de documentation : 3 publiés + 1 non publié (jamais listé). */
export const DOCUMENTATION_TEST: Documentation[] = [
  {
    id: 'd0000000-0000-4000-8000-000000000001',
    slug: 'devenir-membre',
    titre: 'Devenir membre de l’OMDA',
    contenu:
      'L’adhésion se fait en trois étapes : identité, catégorie, puis documents et œuvres. ' +
      'Aucun paiement n’est demandé à l’envoi du dossier : le paiement des frais d’adhésion ' +
      'n’est possible qu’après validation du dossier par l’OMDA.',
    ordre: 1,
    publie: true,
    updated_at: '2026-08-10T05:00:00.000Z',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000002',
    slug: 'documents-a-fournir',
    titre: 'Documents à fournir',
    contenu:
      'Prévoyez une photo, une copie de la CIN, un acte de naissance et un certificat de ' +
      'résidence. Les personnes de 15 à 17 ans joignent une autorisation parentale. ' +
      'Chaque fichier fait au maximum 20 Mo (JPEG, PNG ou PDF).',
    ordre: 2,
    publie: true,
    updated_at: '2026-08-10T05:00:00.000Z',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000003',
    slug: 'vos-droits-d-auteur',
    titre: 'Vos droits d’auteur',
    contenu:
      'L’OMDA perçoit et répartit les droits de ses membres. Chaque œuvre déposée est ' +
      'examinée avant enregistrement ; le dépôt n’est finalisé qu’après le paiement des ' +
      'frais de dépôt.',
    ordre: 3,
    publie: true,
    updated_at: '2026-08-10T05:00:00.000Z',
  },
  {
    id: 'd0000000-0000-4000-8000-000000000004',
    slug: 'article-en-preparation',
    titre: 'Article en préparation',
    contenu: 'Contenu non publié : ne doit jamais apparaître dans la liste.',
    ordre: 4,
    publie: false,
    updated_at: '2026-09-01T05:00:00.000Z',
  },
];

/**
 * Opérateur Mobile Money (table `operateur_mobile_money`) : MVola UNIQUEMENT —
 * c'est le seul opérateur du schéma. Voir `definirOperateurActif` pour la
 * liste dynamique.
 */
export const OPERATEURS_TEST: OperateurMobileMoney[] = [
  {
    code: 'MVOLA',
    libelle: 'MVola',
    actif: true,
    ordre: 1,
    updated_at: '2026-03-02T05:00:00.000Z',
  },
];

/* --------------------------------------------------------------- Comptes */

/** Jeu de données rattaché à un compte de test (pour tester vide ET contenu). */
export type JeuDonneesMembre = 'complet' | 'vide';

export type CompteTest = {
  email: string;
  /** Mot de passe en clair : toléré UNIQUEMENT dans les fixtures de test. */
  mot_de_passe: string;
  role: RoleUtilisateur;
  statut: StatutUtilisateur;
  doit_changer_mot_de_passe: boolean;
  telephone: string | null;
  /** `null` tant que l'adhésion n'est pas finalisée. */
  numero_adherent: string | null;
  nom: string;
  prenom: string;
  cin: string;
  date_naissance: DateISO;
  adresse: string;
  jeu_de_donnees: JeuDonneesMembre;
};

/**
 * Comptes de test de l'espace membre.
 * - `membre@omda.mg` : compte complet (œuvres, cotisation, notifications) ;
 * - `premiere.connexion@omda.mg` : changement de mot de passe OBLIGATOIRE ;
 * - `vide@omda.mg` : compte actif SANS œuvre (états vides) ;
 * - `desactive@omda.mg` : compte désactivé (connexion refusée) ;
 * - `bloque@omda.mg` : 3 échecs successifs ⇒ `TROP_DE_TENTATIVES`.
 * Mot de passe commun : `Omda2026!`
 */
export const COMPTES_TEST: CompteTest[] = [
  {
    email: 'membre@omda.mg',
    mot_de_passe: 'Omda2026!',
    role: 'MEMBRE',
    statut: 'ACTIF',
    doit_changer_mot_de_passe: false,
    telephone: '+261341234567',
    numero_adherent: 'OMDA-2026-A-000123',
    nom: 'RAKOTO',
    prenom: 'Jean',
    cin: '101234567890',
    date_naissance: '1996-04-12',
    adresse: 'Lot 12 Bis, Antananarivo 101',
    jeu_de_donnees: 'complet',
  },
  {
    email: 'premiere.connexion@omda.mg',
    mot_de_passe: 'Omda2026!',
    role: 'MEMBRE',
    statut: 'EN_ATTENTE_CHANGEMENT_MDP',
    doit_changer_mot_de_passe: true,
    telephone: '+261341111111',
    numero_adherent: 'OMDA-2026-A-000124',
    nom: 'RANDRIA',
    prenom: 'Soa',
    cin: '101111111111',
    date_naissance: '1998-11-03',
    adresse: 'Lot 4, Antsirabe 110',
    jeu_de_donnees: 'vide',
  },
  {
    email: 'vide@omda.mg',
    mot_de_passe: 'Omda2026!',
    role: 'MEMBRE',
    statut: 'ACTIF',
    doit_changer_mot_de_passe: false,
    telephone: '+261342222222',
    numero_adherent: 'OMDA-2026-A-000125',
    nom: 'RABE',
    prenom: 'Naina',
    cin: '101222222222',
    date_naissance: '2001-06-21',
    adresse: 'Lot 9, Fianarantsoa 301',
    jeu_de_donnees: 'vide',
  },
  {
    email: 'desactive@omda.mg',
    mot_de_passe: 'Omda2026!',
    role: 'MEMBRE',
    statut: 'DESACTIVE',
    doit_changer_mot_de_passe: false,
    telephone: '+261343333333',
    numero_adherent: 'OMDA-2026-A-000126',
    nom: 'RAZAFY',
    prenom: 'Hery',
    cin: '101333333333',
    date_naissance: '1990-02-15',
    adresse: 'Lot 21, Toamasina 501',
    jeu_de_donnees: 'vide',
  },
  {
    email: 'bloque@omda.mg',
    mot_de_passe: 'Omda2026!',
    role: 'MEMBRE',
    statut: 'ACTIF',
    doit_changer_mot_de_passe: false,
    telephone: '+261344444444',
    numero_adherent: 'OMDA-2026-A-000127',
    nom: 'ANDRIANINA',
    prenom: 'Miora',
    cin: '101444444444',
    date_naissance: '1994-09-09',
    adresse: 'Lot 33, Mahajanga 401',
    jeu_de_donnees: 'vide',
  },
];

/* -------------------------------------------------------------- Dossiers */

/** Dossier d'adhésion préexistant dans les fixtures (suivi + paiement). */
export type DossierTest = {
  numero_dossier: string;
  code_suivi: string;
  statut: StatutDemande;
  categorie_id: UUID;
  /** Obligatoire si `statut = 'REJETEE'` (règle métier 12). */
  motif_rejet: string | null;
  date_soumission: HorodatageISO | null;
  date_decision: HorodatageISO | null;
  /** Renseigné si un paiement a déjà été confirmé par le serveur. */
  paiement_reussi: { reference_interne: string; date_confirmation: HorodatageISO } | null;
  identite: {
    nom: string;
    prenom: string;
    date_naissance: DateISO;
    cin: string;
    telephone: string;
    email: string;
    adresse: string;
  };
};

/**
 * Dossiers de test (numéro + code de suivi : les deux doivent correspondre).
 * Les statuts couvrent tous les cas d'écran : brouillon, envoyée, en cours,
 * validée (paiement possible), rejetée (avec motif), adhésion terminée.
 */
export const DOSSIERS_TEST: DossierTest[] = [
  {
    numero_dossier: 'OMDA-2026-000001',
    code_suivi: 'K7X4-9B2Q',
    statut: 'VALIDEE',
    categorie_id: IDS_TEST.categorie_artiste_auteur,
    motif_rejet: null,
    date_soumission: '2026-08-01T07:10:00.000Z',
    date_decision: '2026-08-04T06:30:00.000Z',
    paiement_reussi: null,
    identite: {
      nom: 'RAKOTO',
      prenom: 'Jean',
      date_naissance: '1996-04-12',
      cin: '101234567890',
      telephone: '+261341234567',
      email: 'jean.rakoto@example.mg',
      adresse: 'Lot 12 Bis, Antananarivo 101',
    },
  },
  {
    numero_dossier: 'OMDA-2026-000002',
    code_suivi: 'M3P8-7T2W',
    statut: 'EN_COURS_DE_VERIFICATION',
    categorie_id: IDS_TEST.categorie_ecrivain,
    motif_rejet: null,
    date_soumission: '2026-08-20T09:00:00.000Z',
    date_decision: null,
    paiement_reussi: null,
    identite: {
      nom: 'RANDRIA',
      prenom: 'Soa',
      date_naissance: '1998-11-03',
      cin: '101111111111',
      telephone: '+261341111111',
      email: 'soa.randria@example.mg',
      adresse: 'Lot 4, Antsirabe 110',
    },
  },
  {
    numero_dossier: 'OMDA-2026-000003',
    code_suivi: 'R9F2-4H6K',
    statut: 'REJETEE',
    categorie_id: IDS_TEST.categorie_musicien,
    motif_rejet:
      'La copie de la CIN est illisible. Merci de déposer une nouvelle pièce, puis de ' +
      'renvoyer votre dossier.',
    date_soumission: '2026-07-15T06:45:00.000Z',
    date_decision: '2026-07-18T05:20:00.000Z',
    paiement_reussi: null,
    identite: {
      nom: 'RAZAFY',
      prenom: 'Hery',
      date_naissance: '1990-02-15',
      cin: '101333333333',
      telephone: '+261343333333',
      email: 'hery.razafy@example.mg',
      adresse: 'Lot 21, Toamasina 501',
    },
  },
  {
    numero_dossier: 'OMDA-2026-000004',
    code_suivi: 'D5N7-1Q8Z',
    statut: 'ADHESION_TERMINEE',
    categorie_id: IDS_TEST.categorie_artiste_auteur,
    motif_rejet: null,
    date_soumission: '2026-05-02T06:00:00.000Z',
    date_decision: '2026-05-06T06:00:00.000Z',
    paiement_reussi: {
      reference_interne: 'PAI-2026-000701',
      date_confirmation: '2026-05-07T08:12:00.000Z',
    },
    identite: {
      nom: 'ANDRIANINA',
      prenom: 'Miora',
      date_naissance: '1994-09-09',
      cin: '101444444444',
      telephone: '+261344444444',
      email: 'miora.andrianina@example.mg',
      adresse: 'Lot 33, Mahajanga 401',
    },
  },
  {
    numero_dossier: 'OMDA-2026-000005',
    code_suivi: 'B2V6-3L9X',
    statut: 'ENVOYEE',
    categorie_id: IDS_TEST.categorie_ecrivain,
    motif_rejet: null,
    date_soumission: '2026-09-22T10:05:00.000Z',
    date_decision: null,
    paiement_reussi: null,
    identite: {
      nom: 'RAKOTOMALALA',
      prenom: 'Tiana',
      date_naissance: '1993-01-30',
      cin: '101555555555',
      telephone: '+261345555555',
      email: 'tiana.rakotomalala@example.mg',
      adresse: 'Lot 7, Antananarivo 101',
    },
  },
  {
    numero_dossier: 'OMDA-2026-000006',
    code_suivi: 'T4C1-8M5J',
    statut: 'BROUILLON',
    categorie_id: IDS_TEST.categorie_musicien,
    motif_rejet: null,
    date_soumission: null,
    date_decision: null,
    paiement_reussi: null,
    identite: {
      nom: 'RABE',
      prenom: 'Naina',
      date_naissance: '2001-06-21',
      cin: '101222222222',
      telephone: '+261342222222',
      email: 'naina.rabe@example.mg',
      adresse: 'Lot 9, Fianarantsoa 301',
    },
  },
  {
    numero_dossier: 'OMDA-2026-000007',
    code_suivi: 'P6L3-2S7D',
    statut: 'BROUILLON',
    categorie_id: IDS_TEST.categorie_artiste_auteur,
    motif_rejet: null,
    date_soumission: null,
    date_decision: null,
    paiement_reussi: null,
    identite: {
      nom: 'RAKOTOARISOA',
      prenom: 'Feno',
      date_naissance: '2009-05-14',
      cin: '101666666666',
      telephone: '+261346666666',
      email: 'feno.rakotarisoa@example.mg',
      adresse: 'Lot 18, Antananarivo 101',
    },
  },
  {
    numero_dossier: 'OMDA-2026-000008',
    code_suivi: 'V4J9-6W3N',
    statut: 'VALIDEE',
    categorie_id: IDS_TEST.categorie_musicien,
    motif_rejet: null,
    date_soumission: '2026-09-10T06:20:00.000Z',
    date_decision: '2026-09-13T06:00:00.000Z',
    paiement_reussi: null,
    identite: {
      nom: 'RASOAMANANA',
      prenom: 'Lova',
      date_naissance: '1999-03-08',
      cin: '101777777777',
      telephone: '+261347777777',
      email: 'lova.rasoamanana@example.mg',
      adresse: 'Lot 25, Antsirabe 110',
    },
  },
];

/* ------------------------------------------------- Mobile Money (paiement) */

/** Numéros de test Mobile Money et statut final renvoyé par le « serveur ». */
export const NUMEROS_MOBILE_MONEY_TEST: {
  numero: string;
  statut_final: StatutPaiement;
  libelle: string;
}[] = [
  {
    numero: '+261340000001',
    statut_final: 'REUSSI',
    libelle: 'Paiement confirmé par l’opérateur (cas nominal).',
  },
  {
    numero: '+261340000002',
    statut_final: 'ECHEC_SOLDE_INSUFFISANT',
    libelle: 'Échec : solde insuffisant.',
  },
  {
    numero: '+261340000003',
    statut_final: 'ECHEC_AUTRE',
    libelle: 'Échec technique de l’opérateur.',
  },
  {
    numero: '+261340000004',
    statut_final: 'REJETE',
    libelle: 'Paiement rejeté (annulé par le titulaire).',
  },
];

/** Tout autre numéro `+261…` aboutit à un paiement confirmé (`REUSSI`). */
export const STATUT_MOBILE_MONEY_PAR_DEFAUT: StatutPaiement = 'REUSSI';

/** Mentions et libellés imposés par le cahier des charges. */
export const MENTION_ESTIMATION =
  'Estimation — le montant final est confirmé par le serveur.';

/* ---------------------------------------------------------------- Accès */

/** Retrouve un dossier de test par son numéro (comparaison insensible à la casse). */
export function trouverDossierTest(numero_dossier: string): DossierTest | null {
  const recherche = numero_dossier.trim().toUpperCase();
  return DOSSIERS_TEST.find((dossier) => dossier.numero_dossier.toUpperCase() === recherche) ?? null;
}

/** Retrouve un compte de test par e-mail (comparaison insensible à la casse). */
export function trouverCompteTest(email: string): CompteTest | null {
  const recherche = email.trim().toLowerCase();
  return COMPTES_TEST.find((compte) => compte.email.toLowerCase() === recherche) ?? null;
}

/**
 * Tarif applicable : la ligne la plus spécifique gagne (celui de la catégorie
 * s'il existe, sinon celui sans catégorie). `null` si aucun tarif actif.
 */
export function tarifApplique(
  type_operation: TypeOperationTarif,
  categorie_id: UUID | null,
): Tarif | null {
  const candidats = TARIFS_TEST.filter(
    (tarif) => tarif.actif && tarif.type_operation === type_operation,
  );
  const specifique = candidats.find((tarif) => tarif.categorie_id === categorie_id) ?? null;
  if (specifique) {
    return specifique;
  }
  if (categorie_id === null) {
    return null;
  }
  return candidats.find((tarif) => tarif.categorie_id === null) ?? null;
}

/** Statut final Mobile Money pour un numéro : liste de test, sinon `REUSSI`. */
export function statutFinalMobileMoney(numero: string | null | undefined): StatutPaiement {
  if (!numero) {
    return STATUT_MOBILE_MONEY_PAR_DEFAUT;
  }
  const entree = NUMEROS_MOBILE_MONEY_TEST.find((element) => element.numero === numero.trim());
  return entree ? entree.statut_final : STATUT_MOBILE_MONEY_PAR_DEFAUT;
}
