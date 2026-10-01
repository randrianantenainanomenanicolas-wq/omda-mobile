/**
 * `MemberRepository` réel (Supabase : Auth + DB + Storage) — étapes 17 et 18.
 *
 * Étape 18 — LECTURES branchées sur les tables du schéma
 * (`docs/SCHEMA_DB.md`), chaque requête étant filtrée par le membre connecté
 * (les politiques RLS restent le garde-fou final) :
 *
 * - Profil (U)        : `utilisateur`, `membre`, `membre_categorie`, `categorie`
 * - Accueil (P)       : `candidat`, `oeuvre`, `cotisation`, `notification`
 * - Œuvres (Q, R, S)  : `oeuvre`, `attestation_diffusion`
 * - Cotisations (T)   : `cotisation`
 * - Notifications (V) : `notification` (+ annonces globales)
 *
 * Les ÉCRITURES (profil, catégories, œuvres, paiements, notifications) et le
 * STORAGE (`obtenirUrlFichier`, `televerserFichier`) refusent encore proprement
 * via `erreurNonBranche()` : aucun écran ne plante en mode réel.
 *
 * Le mode mock reste le défaut : `EXPO_PUBLIC_USE_MOCKS` non passé à `false`
 * n'instancie jamais cette classe (cf. `docs/BRANCHEMENT.md`).
 */
import type { AuthError, PostgrestError } from '@supabase/supabase-js';

import type {
  AttestationDiffusion,
  Candidat,
  Categorie,
  Cotisation,
  Membre,
  MembreCategorie,
  Notification,
  Oeuvre,
  Paiement,
  UUID,
  Utilisateur,
} from '../../models';
import {
  CODES_ERREUR_MEMBRE,
  erreurMetier,
  erreurReseau,
  erreurServeur,
  ok,
  type CategoriesMembre,
  type CreerOeuvreEntree,
  type DemandeCategorieOeuvresEntree,
  type FichierTeleverse,
  type InitierPaiementMembreEntree,
  type ListerCotisationsEntree,
  type ListerNotificationsEntree,
  type ListerOeuvresEntree,
  type MemberRepository,
  type MiseAJourProfilEntree,
  type MettreAJourOeuvreEntree,
  type OptionsTeleversement,
  type ProfilMembre,
  type Result,
  type ResultErr,
  type SoumettreOeuvreEntree,
  type TableauDeBordEntree,
  type TableauDeBordMembre,
  type TeleversementEntree,
  type UrlFichierConsulte,
} from '../contracts';
import { erreurNonBranche } from '../nonImplemente';
import { estSupabaseConfigure, getSupabaseClient, MESSAGE_SUPABASE_NON_CONFIGURE } from './client';

/* --------------------------------------------------------------- Helpers */

/** Détail technique d'une exception (journal seulement, jamais affiché brut). */
function texteDe(cause: unknown): string | undefined {
  if (cause instanceof Error) {
    return cause.message;
  }
  if (typeof cause === 'string') {
    return cause;
  }
  return undefined;
}

/** Refus métier standard sans session (code et message identiques aux mocks). */
function sessionRequise(): ResultErr {
  return erreurMetier(
    CODES_ERREUR_MEMBRE.NON_AUTHENTIFIE,
    'Vous devez être connecté pour accéder à cette information.',
  );
}

/** Refus métier standard d'une œuvre inconnue ou n'appartenant pas au membre. */
function refusOeuvreIntrouvable(): ResultErr {
  return erreurMetier(CODES_ERREUR_MEMBRE.OEUVRE_INTROUVABLE, 'Cette œuvre est introuvable.');
}

/** Traduit une erreur de session Supabase en `Result` typé. */
function classerErreurSession(error: AuthError): ResultErr {
  const message = (error.message ?? '').toLowerCase();
  if (message.includes('fetch') || message.includes('network') || message.includes('timeout')) {
    return erreurReseau(error.message || undefined);
  }
  return erreurServeur({
    reference: error.code ?? undefined,
    message: 'La vérification de votre session a échoué. Réessayez dans un instant.',
  });
}

/**
 * Traduit une erreur de requête PostgREST en `Result` typé : refus d'accès
 * (JWT expiré, RLS) ⇒ `NON_AUTHENTIFIE`, transport ⇒ `reseau`, tout le reste
 * ⇒ `serveur` avec la référence technique. Aucune exception ne remonte à l'UI.
 */
