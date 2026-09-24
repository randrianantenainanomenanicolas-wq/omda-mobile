import type {
  Categorie,
  Cotisation,
  Membre,
  MembreCategorie,
  ModePaiement,
  Notification,
  Oeuvre,
  OperateurPaiement,
  Paiement,
  StatutOeuvre,
  StatutUtilisateur,
  TypeNotification,
  TypePaiement,
  UUID,
  Utilisateur,
} from '../../models';
import type { Result } from './result';
import type {
  FichierDepose,
  FichierTeleverse,
  OptionsTeleversement,
  TeleversementEntree,
} from './televersement';

/**
 * Contrat d'accès aux données du MEMBRE connecté (Supabase : Auth + DB + Storage).
 *
 * Implémentation par défaut : mocks (`USE_MOCKS=true`) ;
 * branchement réel : `SupabaseMemberRepository` (à écrire, structure déjà prévue).
 *
 * Le membre ne peut agir que sur ses propres données : les règles RLS du
 * schéma font foi (aucun filtre de sécurité n'est délégué à l'UI).
 */
export interface MemberRepository {
  /* ------------------------------------------------------------ Profil (U) */

  /** Profil complet : utilisateur + membre + catégories actives. */
  obtenirProfil(): Promise<Result<ProfilMembre>>;

  /** Met à jour les informations modifiables par le membre. */
  mettreAJourProfil(entree: MiseAJourProfilEntree): Promise<Result<ProfilMembre>>;

  /* --------------------------------------------------- Accueil membre (P) */

  /** Données de la page d'accueil : salutation, compteurs, cotisation de l'année. */
  obtenirTableauDeBord(entree?: TableauDeBordEntree): Promise<Result<TableauDeBordMembre>>;

  /* --------------------------------------------------------- Œuvres (Q, R, S) */

  /** Liste des œuvres du membre (filtrable par statut), vide si aucune. */
  listerOeuvres(entree?: ListerOeuvresEntree): Promise<Result<Oeuvre[]>>;

  /** Détail d'une œuvre (statuts, motif de rejet éventuel). */
  obtenirOeuvre(oeuvre_id: UUID): Promise<Result<Oeuvre>>;

  /** Crée un brouillon d'œuvre (aucun envoi, aucun paiement). */
  creerOeuvre(entree: CreerOeuvreEntree): Promise<Result<Oeuvre>>;

  /** Modifie un brouillon d'œuvre. */
  mettreAJourOeuvre(oeuvre_id: UUID, entree: MettreAJourOeuvreEntree): Promise<Result<Oeuvre>>;

  /**
   * Envoie l'œuvre (statut `ENVOYEE`) avec son fichier et au moins une
   * attestation de diffusion. ⚠️ Aucun paiement n'est déclenché à l'envoi.
   */
  soumettreOeuvre(entree: SoumettreOeuvreEntree): Promise<Result<Oeuvre>>;

  /** Téléverse un fichier (bucket `oeuvres` ou `pieces`), avec progression. */
  televerserFichier(
    entree: TeleversementEntree,
    options?: OptionsTeleversement,
  ): Promise<Result<FichierTeleverse>>;

  /* ------------------------------------------------------- Cotisations (T) */

  /** Cotisations du membre (liste vide si aucune). */
  listerCotisations(entree?: ListerCotisationsEntree): Promise<Result<Cotisation[]>>;

  /** Cotisation d'une année donnée. */
  obtenirCotisation(annee: number): Promise<Result<Cotisation>>;

  /* --------------------------------------------------------- Paiements (S, T) */

  /**
   * Initie un paiement (dépôt d'œuvre `VALIDEE` ou cotisation due).
   * ⚠️ Aucun succès n'est déduit localement : seul `statut = 'REUSSI'`
   * renvoyé par le serveur confirme le paiement.
   */
  initierPaiement(entree: InitierPaiementMembreEntree): Promise<Result<Paiement>>;

  /** État d'un paiement (polling côté membre). */
  obtenirPaiement(paiement_id: UUID): Promise<Result<Paiement>>;

  /* ----------------------------------------------------- Notifications (V) */

