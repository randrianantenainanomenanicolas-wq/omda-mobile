/**
 * `MemberRepository` réel (Supabase : Auth + DB + Storage) — étapes 17 à 23.
 *
 * Étape 20 — STORAGE branché : `televerserFichier` (envoi NATIF avec progression
 * et annulation) et `obtenirUrlFichier` (lien de consultation SIGNÉ pour les
 * buckets privés) délèguent à `./storage` — buckets `pieces` / `oeuvres`
 * uniquement. Le `mime_type` rendu par l'envoi est celui qui sera enregistré
 * dans `attestation_diffusion.mime_type` (colonne `not null`) par les écritures
 * d'œuvres.
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
 * Étape 23 — ÉCRITURES DES ŒUVRES ET DES CATÉGORIES branchées (validations,
 * codes, messages et ordre identiques aux mocks, écritures RESTREINTES au
 * membre connecté — RLS en garde-fou final) :
 *
 * - Œuvres (Q, R, S) : `creerOeuvre` (brouillon `BROUILLON`),
 *   `mettreAJourOeuvre` (`STATUTS_OEUVRE_MODIFIABLES` seulement, champs
 *   transmis seuls), `soumettreOeuvre` (`ENVOYEE` + `date_soumission`) ;
 * - Attestation (règle métier 8) : remplacement en UPsert sur
 *   `attestation_diffusion` — INSERT si aucune ligne, UPDATE sinon,
 *   JAMAIS de DELETE ;
 * - Catégories (règle métier 9) : `demanderCategorieSupplementaireAvecOeuvres`
 *   (appartenance créée ou rouverte au statut `EN_ATTENTE`) et
 *   `annulerDemandeCategorie` (`EN_ATTENTE` ⇒ `ANNULEE`).
 *
 * Restent refusés proprement via `erreurNonBranche()` (aucun écran ne plante
 * en mode réel) : `demanderCategorieSupplementaire` (variante simple, sans
 * écran), `mettreAJourProfil`, les paiements et le marquage des notifications.
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
  TypeMime,
  UUID,
  Utilisateur,
} from '../../models';
import {
  STATUTS_OEUVRE_MODIFIABLES,
  TAILLE_MAX_FICHIER_OCTETS,
  TYPES_MIME_ATTESTATION,
  TYPES_MIME_AUTORISES,
} from '../../models';
import {
  CODES_ERREUR_CANDIDAT,
  CODES_ERREUR_MEMBRE,
  erreurMetier,
  erreurReseau,
  erreurServeur,
  ok,
  type CategoriesMembre,
  type CreerOeuvreEntree,
  type DemandeCategorieOeuvresEntree,
  type FichierDepose,
  type FichierTeleverse,
  type InitierPaiementMembreEntree,
  type ListerCotisationsEntree,
  type ListerNotificationsEntree,
  type ListerOeuvresEntree,
  type MemberRepository,
  type MiseAJourProfilEntree,
  type MettreAJourOeuvreEntree,
  type OptionsTeleversement,
  type OeuvreDemandeCategorieEntree,
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
import { bucketDepuisChemin, getSignedUrl, uploadFile } from './storage';

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

/** Refus métier standard d'un document absent du Storage (message des mocks). */
function refusFichierIntrouvable(): ResultErr {
  return erreurMetier(
    CODES_ERREUR_MEMBRE.FICHIER_INTROUVABLE,
    'Ce document n’est pas disponible. Rechargez la fiche puis réessayez.',
  );
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

/* ------------------------------------------------- Écritures (étape 23) */

/**
 * Code identique à `CODES_MOCK.OEUVRE_NON_MODIFIABLE` (`docs/DONNEES_TEST.md`)
 * : les mocks ne sont PAS importés ici, pour ne jamais embarquer leur état.
 */
const CODE_OEUVRE_NON_MODIFIABLE = 'OEUVRE_NON_MODIFIABLE';

/** Nombre minimum d'œuvres d'une demande de catégorie (règle métier 9 étendue). */
const NOMBRE_MINIMUM_OEUVRES_CATEGORIE = 2;

/** Un type MIME appartient-il au bucket `oeuvres` (fichier de l'œuvre) ? */
function mimeAutoriseOeuvre(mime: TypeMime): boolean {
  return (TYPES_MIME_AUTORISES.oeuvres as readonly string[]).includes(mime);
}

/** Règle métier 8 : une attestation de diffusion est un DOCUMENT (jamais d'audio). */
function mimeAutoriseAttestation(mime: TypeMime): boolean {
  return (TYPES_MIME_ATTESTATION as readonly string[]).includes(mime);
}

/**
 * Exigences de la règle métier 9 étendue : AU MOINS 2 œuvres, chacune avec un
 * titre, un fichier téléversé et son attestation de diffusion (règle métier 8).
 * Revalide côté « serveur » ce que l'écran contrôle déjà (20 Mo, MIME) — codes
 * et messages identiques à `refusOeuvresDemande` des mocks.
 * Retourne `null` lorsque la demande peut être déposée.
 */
function refusOeuvresDemandeReel(oeuvres: OeuvreDemandeCategorieEntree[]): ResultErr | null {
  if (oeuvres.length < NOMBRE_MINIMUM_OEUVRES_CATEGORIE) {
    return erreurMetier(
      CODES_ERREUR_MEMBRE.OEUVRE_MINIMUM_REQUIS,
      'Joignez au moins 2 œuvres à votre demande de catégorie.',
    );
  }

  for (const oeuvre of oeuvres) {
    const titre = oeuvre.titre.trim();
    if (!titre) {
      return erreurMetier(CODES_ERREUR_MEMBRE.OEUVRE_INCOMPLETE, 'Chaque œuvre doit être titrée.');
    }
    if (!oeuvre.fichier.chemin_stockage) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.OEUVRE_INCOMPLETE,
        `Le fichier de l’œuvre « ${titre} » est manquant.`,
      );
    }
    if (!oeuvre.attestation.chemin_stockage) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.ATTESTATION_MANQUANTE,
        `Joignez une attestation de diffusion à l’œuvre « ${titre} ».`,
      );
    }

    for (const fichier of [oeuvre.fichier, oeuvre.attestation]) {
      if (fichier.taille_octets > TAILLE_MAX_FICHIER_OCTETS) {
        return erreurMetier(
          CODES_ERREUR_MEMBRE.FICHIER_TROP_VOLUMINEUX,
          'Un fichier dépasse la taille maximale de 20 Mo.',
        );
      }
    }

    /** Fichier de l'œuvre : MP3, WAV, PDF, JPEG ou PNG. */
    if (!mimeAutoriseOeuvre(oeuvre.fichier.mime_type)) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.TYPE_FICHIER_NON_AUTORISE,
        'Le fichier de l’œuvre n’a pas un format accepté (MP3, WAV, PDF, JPEG ou PNG).',
      );
    }

    /** Attestation de diffusion : un DOCUMENT uniquement (PDF, JPEG ou PNG). */
    if (!mimeAutoriseAttestation(oeuvre.attestation.mime_type)) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.TYPE_FICHIER_NON_AUTORISE,
        'L’attestation de diffusion n’accepte que les formats PDF, JPEG et PNG.',
      );
    }
  }
  return null;
}

