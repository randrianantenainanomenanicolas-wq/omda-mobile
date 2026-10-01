/**
 * Couche Supabase réelle (étape 17) — barrel.
 *
 * Tout est inerte tant que `EXPO_PUBLIC_USE_MOCKS` n'est pas passé à `false`
 * (voir `src/services/factory.ts` et `docs/BRANCHEMENT.md`).
 */
export * from './client';
export { SupabaseAuthService } from './SupabaseAuthService';
export { SupabaseMemberRepository } from './SupabaseMemberRepository';
export { SupabasePublicContentService } from './SupabasePublicContentService';
