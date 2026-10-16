/**
 * Fabrique de services — point d'entrée UNIQUE de la couche data.
 *
 * La sélection mock ⇄ réel est SÉPARÉE PAR PARCOURS (deux flags indépendants) :
 *
 * | Parcours | Variable dédiée                   | Repli si elle est absente |
 * |---|---|---|
 * | MEMBRE (connecté) | `EXPO_PUBLIC_USE_MOCKS_MEMBER` | `EXPO_PUBLIC_USE_MOCKS` |
 * | CANDIDAT (sans compte) | `EXPO_PUBLIC_USE_MOCKS_CANDIDATE` | `EXPO_PUBLIC_USE_MOCKS` |
 *
 * Règles :
 * - mock PAR DÉFAUT : seule la valeur exacte `false` (insensible à la casse et
 *   aux espaces) bascule un parcours en réel ; toute autre valeur, y compris
 *   une variable absente ou vide, conserve les mocks ;
 * - `EXPO_PUBLIC_USE_MOCKS` reste le REPLI des deux parcours quand la variable
 *   dédiée n'est pas définie (compatibilité avec les `.env` déjà en place) ;
 * - parcours CANDIDAT : `EXPO_PUBLIC_USE_MOCKS_CANDIDATE=false` instancie
 *   `HttpCandidateApi` OBLIGATOIREMENT (étape 26 : plus aucun repli mock) —
 *   même si `EXPO_PUBLIC_API_BASE_URL` est vide : chaque appel renvoie alors un
 *   `Result` `serveur` (« L'API OMDA n'est pas configurée… »), sans exception
 *   ni appel réseau ; le flag est donc le SEUL sélecteur de ce parcours ;
 * - parcours MEMBRE : `authService`, `memberRepository` ET
 *   `publicContentService` suivent le même flag (les contenus publics sont des
 *   tables Supabase `documentation` / `categorie` / `tarif` /
 *   `operateur_mobile_money`).
 *
 * Les 4 singletons respectent EXACTEMENT les mêmes contrats que les mocks :
 * aucun écran n'a de code à changer au branchement (cf. `docs/BRANCHEMENT.md`).
 *
 * ⚠️ Les variables sont lues STATIQUEMENT (`process.env.EXPO_PUBLIC_…`) : c'est
 * la seule forme remplacée à la compilation par Expo. Les instanciations réelles
 * restent sans effet de bord — le client Supabase est PARESSEUX
 * (`getSupabaseClient()` au premier appel) — donc une configuration incomplète
 * ne casse jamais le démarrage de l'application.
 */
import type { AuthService, CandidateApi, MemberRepository, PublicContentService } from './contracts';
import { HttpCandidateApi } from './http/HttpCandidateApi';
import {
  mockAuthService,
  mockCandidateApi,
  mockMemberRepository,
  mockPublicContentService,
} from './mocks';
import {
  SupabaseAuthService,
  SupabaseMemberRepository,
  SupabasePublicContentService,
} from './supabase';

/* ------------------------------------- Lecture des variables (à l'import) */

/**
 * Interprète un drapeau mock ⇄ réel : `null` quand la variable est absente ou
 * vide (⇒ repli), `true` (mock) sauf pour la valeur exacte `false` (réel).
 */
function lireDrapeau(valeur: string | undefined): boolean | null {
  const brut = (valeur ?? '').trim().toLowerCase();
  if (brut.length === 0) {
    return null;
  }
  return brut !== 'false';
}

/** URL de l'API REST candidat (`EXPO_PUBLIC_API_BASE_URL`), vide si non configurée. */
const API_BASE_URL_CANDIDAT = (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim();

/** Drapeaux lus UNE seule fois : Expo remplace `process.env.EXPO_PUBLIC_…` au build. */
const DRAPEAU_HISTORIQUE = lireDrapeau(process.env.EXPO_PUBLIC_USE_MOCKS);
const DRAPEAU_MEMBRE = lireDrapeau(process.env.EXPO_PUBLIC_USE_MOCKS_MEMBER);
const DRAPEAU_CANDIDAT = lireDrapeau(process.env.EXPO_PUBLIC_USE_MOCKS_CANDIDATE);

/** Repli commun aux deux parcours : mock par défaut, même sans aucune variable. */
const REPLI_MOCK = DRAPEAU_HISTORIQUE ?? true;

/**
 * Vrai tant que le mode démonstration est actif d'après la valeur HISTORIQUE
 * `EXPO_PUBLIC_USE_MOCKS` (repli des deux parcours) : seule la valeur exacte
 * `false` — insensible à la casse et aux espaces — active les services réels.
 */
export function estModeMockActif(): boolean {
  return REPLI_MOCK;
}

/**
 * Vrai si l'API REST du parcours candidat est renseignée (`EXPO_PUBLIC_API_BASE_URL`).
 * Diagnostic seul (écran dev `/dev/env`) : ne pilote PLUS la sélection du
 * service (étape 26 — le flag `EXPO_PUBLIC_USE_MOCKS_CANDIDATE` est le seul
 * sélecteur mock ⇄ réel du parcours candidat).
 */
export function estApiCandidatConfiguree(): boolean {
  return API_BASE_URL_CANDIDAT.length > 0;
}

/**
 * Vrai si le parcours MEMBRE (auth + données + contenus publics) reste en mock :
 * `EXPO_PUBLIC_USE_MOCKS_MEMBER` si elle est définie, sinon repli historique.
 */
export function estModeMockMembre(): boolean {
  return DRAPEAU_MEMBRE ?? REPLI_MOCK;
}

/**
 * Vrai si le parcours CANDIDAT reste en mock : `EXPO_PUBLIC_USE_MOCKS_CANDIDATE`
 * si elle est définie, sinon repli historique. Le flag est le SEUL sélecteur
 * (étape 26) : `false` ⇒ `HttpCandidateApi` même sans `EXPO_PUBLIC_API_BASE_URL`
 * (erreur `serveur` typée à chaque appel, aucun repli sur le mock).
 */
export function estModeMockCandidat(): boolean {
  return DRAPEAU_CANDIDAT ?? REPLI_MOCK;
}

/* --------------------------------------------------------------- Singletons */

/** Parcours membre : les 3 services suivent le MÊME flag. */
const membreEnMock = estModeMockMembre();
/** Parcours candidat : mock si et seulement si le flag le demande (étape 26 : plus de repli sur l'absence d'URL). */
const candidatEnMock = estModeMockCandidat();

/** Authentification du membre (mock ⇄ Supabase Auth). */
export const authService: AuthService = membreEnMock ? mockAuthService : new SupabaseAuthService();

/** Accès aux données du membre connecté (mock ⇄ Supabase DB/Storage). */
export const memberRepository: MemberRepository = membreEnMock
  ? mockMemberRepository
  : new SupabaseMemberRepository();

/** Contenus publics (mock ⇄ Supabase, lecture seule). */
export const publicContentService: PublicContentService = membreEnMock
  ? mockPublicContentService
  : new SupabasePublicContentService();

/**
 * API candidate : mock si le flag le demande, sinon API REST Express via
 * `EXPO_PUBLIC_API_BASE_URL` — URL vide ⇒ `Result` `serveur` typé à chaque
 * appel (« L'API OMDA n'est pas configurée… »), jamais d'exception (étape 26).
 */
export const candidateApi: CandidateApi = candidatEnMock ? mockCandidateApi : new HttpCandidateApi();
