/**
 * Types énumérés PostgreSQL (`docs/SCHEMA_DB.md`).
 *
 * Chaque ENUM est déclaré sous forme de constante `as const` : le tableau sert
 * de source unique et le type union en est dérivé. Aucune valeur n'est écrite
 * en dur ailleurs (ni dans les futurs mocks, ni dans l'UI).
 *
 * ⚠️ Rappel métier : `REUSSI` (`StatutPaiement`) est la SEULE confirmation de
 * succès d'un paiement ; une validation (`VALIDEE`) ne fait pas d'un candidat
 * un membre.
 */

/* ---------------------------------------------------------------- Utilisateurs */

export const ROLES_UTILISATEUR = ['MEMBRE', 'AGENT', 'ADMINISTRATEUR'] as const;
export type RoleUtilisateur = (typeof ROLES_UTILISATEUR)[number];

export const STATUTS_UTILISATEUR = ['ACTIF', 'DESACTIVE', 'EN_ATTENTE_CHANGEMENT_MDP'] as const;
export type StatutUtilisateur = (typeof STATUTS_UTILISATEUR)[number];

export const STATUTS_ADHESION_CATEGORIE = ['ACTIVE', 'INACTIVE'] as const;
export type StatutAdhesionCategorie = (typeof STATUTS_ADHESION_CATEGORIE)[number];

/* ------------------------------------------------------------------- Demandes */

export const STATUTS_DEMANDE = [
  'BROUILLON',
  'ENVOYEE',
  'EN_COURS_DE_VERIFICATION',
  'VALIDEE',
  'REJETEE',
  'ADHESION_TERMINEE',
] as const;
export type StatutDemande = (typeof STATUTS_DEMANDE)[number];

export const TYPES_PIECE = [
  'PHOTO',
  'CIN',
  'ACTE_NAISSANCE',
  'CERTIFICAT_RESIDENCE',
  'AUTORISATION_PARENTALE',
  'AUTRE',
] as const;
export type TypePiece = (typeof TYPES_PIECE)[number];

/* -------------------------------------------------------------------- Œuvres */

export const STATUTS_OEUVRE = [
  'BROUILLON',
  'ENVOYEE',
  'EN_COURS_DE_VALIDATION',
  'VALIDEE',
  'REJETEE',
  'DEPOT_FINALISE',
] as const;
export type StatutOeuvre = (typeof STATUTS_OEUVRE)[number];

/* ------------------------------------------------------------------ Paiements */

export const TYPES_PAIEMENT = ['ADHESION', 'DEPOT_OEUVRE', 'COTISATION'] as const;
export type TypePaiement = (typeof TYPES_PAIEMENT)[number];

export const TYPES_OPERATION_TARIF = ['ADHESION', 'DEPOT_OEUVRE', 'COTISATION'] as const;
export type TypeOperationTarif = (typeof TYPES_OPERATION_TARIF)[number];

export const MODES_PAIEMENT = ['MOBILE_MONEY', 'VIREMENT_BANCAIRE'] as const;
export type ModePaiement = (typeof MODES_PAIEMENT)[number];

export const OPERATEURS_PAIEMENT = ['MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY'] as const;
export type OperateurPaiement = (typeof OPERATEURS_PAIEMENT)[number];

export const STATUTS_PAIEMENT = [
  'INITIE',
  'EN_ATTENTE_CONFIRMATION',
  'EN_ATTENTE_PREUVE',
  'EN_ATTENTE_VERIFICATION_AGENT',
  'REUSSI',
  'ECHEC_SOLDE_INSUFFISANT',
  'ECHEC_AUTRE',
  'REJETE',
] as const;
export type StatutPaiement = (typeof STATUTS_PAIEMENT)[number];

export const STATUTS_COTISATION = ['NON_PAYEE', 'PAYEE'] as const;
export type StatutCotisation = (typeof STATUTS_COTISATION)[number];

/* -------------------------------------------------------------- Notifications */

export const TYPES_NOTIFICATION = [
  'DEMANDE_ENVOYEE',
  'DEMANDE_VALIDEE',
  'DEMANDE_REJETEE',
  'PAIEMENT_DISPONIBLE',
  'PAIEMENT_REUSSI',
  'PAIEMENT_ECHEC',
  'OEUVRE_VALIDEE',
  'OEUVRE_REJETEE',
  'VIREMENT_VALIDE',
  'VIREMENT_REJETE',
  'IDENTIFIANTS_ENVOYES',
  'GLOBALE',
] as const;
export type TypeNotification = (typeof TYPES_NOTIFICATION)[number];