/**
 * Écriture n'ayant affecté AUCUNE ligne : la ligne a disparu ou les politiques
 * RLS l'ont filtrée (PostgREST ignore silencieusement une mise à jour filtrée)
 * — même classification qu'un refus d'accès PostgREST (`classerErreurRequete`).
 */
function refusEcritureSansLigne(): ResultErr {
  return sessionRequise();
}

/**
 * Remplace l'attestation de diffusion d'une œuvre — UPsert sur
 * `attestation_diffusion` : `UPDATE` de la ligne existante la plus ancienne,
 * `INSERT` si l'œuvre n'en a pas encore, JAMAIS de `DELETE` (règle métier 8 :
 * une œuvre garde toujours une attestation ; l'application ne propose que le
 * remplacement). `null` = succès, refus typé sinon. L'appartenance de l'œuvre
 * au membre connecté est déjà vérifiée par l'appelant et par la politique
 * `attestation_select_owner_or_staff`.
 */
async function remplacerAttestationReelle(
  oeuvreId: UUID,
  fichier: FichierDepose,
): Promise<ResultErr | null> {
  try {
    const client = getSupabaseClient();
    const charge: Record<string, unknown> = {
      chemin_stockage: fichier.chemin_stockage,
      mime_type: fichier.mime_type,
      taille_octets: fichier.taille_octets,
    };

    const existantes = await client
      .from('attestation_diffusion')
      .select('id')
      .eq('oeuvre_id', oeuvreId)
      .order('created_at', { ascending: true })
      .limit(1);
    if (existantes.error) {
      return classerErreurRequete(existantes.error);
    }
    const premiere = (existantes.data ?? [])[0] as { id: UUID } | undefined;

    const reponse = premiere
      ? await client
          .from('attestation_diffusion')
          .update(charge)
          .eq('id', premiere.id)
          .select('id')
      : await client
          .from('attestation_diffusion')
          .insert({ oeuvre_id: oeuvreId, ...charge })
          .select('id');
    if (reponse.error) {
      return classerErreurRequete(reponse.error);
    }
    if ((reponse.data ?? []).length === 0) {
      return refusEcritureSansLigne();
    }
    return null;
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

  /**
   * Variante simple (sans œuvres), conservée pour compatibilité : aucun écran
   * ne l'appelle — le parcours de l'application passe par
   * `demanderCategorieSupplementaireAvecOeuvres`.
   */
  async demanderCategorieSupplementaire(categorie_id: UUID): Promise<Result<MembreCategorie>> {
    return erreurNonBranche();
  }

  /**
   * Demande AVEC œuvres (règle métier 9 étendue) : mêmes refus et mêmes
   * messages que les mocks, dans le même ordre — catégorie active du
   * référentiel et non déjà `ACTIVE` / `EN_ATTENTE` (`CATEGORIE_*`), puis
   * exigences sur les œuvres (≥ 2, titre, fichier, attestation, 20 Mo, MIME).
   *
   * Écriture RLS-safe : l'appartenance est créée — ou rouverte après `ANNULEE`
   * / `REJETEE` — au statut `EN_ATTENTE`, avec `date_activation` portant
   * l'horodatage de la demande et un filtre explicite sur le `membre_id` du
   * membre connecté ; `ACTIVE` n'est JAMAIS appliqué localement (décision d'un
   * agent OMDA). Conformément aux mocks, aucune ligne `oeuvre` n'est créée pour
   * les œuvres jointes : leur rattachement appartient à un agent OMDA.
   */
  async demanderCategorieSupplementaireAvecOeuvres(
    entree: DemandeCategorieOeuvresEntree,
  ): Promise<Result<MembreCategorie>> {
    const contexte = await contexteMembreReel();
    if (!contexte.ok) {
      return contexte;
    }
    try {
      const client = getSupabaseClient();
      const membreId = contexte.valeur.membre.id;

      /** Catégorie présente et `actif = true` au référentiel (lecture publique). */
      const reponseCategorie = await client
        .from('categorie')
        .select('id')
        .eq('id', entree.categorie_id)
        .eq('actif', true)
        .maybeSingle();
      if (reponseCategorie.error) {
        return classerErreurRequete(reponseCategorie.error);
      }
      if (!reponseCategorie.data) {
        return erreurMetier(
          CODES_ERREUR_MEMBRE.CATEGORIE_INDISPONIBLE,
          'Cette catégorie n’est pas proposée actuellement.',
        );
      }

      /** Appartenance éventuelle du membre pour cette catégorie. */
      const reponseAppartenance = await client
        .from('membre_categorie')
        .select('*')
        .eq('membre_id', membreId)
        .eq('categorie_id', entree.categorie_id)
        .maybeSingle();
      if (reponseAppartenance.error) {
        return classerErreurRequete(reponseAppartenance.error);
      }
      const existante = reponseAppartenance.data as MembreCategorie | null;
      if (existante?.statut === 'EN_ATTENTE') {
        return erreurMetier(
          CODES_ERREUR_MEMBRE.CATEGORIE_DEJA_DEMANDEE,
          'Une demande est déjà en attente pour cette catégorie.',
        );
      }
      if (existante && existante.statut !== 'ANNULEE' && existante.statut !== 'REJETEE') {
        return erreurMetier(
          CODES_ERREUR_MEMBRE.CATEGORIE_DEJA_ENREGISTREE,
          'Cette catégorie figure déjà dans votre profil.',
        );
      }

      /** Œuvres jointes : revalidées côté « serveur » (règles métier 8 et 9). */
      const refusOeuvres = refusOeuvresDemandeReel(entree.oeuvres);
      if (refusOeuvres) {
        return refusOeuvres;
      }

      const horodatage = new Date().toISOString();
      if (existante) {
        /** Réouverture d'une demande annulée ou refusée : statut + horodatage. */
        const reponse = await client
          .from('membre_categorie')
          .update({ statut: 'EN_ATTENTE', date_activation: horodatage })
          .eq('id', existante.id)
          .eq('membre_id', membreId)
          .select('*');
        if (reponse.error) {
          return classerErreurRequete(reponse.error);
        }
        const [appartenance] = reponse.data ?? [];
        if (!appartenance) {
          return refusEcritureSansLigne();
        }
        return ok(appartenance as MembreCategorie);
      }

      const reponse = await client
        .from('membre_categorie')
        .insert({
          membre_id: membreId,
          categorie_id: entree.categorie_id,
          statut: 'EN_ATTENTE',
          date_activation: horodatage,
        })
        .select('*');
      if (reponse.error) {
        return classerErreurRequete(reponse.error);
      }
      const [appartenance] = reponse.data ?? [];
      if (!appartenance) {
        return refusEcritureSansLigne();
      }
      return ok(appartenance as MembreCategorie);
    } catch (cause) {
      return erreurReseau(texteDe(cause));
    }
  }

  /**
   * Annulation d'une demande `EN_ATTENTE` (règle métier 9) : l'appartenance
   * passe au statut `ANNULEE` — enregistrement conservé, jamais supprimé — avec
   * un filtre explicite sur le `membre_id` du membre connecté. Une catégorie
   * `ACTIVE` ou déjà traitée reste du ressort de l'agent OMDA
   * (`DEMANDE_NON_ANNUABLE`). Les œuvres jointes n'étant pas stockées en base
   * (aucune ligne `oeuvre` créée), rien n'est à retirer ici.
   */
  async annulerDemandeCategorie(membre_categorie_id: UUID): Promise<Result<MembreCategorie>> {
    const contexte = await contexteMembreReel();
    if (!contexte.ok) {
      return contexte;
    }
    try {
      const client = getSupabaseClient();
      const membreId = contexte.valeur.membre.id;
      const reponseAppartenance = await client
        .from('membre_categorie')
        .select('*')
        .eq('id', membre_categorie_id)
        .eq('membre_id', membreId)
        .maybeSingle();
      if (reponseAppartenance.error) {
        return classerErreurRequete(reponseAppartenance.error);
      }
      const appartenance = reponseAppartenance.data as MembreCategorie | null;
      if (!appartenance) {
        return erreurMetier(
          CODES_ERREUR_MEMBRE.DEMANDE_CATEGORIE_INTROUVABLE,
          'Cette demande de catégorie est introuvable.',
        );
      }
      if (appartenance.statut !== 'EN_ATTENTE') {
        return erreurMetier(
          CODES_ERREUR_MEMBRE.DEMANDE_NON_ANNUABLE,
          'Seule une demande encore en attente peut être annulée.',
        );
      }

      const reponse = await client
        .from('membre_categorie')
        .update({ statut: 'ANNULEE', date_activation: new Date().toISOString() })
        .eq('id', appartenance.id)
        .eq('membre_id', membreId)
        .select('*');
      if (reponse.error) {
        return classerErreurRequete(reponse.error);
      }
      const [annulee] = reponse.data ?? [];
      if (!annulee) {
        return refusEcritureSansLigne();
      }
      return ok(annulee as MembreCategorie);
    } catch (cause) {
      return erreurReseau(texteDe(cause));
    }
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

  /**
   * Lien temporaire de consultation d'un document (écoute audio / ouverture
   * depuis la fiche de l'œuvre). Le bucket est déduit du chemin de stockage
   * (`pieces/...` ou `oeuvres/...`) : un chemin inconnu est refusé, et l'URL est
   * TOUJOURS signée par Supabase Storage (aucun lien construit par l'écran).
   */
  async obtenirUrlFichier(chemin_stockage: string): Promise<Result<UrlFichierConsulte>> {
    const chemin = chemin_stockage.trim();
    const bucket = bucketDepuisChemin(chemin);
    if (!bucket) {
      return refusFichierIntrouvable();
    }
    return getSignedUrl(bucket, chemin);
  }

  /**
   * Brouillon d'œuvre : aucun envoi, aucun paiement (règle métier 4). Ligne
   * créée pour le membre connecté (`membre_id` lié à `auth.uid()`, politique
   * `oeuvre_insert_owner_or_staff`), statut `BROUILLON` par défaut au schéma.
   */
  async creerOeuvre(entree: CreerOeuvreEntree): Promise<Result<Oeuvre>> {
    const contexte = await contexteMembreReel();
    if (!contexte.ok) {
      return contexte;
    }
    try {
      const reponse = await getSupabaseClient()
        .from('oeuvre')
        .insert({
          membre_id: contexte.valeur.membre.id,
          categorie_id: entree.categorie_id,
          titre: entree.titre.trim(),
          description: entree.description ?? null,
          annee: entree.annee ?? null,
          statut: 'BROUILLON',
        })
        .select('*');
      if (reponse.error) {
        return classerErreurRequete(reponse.error);
      }
      const [oeuvre] = reponse.data ?? [];
      if (!oeuvre) {
        return refusEcritureSansLigne();
      }
      return ok(oeuvre as Oeuvre);
    } catch (cause) {
      return erreurReseau(texteDe(cause));
    }
  }

  /**
   * Correction d'une œuvre encore modifiable — STRICTEMENT
   * `STATUTS_OEUVRE_MODIFIABLES` (`BROUILLON`, `ENVOYEE`,
   * `EN_COURS_DE_VALIDATION`), même refus `OEUVRE_NON_MODIFIABLE` et mêmes
   * messages que les mocks. Seuls les champs TRANSMIS sont mis à jour (le
   * statut, la date de soumission et le motif de rejet ne sont JAMAIS touchés) ;
   * `fichier` remplace le document déposé et `attestation` remplace
   * l'attestation (upsert, jamais de suppression) ; aucune correction ne
   * déclenche de paiement. Écriture filtrée par `membre_id` du membre connecté.
   */
  async mettreAJourOeuvre(
    oeuvre_id: UUID,
    entree: MettreAJourOeuvreEntree,
  ): Promise<Result<Oeuvre>> {
    const contexte = await contexteMembreReel();
    if (!contexte.ok) {
      return contexte;
    }
    try {
      const client = getSupabaseClient();
      const membreId = contexte.valeur.membre.id;
      const reponseOeuvre = await client
        .from('oeuvre')
        .select('*')
        .eq('id', oeuvre_id)
        .eq('membre_id', membreId)
        .maybeSingle();
      if (reponseOeuvre.error) {
        return classerErreurRequete(reponseOeuvre.error);
      }
      const oeuvre = reponseOeuvre.data as Oeuvre | null;
      if (!oeuvre) {
        return refusOeuvreIntrouvable();
      }
      if (!STATUTS_OEUVRE_MODIFIABLES.includes(oeuvre.statut)) {
        return erreurMetier(
          CODE_OEUVRE_NON_MODIFIABLE,
          'Cette œuvre a déjà été traitée par l’OMDA : elle n’est plus modifiable depuis cet écran.',
        );
      }

      const miseAJour: Record<string, unknown> = { updated_at: new Date().toISOString() };
      if (entree.titre !== undefined) {
        miseAJour.titre = entree.titre.trim();
      }
      if (entree.categorie_id !== undefined) {
        miseAJour.categorie_id = entree.categorie_id;
      }
      if (entree.description !== undefined) {
        miseAJour.description = entree.description;
      }
      if (entree.annee !== undefined) {
        miseAJour.annee = entree.annee;
      }
      /** Remplacement du fichier de l'œuvre (l'ancien n'est plus référencé). */
      if (entree.fichier !== undefined) {
        miseAJour.chemin_fichier = entree.fichier.chemin_stockage;
        miseAJour.mime_type = entree.fichier.mime_type;
        miseAJour.taille_octets = entree.fichier.taille_octets;
      }

      const reponse = await client
        .from('oeuvre')
        .update(miseAJour)
        .eq('id', oeuvre.id)
        .eq('membre_id', membreId)
        .select('*');
      if (reponse.error) {
        return classerErreurRequete(reponse.error);
      }
      const [miseAJourLigne] = reponse.data ?? [];
      if (!miseAJourLigne) {
        return refusEcritureSansLigne();
      }

      /** Remplacement de l'attestation de diffusion (jamais de suppression). */
      if (entree.attestation !== undefined) {
        const refusAttestation = await remplacerAttestationReelle(oeuvre.id, entree.attestation);
        if (refusAttestation) {
          return refusAttestation;
        }
      }
      return ok(miseAJourLigne as Oeuvre);
    } catch (cause) {
      return erreurReseau(texteDe(cause));
    }
  }

  /**
   * Envoi d'une œuvre : passage à `ENVOYEE` avec `date_soumission`, son fichier
   * et au moins une attestation de diffusion (règle métier 8 — refus
   * `DOSSIER_INCOMPLET` identique au mock). Aucun paiement n'est déclenché
   * (règle métier 4). L'attestation est enregistrée AVANT la transition :
   * une œuvre ne passe jamais à `ENVOYEE` sans son attestation.
   */
  async soumettreOeuvre(entree: SoumettreOeuvreEntree): Promise<Result<Oeuvre>> {
    const contexte = await contexteMembreReel();
    if (!contexte.ok) {
      return contexte;
    }
    try {
      const client = getSupabaseClient();
      const membreId = contexte.valeur.membre.id;
      const reponseOeuvre = await client
        .from('oeuvre')
        .select('*')
        .eq('id', entree.oeuvre_id)
        .eq('membre_id', membreId)
        .maybeSingle();
      if (reponseOeuvre.error) {
        return classerErreurRequete(reponseOeuvre.error);
      }
      const oeuvre = reponseOeuvre.data as Oeuvre | null;
      if (!oeuvre) {
        return refusOeuvreIntrouvable();
      }
      if (oeuvre.statut !== 'BROUILLON') {
        return erreurMetier(
          CODE_OEUVRE_NON_MODIFIABLE,
          'Cette œuvre a déjà été envoyée : vous pouvez suivre son état.',
        );
      }
      if (entree.attestations.length === 0) {
        return erreurMetier(
          CODES_ERREUR_CANDIDAT.DOSSIER_INCOMPLET,
          'Joignez au moins une attestation de diffusion avant d’envoyer l’œuvre.',
        );
      }

      /** Attestation de diffusion enregistrée avec l'œuvre (règle métier 8). */
      const [attestation] = entree.attestations;
      const refusAttestation = await remplacerAttestationReelle(oeuvre.id, attestation);
      if (refusAttestation) {
        return refusAttestation;
      }

      const horodatage = new Date().toISOString();
      const reponse = await client
        .from('oeuvre')
        .update({
          chemin_fichier: entree.fichier.chemin_stockage,
          mime_type: entree.fichier.mime_type,
          taille_octets: entree.fichier.taille_octets,
          statut: 'ENVOYEE',
          date_soumission: horodatage,
          updated_at: horodatage,
        })
        .eq('id', oeuvre.id)
        .eq('membre_id', membreId)
        .select('*');
      if (reponse.error) {
        return classerErreurRequete(reponse.error);
      }
      const [envoyee] = reponse.data ?? [];
      if (!envoyee) {
        return refusEcritureSansLigne();
      }
      return ok(envoyee as Oeuvre);
    } catch (cause) {
      return erreurReseau(texteDe(cause));
    }
  }

  /**
   * Téléverse un fichier (bucket `pieces` ou `oeuvres`) avec progression réelle
   * et annulation : contrôles locaux (format du bucket, 20 Mo) puis délégation à
   * la couche Storage (`./storage`). Le fichier n'est « accepté » qu'après la
   * confirmation du serveur ; aucune exception ne remonte à l'écran.
   */
  async televerserFichier(
    entree: TeleversementEntree,
    options?: OptionsTeleversement,
  ): Promise<Result<FichierTeleverse>> {
    return uploadFile(entree, options);
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
