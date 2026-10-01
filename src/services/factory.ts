/**
 * Fabrique de services — point d'entrée UNIQUE de la couche data (étape 17).
 *
 * Sélection mock ⇄ réel via `EXPO_PUBLIC_USE_MOCKS` :
 * - valeur absente ou différente de `false` → IMPLÉMENTATIONS MOCK (défaut) ;
 * - `EXPO_PUBLIC_USE_MOCKS=false`            → implémentations réelles
 *   (`SupabaseAuthService`, `SupabaseMemberRepository`,
 *   `SupabasePublicContentService`, `HttpCandidateApi`).
 *
 * Les 4 singletons respectent EXACTEMENT les mêmes contrats que les mocks :
 * aucun écran n'a de code à changer au branchement (cf. `docs/BRANCHEMENT.md`).
 *
 * ⚠️ En mode réel, seules les implémentations ci-dessus sont instanciées ; le
 * client Supabase reste PARESSEUX (`getSupabaseClient()` au premier appel), donc
 * l'absence de configuration ne casse jamais le démarrage de l'application.
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

/**
 * Vrai tant que le mode démonstration est actif.
 * `EXPO_PUBLIC_USE_MOCKS` n'est désactivé que par la valeur exacte `false`
 * (insensible à la casse et aux espaces) : tout le reste conserve les mocks.
 */
export function estModeMockActif(): boolean {
  const brut = (process.env.EXPO_PUBLIC_USE_MOCKS ?? 'true').trim().toLowerCase();
  return brut !== 'false';
}

const utiliserMocks = estModeMockActif();

/** Authentification du membre (mock ⇄ Supabase Auth). */
export const authService: AuthService = utiliserMocks ? mockAuthService : new SupabaseAuthService();

/** Accès aux données du membre connecté (mock ⇄ Supabase DB/Storage). */
export const memberRepository: MemberRepository = utiliserMocks
  ? mockMemberRepository
  : new SupabaseMemberRepository();

/** Contenus publics (mock ⇄ Supabase, lecture seule). */
export const publicContentService: PublicContentService = utiliserMocks
  ? mockPublicContentService
  : new SupabasePublicContentService();

/** API candidate (mock ⇄ API REST Express via `EXPO_PUBLIC_API_BASE_URL`). */
export const candidateApi: CandidateApi = utiliserMocks ? mockCandidateApi : new HttpCandidateApi();
