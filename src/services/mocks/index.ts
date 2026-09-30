/**
 * Mocks de la couche data — utilisés quand `EXPO_PUBLIC_USE_MOCKS=true`.
 *
 * Ils implémentent EXACTEMENT les mêmes contrats que les futures implémentations
 * réelles (`HttpCandidateApi`, Supabase), donc les écrans n'auront rien à changer
 * lors du branchement :
 * - `MockPublicContentService` : documentation, tarifs, catégories,
 *   opérateurs (listes dynamiques, éléments désactivés absents) ;
 * - `MockCandidateApi` : parcours visiteur/candidat, suivi, paiement Mobile
 *   Money MVola (machine à états + numéros de test) ;
 * - `MockAuthService` : connexion, session, mot de passe oublié non révélateur,
 *   changement obligatoire du mot de passe ;
 * - `MockMemberRepository` : profil, tableau de bord, œuvres, cotisations,
 *   paiements, notifications.
 *
 * Mode debug (délais, pannes) : `./configMock`.
 * Données et scénarios de test : `docs/DONNEES_TEST.md`.
 */

import { MockAuthService } from './MockAuthService';
import { MockCandidateApi } from './MockCandidateApi';
import { MockMemberRepository } from './MockMemberRepository';
import { MockPublicContentService } from './MockPublicContentService';

export * from './configMock';
export * from './donneesTestMock';
export * from './etatMock';
export { MockAuthService } from './MockAuthService';
export { MockCandidateApi } from './MockCandidateApi';
export { MockMemberRepository } from './MockMemberRepository';
export { MockPublicContentService } from './MockPublicContentService';

/** Contenus publics simulés. */
export const mockPublicContentService = new MockPublicContentService();

/** API candidate simulée (parcours adhésion + suivi + paiement). */
export const mockCandidateApi = new MockCandidateApi();

/** Authentification membre simulée. */
export const mockAuthService = new MockAuthService();

/** Accès aux données du membre connecté simulé. */
export const mockMemberRepository = new MockMemberRepository();
