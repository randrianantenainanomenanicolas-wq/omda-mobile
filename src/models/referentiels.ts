import type { CodeDevise, DateISO, HorodatageISO, MontantAriary, UUID } from './common';
import type { OperateurPaiement, TypeBulletin, TypeOperationTarif } from './enums';

/** Référentiel des catégories d'adhésion — table `categorie`. */
export type Categorie = {
  id: UUID;
  /** Identifiant métier stable (unique). */
  code: string;
  libelle: string;
  description: string | null;
  /** Ordre d'affichage : 1=Musique, 2=Littéraire, 3=Dramatique, 4=Audiovisuel, 5=Figuratif. */
  ordre: number;
  type_bulletin: TypeBulletin;
  actif: boolean;
  created_at: HorodatageISO;
  updated_at: HorodatageISO;
};

/**
 * Grille tarifaire — table `tarif`.
 * Un seul tarif actif par couple (type_operation, categorie_id) : index
 * `tarif_actif_unique`. Les montants viennent donc TOUJOURS d'ici (jamais de
 * montant codé en dur dans l'UI).
 */
export type Tarif = {
  id: UUID;
  type_operation: TypeOperationTarif;
  categorie_id: UUID | null;
  montant: MontantAriary;
  devise: CodeDevise;
  actif: boolean;
  date_debut: DateISO | null;
  date_fin: DateISO | null;
  created_at: HorodatageISO;
  updated_at: HorodatageISO;
};

/** Article de documentation — table `documentation`. */
export type Documentation = {
  id: UUID;
  slug: string;
  titre: string;
  contenu: string;
  ordre: number;
  publie: boolean;
  updated_at: HorodatageISO;
};

/**
 * Opérateurs Mobile Money — table `operateur_mobile_money` (addendum).
 * La liste affichée doit être filtrée sur `actif = TRUE` : un opérateur
 * désactivé côté serveur est absent de l'UI.
 */
export type OperateurMobileMoney = {
  code: OperateurPaiement;
  libelle: string;
  actif: boolean;
  ordre: number;
  updated_at: HorodatageISO;
};

/** Ancien chef-lieu de province — table `ancien_chef_lieu_province`.
 * Liste de référence, servie par le service, jamais codée dans l'écran.
 */
export type AncienChefLieuProvince = {
  id: UUID;
  libelle: string;
  ordre: number;
  actif: boolean;
  created_at: HorodatageISO;
  updated_at: HorodatageISO;
};

/** Autorisation de soumission d'œuvre — table `autorisation_soumission_oeuvre`.
 * Usage unique, liée au membre et au brouillon, hachée, expiration 10 min.
 */
export type AutorisationSoumissionOeuvre = {
  id: UUID;
  membre_id: UUID;
  oeuvre_brouillon_id: UUID;
  jeton_hash: string;
  expire_at: HorodatageISO;
  utilisee: boolean;
  created_at: HorodatageISO;
};

/** Compteur d'échecs de confirmation par mot de passe — table `compteur_echecs_mot_de_passe`.
 * Par membre, réinitialisé à la connexion réussie.
 */
export type CompteurEchecsMotDePasse = {
  id: UUID;
  membre_id: UUID;
  nb_echecs: number;
  dernier_echec_at: HorodatageISO | null;
  reset_at: HorodatageISO;
  created_at: HorodatageISO;
  updated_at: HorodatageISO;
};
