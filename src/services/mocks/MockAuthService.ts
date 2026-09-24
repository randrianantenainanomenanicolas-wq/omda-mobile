import type { Utilisateur } from '../../models';
import type {
  AuthService,
  ChangerMotDePasseEntree,
  ConnexionEntree,
  SessionMembre,
} from '../contracts';
import {
  CODES_ERREUR_AUTH,
  REGLES_MOT_DE_PASSE,
  erreurMetier,
  ok,
  type Result,
} from '../contracts';
import {
  definirSession,
  enregistrerEchecConnexion,
  membreParUtilisateur,
  maintenantISO,
  motsDePasseMock,
  nombreEchecsConnexion,
  preparerAppelMock,
  reinitialiserEchecsConnexion,
  sessionMock,
  utilisateurParEmail,
} from './etatMock';

/** Nombre d'échecs consécutifs avant blocage temporaire (`TROP_DE_TENTATIVES`). */
export const TENTATIVES_MAX = 3;

/** Vérifie la politique `REGLES_MOT_DE_PASSE` ; renvoie le message d'erreur sinon. */
function verifierMotDePasse(motDePasse: string): string | null {
  if (motDePasse.length < REGLES_MOT_DE_PASSE.longueur_min) {
    return `Le mot de passe doit contenir au moins ${REGLES_MOT_DE_PASSE.longueur_min} caractères.`;
  }
  if (motDePasse.length > REGLES_MOT_DE_PASSE.longueur_max) {
    return `Le mot de passe ne doit pas dépasser ${REGLES_MOT_DE_PASSE.longueur_max} caractères.`;
  }
  if (REGLES_MOT_DE_PASSE.exige_majuscule && !/[A-Z]/.test(motDePasse)) {
    return 'Ajoutez au moins une lettre majuscule.';
  }
  if (REGLES_MOT_DE_PASSE.exige_minuscule && !/[a-z]/.test(motDePasse)) {
    return 'Ajoutez au moins une lettre minuscule.';
  }
  if (REGLES_MOT_DE_PASSE.exige_chiffre && !/[0-9]/.test(motDePasse)) {
    return 'Ajoutez au moins un chiffre.';
  }
  if (REGLES_MOT_DE_PASSE.exige_symbole && !/[^A-Za-z0-9]/.test(motDePasse)) {
    return 'Ajoutez au moins un caractère spécial.';
  }
  return null;
}

/**
 * `AuthService` simulé (Supabase Auth côté réel).
 *
 * Comptes et mots de passe de test : `docs/DONNEES_TEST.md`.
 * - erreurs distinctes : `IDENTIFIANTS_INVALIDES`, `COMPTE_DESACTIVE`,
 *   `TROP_DE_TENTATIVES`, `SESSION_EXPIREE`, `MOT_DE_PASSE_FAIBLE`, … ;
 * - « mot de passe oublié » : réponse TOUJOURS identique (aucune fuite
 *   d'information sur l'existence du compte) ;
 * - changement de mot de passe obligatoire à la première connexion
 *   (`doit_changer_mot_de_passe = true`).
 */