function classerErreurRequete(error: PostgrestError): ResultErr {
  const message = (error.message ?? '').toLowerCase();
  if (
    error.code === 'PGRST301' ||
    message.includes('jwt') ||
    message.includes('permission denied') ||
    message.includes('row-level security')
  ) {
    return sessionRequise();
  }
  if (
    message.includes('fetch') ||
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('failed')
  ) {
    return erreurReseau(error.message || undefined);
  }
  return erreurServeur({
    reference: error.code || undefined,
    message: 'Le serveur n’a pas pu répondre à votre demande. Réessayez dans un instant.',
  });
}

/** Identifiant de l'utilisateur Supabase connecté, ou refus typé. */
async function utilisateurConnecte(): Promise<Result<UUID>> {
  if (!estSupabaseConfigure()) {
    return erreurServeur({ message: MESSAGE_SUPABASE_NON_CONFIGURE });
  }
  try {
    const { data, error } = await getSupabaseClient().auth.getSession();
    if (error) {
      return classerErreurSession(error);
    }
    const identifiant = data.session?.user.id;
    if (!identifiant) {
      return sessionRequise();
    }
    return ok(identifiant);
  } catch (cause) {
    return erreurReseau(texteDe(cause));
  }
}

type ContexteMembreReel = {
  utilisateur: Utilisateur;
  membre: Membre;
};

/**
 * Utilisateur + membre de la session courante, base de toutes les lectures :
 * sans session OU sans profil membre ⇒ `NON_AUTHENTIFIE` (même refus que les
 * mocks). Lignes filtrées par l'identifiant Supabase de l'utilisateur connecté.
 */
async function contexteMembreReel(): Promise<Result<ContexteMembreReel>> {
  const identifiant = await utilisateurConnecte();
  if (!identifiant.ok) {
    return identifiant;
  }
  try {
    const client = getSupabaseClient();
    const [reponseUtilisateur, reponseMembre] = await Promise.all([
      client.from('utilisateur').select('*').eq('id', identifiant.valeur).maybeSingle(),
      client.from('membre').select('*').eq('utilisateur_id', identifiant.valeur).maybeSingle(),
    ]);
    if (reponseUtilisateur.error) {
      return classerErreurRequete(reponseUtilisateur.error);
    }
    if (reponseMembre.error) {
      return classerErreurRequete(reponseMembre.error);
    }
    const utilisateur = reponseUtilisateur.data as Utilisateur | null;
    const membre = reponseMembre.data as Membre | null;
    if (!utilisateur || !membre) {
      return sessionRequise();
    }
    return ok({ utilisateur, membre });
  } catch (cause) {
    return erreurReseau(texteDe(cause));
  }
}

/**
 * Appartenances (`membre_categorie`) + référentiel (`categorie`) d'un membre,
 * dans l'ordre des appartenances — résultat identique aux mocks.
 */
async function categoriesDuMembreReel(membreId: UUID): Promise<Result<CategoriesMembre>> {
  try {
    const client = getSupabaseClient();
    const reponseAppartenances = await client
      .from('membre_categorie')
      .select('*')
      .eq('membre_id', membreId)
      .order('date_activation', { ascending: true });
    if (reponseAppartenances.error) {
      return classerErreurRequete(reponseAppartenances.error);
    }
    const appartenances = (reponseAppartenances.data ?? []) as MembreCategorie[];
    if (appartenances.length === 0) {
      return ok({ categories: [], membre_categories: appartenances });
    }

    const identifiants = appartenances.map((appartenance) => appartenance.categorie_id);
    const reponseCategories = await client.from('categorie').select('*').in('id', identifiants);
    if (reponseCategories.error) {
      return classerErreurRequete(reponseCategories.error);
    }
    const categories = (reponseCategories.data ?? []) as Categorie[];
    const parIdentifiant = new Map<string, Categorie>(
      categories.map((categorie) => [categorie.id, categorie]),
    );

    return ok({
      categories: appartenances
        .map((appartenance) => parIdentifiant.get(appartenance.categorie_id))
        .filter((categorie): categorie is Categorie => categorie !== undefined),
      membre_categories: appartenances,
    });
  } catch (cause) {
    return erreurReseau(texteDe(cause));
  }
}

export class SupabaseMemberRepository implements MemberRepository {
  /* ------------------------------------------------------------ Profil (U) */

