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
 * - parcours CANDIDAT : même avec `EXPO_PUBLIC_USE_MOCKS_CANDIDATE=false`, le
 *   mock est CONSERVÉ tant que `EXPO_PUBLIC_API_BASE_URL` est vide — sans API
 *   Express à joindre, `HttpCandidateApi` ne produirait que des erreurs de
 *   transport. Le parcours candidat reste donc fonctionnel en démonstration ;
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

/** Vrai si l'API REST du parcours candidat est renseignée (`EXPO_PUBLIC_API_BASE_URL`). */
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
 * si elle est définie, sinon repli historique — et MOCK OBLIGATOIRE tant que
 * `EXPO_PUBLIC_API_BASE_URL` est vide (aucune API Express à joindre).
 */
export function estModeMockCandidat(): boolean {
  const choix = DRAPEAU_CANDIDAT ?? REPLI_MOCK;
  return choix || !estApiCandidatConfiguree();
}

/* --------------------------------------------------------------- Singletons */

/** Parcours membre : les 3 services suivent le MÊME flag. */
const membreEnMock = estModeMockMembre();
/** Parcours candidat : mock si le flag le demande OU si l'API n'est pas configurée. */
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

/** API candidate (mock ⇄ API REST Express via `EXPO_PUBLIC_API_BASE_URL`). */
export const candidateApi: CandidateApi = candidatEnMock ? mockCandidateApi : new HttpCandidateApi();
