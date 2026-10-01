/**
 * `MemberRepository` réel (Supabase : Auth + DB + Storage) — SQUELETTE (étape 17).
 *
 * ⚠️ Aucune donnée n'est encore lue ni écrite : chaque méthode renvoie un refus
 * `serveur` explicite. Cette classe existe pour que la fabrique
 * (`src/services/factory.ts`) puisse sélectionner le mode réel, et pour figer la
 * correspondance méthode ↔ table du schéma (`docs/SCHEMA_DB.md`) :
 *
 * - Profil (U)        : `utilisateur`, `membre`, `membre_categorie`, `categorie`
 * - Accueil (P)       : `membre`, `oeuvre`, `cotisation`, `notification`
 * - Œuvres (Q, R, S)  : `oeuvre`, `attestation_diffusion` + Storage (`oeuvres`)
 * - Cotisations (T)   : `cotisation`
 * - Paiements (S, T)  : `paiement`
 * - Notifications (V) : `notification`
 *
 * Le mode mock reste le défaut : `EXPO_PUBLIC_USE_MOCKS` non passé à `false`
 * n'instancie jamais cette classe (cf. `docs/BRANCHEMENT.md`).
 */
import type {
  AttestationDiffusion,
  Cotisation,
  MembreCategorie,
  Notification,
  Oeuvre,
  Paiement,
  UUID,
} from '../../models';
import type {
  CategoriesMembre,
  CreerOeuvreEntree,
  DemandeCategorieOeuvresEntree,
  FichierTeleverse,
  InitierPaiementMembreEntree,
  ListerCotisationsEntree,
  ListerNotificationsEntree,
  ListerOeuvresEntree,
  MemberRepository,
  MiseAJourProfilEntree,
  MettreAJourOeuvreEntree,
  OptionsTeleversement,
  ProfilMembre,
  Result,
  SoumettreOeuvreEntree,
  TableauDeBordEntree,
  TableauDeBordMembre,
  TeleversementEntree,
  UrlFichierConsulte,
} from '../contracts';
import { erreurNonBranche } from '../nonImplemente';

export class SupabaseMemberRepository implements MemberRepository {
  /* ------------------------------------------------------------ Profil (U) */

  async obtenirProfil(): Promise<Result<ProfilMembre>> {
    return erreurNonBranche();
  }

  async listerCategoriesMembre(): Promise<Result<CategoriesMembre>> {
    return erreurNonBranche();
  }

  async demanderCategorieSupplementaire(categorie_id: UUID): Promise<Result<MembreCategorie>> {
    return erreurNonBranche();
  }

  async demanderCategorieSupplementaireAvecOeuvres(
    entree: DemandeCategorieOeuvresEntree,
  ): Promise<Result<MembreCategorie>> {
    return erreurNonBranche();
  }

  async annulerDemandeCategorie(membre_categorie_id: UUID): Promise<Result<MembreCategorie>> {
    return erreurNonBranche();
  }

  async mettreAJourProfil(entree: MiseAJourProfilEntree): Promise<Result<ProfilMembre>> {
    return erreurNonBranche();
  }

  /* --------------------------------------------------- Accueil membre (P) */

  async obtenirTableauDeBord(entree?: TableauDeBordEntree): Promise<Result<TableauDeBordMembre>> {
    return erreurNonBranche();
  }

  /* --------------------------------------------------------- Œuvres (Q, R, S) */

  async listerOeuvres(entree?: ListerOeuvresEntree): Promise<Result<Oeuvre[]>> {
    return erreurNonBranche();
  }

  async obtenirOeuvre(oeuvre_id: UUID): Promise<Result<Oeuvre>> {
    return erreurNonBranche();
  }

  async listerAttestationsOeuvre(oeuvre_id: UUID): Promise<Result<AttestationDiffusion[]>> {
    return erreurNonBranche();
  }

  async obtenirUrlFichier(chemin_stockage: string): Promise<Result<UrlFichierConsulte>> {
    return erreurNonBranche();
  }

  async creerOeuvre(entree: CreerOeuvreEntree): Promise<Result<Oeuvre>> {
    return erreurNonBranche();
  }

  async mettreAJourOeuvre(
    oeuvre_id: UUID,
    entree: MettreAJourOeuvreEntree,
  ): Promise<Result<Oeuvre>> {
    return erreurNonBranche();
  }

  async soumettreOeuvre(entree: SoumettreOeuvreEntree): Promise<Result<Oeuvre>> {
    return erreurNonBranche();
  }

  async televerserFichier(
    entree: TeleversementEntree,
    options?: OptionsTeleversement,
  ): Promise<Result<FichierTeleverse>> {
    return erreurNonBranche();
  }

  /* ------------------------------------------------------- Cotisations (T) */

  async listerCotisations(entree?: ListerCotisationsEntree): Promise<Result<Cotisation[]>> {
    return erreurNonBranche();
  }

  async obtenirCotisation(annee: number): Promise<Result<Cotisation>> {
    return erreurNonBranche();
  }

  /* --------------------------------------------------------- Paiements (S, T) */

  async initierPaiement(entree: InitierPaiementMembreEntree): Promise<Result<Paiement>> {
    return erreurNonBranche();
  }

  async obtenirPaiement(paiement_id: UUID): Promise<Result<Paiement>> {
    return erreurNonBranche();
  }

  /* ----------------------------------------------------- Notifications (V) */

  async listerNotifications(entree?: ListerNotificationsEntree): Promise<Result<Notification[]>> {
    return erreurNonBranche();
  }

  async marquerNotificationLue(notification_id: UUID): Promise<Result<Notification>> {
    return erreurNonBranche();
  }

  async marquerToutesNotificationsLues(): Promise<Result<number>> {
    return erreurNonBranche();
  }
}