  /** Profil complet : `utilisateur` + `membre` + catégories du membre. */
  async obtenirProfil(): Promise<Result<ProfilMembre>> {
    const contexte = await contexteMembreReel();
    if (!contexte.ok) {
      return contexte;
    }
    const categories = await categoriesDuMembreReel(contexte.valeur.membre.id);
    if (!categories.ok) {
      return categories;
    }
    return ok({
      utilisateur: contexte.valeur.utilisateur,
      membre: contexte.valeur.membre,
      ...categories.valeur,
    });
  }

  /** Appartenances `membre_categorie` + référentiel `categorie` du membre. */
  async listerCategoriesMembre(): Promise<Result<CategoriesMembre>> {
    const contexte = await contexteMembreReel();
    if (!contexte.ok) {
      return contexte;
    }
    return categoriesDuMembreReel(contexte.valeur.membre.id);
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

  /** Compteurs de l'accueil : salutation, œuvres, cotisation, notifications. */
  async obtenirTableauDeBord(entree?: TableauDeBordEntree): Promise<Result<TableauDeBordMembre>> {
    const contexte = await contexteMembreReel();
    if (!contexte.ok) {
      return contexte;
    }
    const { utilisateur, membre } = contexte.valeur;
    const annee = entree?.annee ?? new Date().getFullYear();

    try {
      const client = getSupabaseClient();
      const [candidat, oeuvres, cotisation, notifications] = await Promise.all([
        client.from('candidat').select('*').eq('utilisateur_id', utilisateur.id).maybeSingle(),
        client
          .from('oeuvre')
          .select('id', { count: 'exact', head: true })
          .eq('membre_id', membre.id),
        client
          .from('cotisation')
          .select('*')
          .eq('membre_id', membre.id)
          .eq('annee', annee)
          .maybeSingle(),
        client
          .from('notification')
          .select('id', { count: 'exact', head: true })
          .eq('lue', false)
          .or(`utilisateur_id.eq.${utilisateur.id},globale.eq.true`),
      ]);
      if (candidat.error) {
        return classerErreurRequete(candidat.error);
      }
      if (oeuvres.error) {
        return classerErreurRequete(oeuvres.error);
      }
      if (cotisation.error) {
        return classerErreurRequete(cotisation.error);
      }
      if (notifications.error) {
        return classerErreurRequete(notifications.error);
      }

      const profilCandidat = candidat.data as Candidat | null;
      return ok({
        prenom: profilCandidat ? profilCandidat.prenom : utilisateur.email,
        numero_adherent: membre.numero_adherent,
        statut_compte: membre.statut,
        nombre_oeuvres: oeuvres.count ?? 0,
        cotisation_annee: cotisation.data as Cotisation | null,
        notifications_non_lues: notifications.count ?? 0,
      });
    } catch (cause) {
      return erreurReseau(texteDe(cause));
    }
  }

  /* --------------------------------------------------------- Œuvres (Q, R, S) */

  /** Œuvres du membre, les plus récentes d'abord (filtre de statut optionnel). */
  async listerOeuvres(entree?: ListerOeuvresEntree): Promise<Result<Oeuvre[]>> {
    const contexte = await contexteMembreReel();
    if (!contexte.ok) {
      return contexte;
    }
    try {
      let requete = getSupabaseClient()
        .from('oeuvre')
        .select('*')
        .eq('membre_id', contexte.valeur.membre.id);
      if (entree?.statut) {
        requete = requete.eq('statut', entree.statut);
      }
      const reponse = await requete.order('created_at', { ascending: false });
      if (reponse.error) {
        return classerErreurRequete(reponse.error);
      }
      return ok((reponse.data ?? []) as Oeuvre[]);
    } catch (cause) {
      return erreurReseau(texteDe(cause));
    }
  }

  /** Détail d'une œuvre du membre (motif de rejet éventuel). */
  async obtenirOeuvre(oeuvre_id: UUID): Promise<Result<Oeuvre>> {
    const contexte = await contexteMembreReel();
    if (!contexte.ok) {
      return contexte;
    }
    try {
      const reponse = await getSupabaseClient()
        .from('oeuvre')
        .select('*')
        .eq('id', oeuvre_id)
        .eq('membre_id', contexte.valeur.membre.id)
        .maybeSingle();
      if (reponse.error) {
        return classerErreurRequete(reponse.error);
      }
      const oeuvre = reponse.data as Oeuvre | null;
      if (!oeuvre) {
        return refusOeuvreIntrouvable();
      }
      return ok(oeuvre);
    } catch (cause) {
      return erreurReseau(texteDe(cause));
    }
  }

  /**
   * Attestations de diffusion d'une œuvre du membre (règle métier 8) :
   * table séparée `attestation_diffusion`, les plus anciennes d'abord.
   */
  async listerAttestationsOeuvre(oeuvre_id: UUID): Promise<Result<AttestationDiffusion[]>> {
    const contexte = await contexteMembreReel();
    if (!contexte.ok) {
      return contexte;
    }
    try {
      const client = getSupabaseClient();
      const proprietaire = await client
        .from('oeuvre')
        .select('id')
        .eq('id', oeuvre_id)
        .eq('membre_id', contexte.valeur.membre.id)
        .maybeSingle();
      if (proprietaire.error) {
        return classerErreurRequete(proprietaire.error);
      }
      if (!proprietaire.data) {
        return refusOeuvreIntrouvable();
      }

      const reponse = await client
        .from('attestation_diffusion')
        .select('*')
        .eq('oeuvre_id', oeuvre_id)
        .order('created_at', { ascending: true });
      if (reponse.error) {
        return classerErreurRequete(reponse.error);
      }
      return ok((reponse.data ?? []) as AttestationDiffusion[]);
    } catch (cause) {
      return erreurReseau(texteDe(cause));
    }
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

  /** Cotisations du membre (année décroissante) ; filtre d'année optionnel. */
  async listerCotisations(entree?: ListerCotisationsEntree): Promise<Result<Cotisation[]>> {
    const contexte = await contexteMembreReel();
    if (!contexte.ok) {
      return contexte;
    }
    try {
      let requete = getSupabaseClient()
        .from('cotisation')
        .select('*')
        .eq('membre_id', contexte.valeur.membre.id);
      if (entree?.annee !== undefined) {
        requete = requete.eq('annee', entree.annee);
      }
      const reponse = await requete.order('annee', { ascending: false });
      if (reponse.error) {
        return classerErreurRequete(reponse.error);
      }
      return ok((reponse.data ?? []) as Cotisation[]);
    } catch (cause) {
      return erreurReseau(texteDe(cause));
    }
  }

  /** Cotisation d'une année donnée (refus `COTISATION_INTROUVABLE` sinon). */
  async obtenirCotisation(annee: number): Promise<Result<Cotisation>> {
    const contexte = await contexteMembreReel();
    if (!contexte.ok) {
      return contexte;
    }
    try {
      const reponse = await getSupabaseClient()
        .from('cotisation')
        .select('*')
        .eq('membre_id', contexte.valeur.membre.id)
        .eq('annee', annee)
        .maybeSingle();
      if (reponse.error) {
        return classerErreurRequete(reponse.error);
      }
      const cotisation = reponse.data as Cotisation | null;
      if (!cotisation) {
        return erreurMetier(
          CODES_ERREUR_MEMBRE.COTISATION_INTROUVABLE,
          `Aucune cotisation n’est enregistrée pour l’année ${annee}.`,
        );
      }
      return ok(cotisation);
    } catch (cause) {
      return erreurReseau(texteDe(cause));
    }
  }

  /* --------------------------------------------------------- Paiements (S, T) */

  async initierPaiement(entree: InitierPaiementMembreEntree): Promise<Result<Paiement>> {
    return erreurNonBranche();
  }

  async obtenirPaiement(paiement_id: UUID): Promise<Result<Paiement>> {
    return erreurNonBranche();
  }

  /* ----------------------------------------------------- Notifications (V) */

  /** Notifications du membre + annonces globales, les plus récentes d'abord. */
  async listerNotifications(entree?: ListerNotificationsEntree): Promise<Result<Notification[]>> {
    const contexte = await contexteMembreReel();
    if (!contexte.ok) {
      return contexte;
    }
    try {
      let requete = getSupabaseClient()
        .from('notification')
        .select('*')
        .or(`utilisateur_id.eq.${contexte.valeur.utilisateur.id},globale.eq.true`);
      if (entree?.non_lues_uniquement) {
        requete = requete.eq('lue', false);
      }
      if (entree?.type) {
        requete = requete.eq('type', entree.type);
      }
      const reponse = await requete.order('date_envoi', { ascending: false });
      if (reponse.error) {
        return classerErreurRequete(reponse.error);
      }
      return ok((reponse.data ?? []) as Notification[]);
    } catch (cause) {
      return erreurReseau(texteDe(cause));
    }
  }

  async marquerNotificationLue(notification_id: UUID): Promise<Result<Notification>> {
    return erreurNonBranche();
  }

  async marquerToutesNotificationsLues(): Promise<Result<number>> {
    return erreurNonBranche();
  }
}
