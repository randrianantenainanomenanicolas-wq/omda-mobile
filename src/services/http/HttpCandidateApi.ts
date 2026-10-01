/**
 * `CandidateApi` réel (API REST Express du parcours candidat) — SQUELETTE (étape 17).
 *
 * ⚠️ Aucun appel HTTP n'est encore effectué : chaque méthode renvoie un refus
 * `serveur` explicite. La correspondance HTTP (routes, en-têtes
 * `X-Numero-Dossier` / `X-Code-Suivi`, `Idempotency-Key`) est décrite dans
 * `docs/API_CANDIDAT.md` ; l'URL de base est `EXPO_PUBLIC_API_BASE_URL`.
 *
 * Le mode mock reste le défaut : cette classe n'est instanciée que si
 * `EXPO_PUBLIC_USE_MOCKS=false` (cf. `src/services/factory.ts`).
 */
import type {
  CandidateApi,
  ConfirmationEnvoiDemande,
  CreerDemandeEntree,
  DemandeBrouillon,
  EtatPaiementCandidat,
  FichierTeleverse,
  InitierPaiementEntree,
  MettreAJourDemandeEntree,
  OptionsPaiementCandidat,
  OptionsTeleversement,
  Result,
  SoumettreDemandeEntree,
  SuiviDemande,
  SuiviDemandeEntree,
  TeleversementEntree,
} from '../contracts';
import { erreurNonBranche } from '../nonImplemente';

/** URL de base de l'API Express candidat (`EXPO_PUBLIC_API_BASE_URL`). */
export const API_BASE_URL = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();

export class HttpCandidateApi implements CandidateApi {
  /** Crée un dossier à l'état `BROUILLON` (reprise possible via numéro + code). */
  async creerDemande(entree: CreerDemandeEntree): Promise<Result<DemandeBrouillon>> {
    return erreurNonBranche();
  }

  /** Met à jour un brouillon (identité, catégorie). */
  async mettreAJourDemande(
    numero_dossier: string,
    code_suivi: string,
    entree: MettreAJourDemandeEntree,
  ): Promise<Result<DemandeBrouillon>> {
    return erreurNonBranche();
  }

  /** Envoie le dossier complet : statut `ENVOYEE`, délai indicatif 72 h, aucun paiement. */
  async soumettreDemande(entree: SoumettreDemandeEntree): Promise<Result<ConfirmationEnvoiDemande>> {
    return erreurNonBranche();
  }

  /** Téléverse un fichier (pièce, œuvre, attestation) avec progression. */
  async televerserFichier(
    entree: TeleversementEntree,
    options?: OptionsTeleversement,
  ): Promise<Result<FichierTeleverse>> {
    return erreurNonBranche();
  }

  /** Suivi public : numéro de dossier + code de suivi. */
  async suivreDemande(entree: SuiviDemandeEntree): Promise<Result<SuiviDemande>> {
    return erreurNonBranche();
  }

  /** Modes et moyens réellement disponibles pour ce dossier (liste dynamique). */
  async obtenirOptionsPaiement(entree: SuiviDemandeEntree): Promise<Result<OptionsPaiementCandidat>> {
    return erreurNonBranche();
  }

  /** Initie un paiement (aucun succès annoncé avant confirmation serveur). */
  async initierPaiement(entree: InitierPaiementEntree): Promise<Result<EtatPaiementCandidat>> {
    return erreurNonBranche();
  }

  /** Polling du statut : `REUSSI` n'est renvoyé que si le serveur l'a confirmé. */
  async obtenirEtatPaiement(reference_interne: string): Promise<Result<EtatPaiementCandidat>> {
    return erreurNonBranche();
  }
}