  /** Notifications du membre, les plus récentes d'abord. */
  listerNotifications(entree?: ListerNotificationsEntree): Promise<Result<Notification[]>>;

  /** Marque une notification comme lue. */
  marquerNotificationLue(notification_id: UUID): Promise<Result<Notification>>;

  /** Marque toutes les notifications comme lues (nombre mis à jour). */
  marquerToutesNotificationsLues(): Promise<Result<number>>;
}

/* ---------------------------------------------------------------------- DTO */

/** Profil du membre connecté (écran Profil). */
export type ProfilMembre = {
  utilisateur: Utilisateur;
  membre: Membre;
  /** Catégories du membre (principale + supplémentaires). */
  categories: Categorie[];
  membre_categories: MembreCategorie[];
};

/**
 * Champs modifiables par le membre.
 * Nom, prénom, CIN et date de naissance proviennent du dossier candidat :
 * ils restent en LECTURE SEULE dans l'application.
 */
export type MiseAJourProfilEntree = {
  telephone?: string | null;
};

export type TableauDeBordEntree = {
  /** Année de la cotisation à afficher (par défaut l'année courante). */
  annee?: number;
};

/** Données de l'accueil membre (écran P). */
export type TableauDeBordMembre = {
  prenom: string;
  numero_adherent: string;
  statut_compte: StatutUtilisateur;
  nombre_oeuvres: number;
  cotisation_annee: Cotisation | null;
  notifications_non_lues: number;
};

export type ListerOeuvresEntree = {
  statut?: StatutOeuvre;
};

export type CreerOeuvreEntree = {
  titre: string;
  categorie_id: UUID;
  description?: string | null;
  annee?: number | null;
};

export type MettreAJourOeuvreEntree = {
  titre?: string;
  categorie_id?: UUID;
  description?: string | null;
  annee?: number | null;
};

export type SoumettreOeuvreEntree = {
  oeuvre_id: UUID;
  fichier: FichierDepose;
  /** Au moins une attestation de diffusion (règle métier 8). */
  attestations: FichierDepose[];
};

export type ListerCotisationsEntree = {
  annee?: number;
};

/**
 * Paiement initié par un membre : dépôt d'œuvre ou cotisation.
 * Le contexte (`oeuvre_id` / `cotisation_id`) est imposé par le schéma
 * (`paiement_contexte_chk`).
 */
export type InitierPaiementMembreEntree = {
  type: TypePaiement;
  mode: ModePaiement;
  operateur?: OperateurPaiement | null;
  /** Obligatoire si `mode = 'MOBILE_MONEY'`. */
  numero_telephone?: string | null;
  /** Obligatoire si `type = 'DEPOT_OEUVRE'` (œuvre au statut `VALIDEE`). */
  oeuvre_id?: UUID | null;
  /** Obligatoire si `type = 'COTISATION'`. */
  cotisation_id?: UUID | null;
};

export type ListerNotificationsEntree = {
  non_lues_uniquement?: boolean;
  type?: TypeNotification;
};

/* -------------------------------------------------------- Codes d'erreur métier */

/** Codes stables des refus métier côté membre (`ErreurMetier.code`). */
export const CODES_ERREUR_MEMBRE = {
  NON_AUTHENTIFIE: 'NON_AUTHENTIFIE',
  OEUVRE_INTROUVABLE: 'OEUVRE_INTROUVABLE',
  OEUVRE_NON_VALIDEE: 'OEUVRE_NON_VALIDEE',
  COTISATION_INTROUVABLE: 'COTISATION_INTROUVABLE',
  COTISATION_DEJA_PAYEE: 'COTISATION_DEJA_PAYEE',
  OPERATEUR_INDISPONIBLE: 'OPERATEUR_INDISPONIBLE',
  FICHIER_TROP_VOLUMINEUX: 'FICHIER_TROP_VOLUMINEUX',
  TYPE_FICHIER_NON_AUTORISE: 'TYPE_FICHIER_NON_AUTORISE',
} as const;

export type CodeErreurMembre = (typeof CODES_ERREUR_MEMBRE)[keyof typeof CODES_ERREUR_MEMBRE];