export class MockAuthService implements AuthService {
  /** Connexion e-mail + mot de passe. */
  async connecter(entree: ConnexionEntree): Promise<Result<SessionMembre>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }

    const email = entree.email.trim().toLowerCase();
    if (nombreEchecsConnexion(email) >= TENTATIVES_MAX) {
      return erreurMetier(
        CODES_ERREUR_AUTH.TROP_DE_TENTATIVES,
        'Trop de tentatives échouées. Réessayez dans quelques minutes ou réinitialisez votre mot de passe.',
      );
    }

    const utilisateur = utilisateurParEmail(email);
    const motDePasse = motsDePasseMock.get(email) ?? null;
    if (!utilisateur || motDePasse === null || motDePasse !== entree.mot_de_passe) {
      enregistrerEchecConnexion(email);
      return erreurMetier(
        CODES_ERREUR_AUTH.IDENTIFIANTS_INVALIDES,
        'E-mail ou mot de passe incorrect.',
      );
    }
    if (utilisateur.statut === 'DESACTIVE') {
      return erreurMetier(
        CODES_ERREUR_AUTH.COMPTE_DESACTIVE,
        'Votre compte est désactivé. Contactez l’OMDA pour le réactiver.',
      );
    }

    reinitialiserEchecsConnexion(email);
    utilisateur.derniere_connexion_at = maintenantISO();
    utilisateur.updated_at = maintenantISO();

    const session = this.creerSession(utilisateur);
    definirSession(session);
    return ok(session);
  }

  /** Déconnexion : retour au parcours public, sans menu. */
  async deconnecter(): Promise<Result<void>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    definirSession(null);
    return ok(undefined);
  }

  /** Session courante (perdue au redémarrage dans la version mock). */
  async obtenirSession(): Promise<Result<SessionMembre | null>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    return ok(sessionMock.courante);
  }

  /**
   * Demande de réinitialisation : la réponse est identique que le compte existe
   * ou non (aucune indication n'est donnée à l'utilisateur).
   */
  async demanderReinitialisationMotDePasse(entree: { email: string }): Promise<Result<void>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    entree.email.trim();
    return ok(undefined);
  }

  /** Changement de mot de passe (obligatoire à la première connexion). */
  async changerMotDePasse(entree: ChangerMotDePasseEntree): Promise<Result<SessionMembre>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }

    const session = sessionMock.courante;
    if (!session) {
      return erreurMetier(
        CODES_ERREUR_AUTH.SESSION_EXPIREE,
        'Votre session a expiré. Reconnectez-vous pour continuer.',
      );
    }

    const utilisateur = session.utilisateur;
    const motDePasseActuel = motsDePasseMock.get(utilisateur.email.toLowerCase()) ?? null;
    if (!motDePasseActuel || motDePasseActuel !== entree.mot_de_passe_actuel) {
      return erreurMetier(
        CODES_ERREUR_AUTH.IDENTIFIANTS_INVALIDES,
        'Le mot de passe actuel est incorrect.',
      );
    }
    if (entree.nouveau_mot_de_passe !== entree.confirmation_mot_de_passe) {
      return erreurMetier(
        CODES_ERREUR_AUTH.CONFIRMATION_DIFFERENTE,
        'Les deux mots de passe saisis ne sont pas identiques.',
      );
    }
    if (entree.nouveau_mot_de_passe === motDePasseActuel) {
      return erreurMetier(
        CODES_ERREUR_AUTH.MOT_DE_PASSE_IDENTIQUE,
        'Choisissez un mot de passe différent de l’ancien.',
      );
    }

    const faiblesse = verifierMotDePasse(entree.nouveau_mot_de_passe);
    if (faiblesse) {
      return erreurMetier(CODES_ERREUR_AUTH.MOT_DE_PASSE_FAIBLE, faiblesse);
    }

    motsDePasseMock.set(utilisateur.email.toLowerCase(), entree.nouveau_mot_de_passe);
    utilisateur.doit_changer_mot_de_passe = false;
    utilisateur.statut = 'ACTIF';
    utilisateur.updated_at = maintenantISO();

    const nouvelleSession = this.creerSession(utilisateur);
    definirSession(nouvelleSession);
    return ok(nouvelleSession);
  }

  /** Abonnement aux changements de session ; renvoie la fonction de désabonnement. */
  ecouterSession(rappel: (session: SessionMembre | null) => void): () => void {
    sessionMock.ecouteurs.add(rappel);
    return () => {
      sessionMock.ecouteurs.delete(rappel);
    };
  }

  /** Session applicative construite à partir d'un utilisateur authentifié. */
  private creerSession(utilisateur: Utilisateur): SessionMembre {
    return {
      utilisateur,
      membre: membreParUtilisateur(utilisateur.id),
      doit_changer_mot_de_passe: utilisateur.doit_changer_mot_de_passe,
      jeton_acces: `jeton-mock-${utilisateur.id}`,
      expire_at: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
    };
  }
}
