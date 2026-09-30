/**
 * Réglages du MODE DEBUG des mocks (aucun effet hors mocks).
 *
 * Ils pilotent uniquement la simulation utilisée par `MockCandidateApi`,
 * `MockPublicContentService`, `MockAuthService` et `MockMemberRepository` :
 * délais réseau et pannes déclenchables à la demande (pour vérifier les écrans
 * Loading / Erreur + « Réessayer »).
 *
 * ⚠️ Rappels NON configurables (règles métier) :
 * - `REUSSI` n'est simulé que par la « confirmation serveur » (machine à états
 *   du paiement, côté serveur) : jamais par une action locale de l'app.
 */

export type OptionsMock = {
  /** Délai réseau simulé : minimum (ms). */
  delai_min_ms: number;
  /** Délai réseau simulé : maximum (ms). */
  delai_max_ms: number;
  /** Force une panne réseau (aucune réponse exploitable) sur chaque appel. */
  erreur_reseau_forcee: boolean;
  /** Force une panne serveur (503) sur chaque appel. */
  erreur_serveur_forcee: boolean;
  /** Probabilité aléatoire (0 → 1) d'erreur réseau, en plus du forçage. */
  probabilite_erreur_reseau: number;
  /** Probabilité aléatoire (0 → 1) d'erreur serveur, en plus du forçage. */
  probabilite_erreur_serveur: number;
  /** Nombre d'interrogations avant que Mobile Money ne renvoie son statut final. */
  polls_avant_statut_final: number;
};

export const OPTIONS_MOCK_PAR_DEFAUT: OptionsMock = {
  delai_min_ms: 250,
  delai_max_ms: 900,
  erreur_reseau_forcee: false,
  erreur_serveur_forcee: false,
  probabilite_erreur_reseau: 0,
  probabilite_erreur_serveur: 0,
  polls_avant_statut_final: 2,
};

/** Réglages courants du mode debug (objet mutable, volontairement exposé). */
export const optionsMock: OptionsMock = { ...OPTIONS_MOCK_PAR_DEFAUT };

/** Rétablit tous les réglages par défaut (aucune panne, délais courts). */
export function reinitialiserOptionsMock(): void {
  Object.assign(optionsMock, OPTIONS_MOCK_PAR_DEFAUT);
}

/** Ajuste les délais réseau simulés (mode debug). */
export function definirDelaisMock(delai_min_ms: number, delai_max_ms = delai_min_ms): void {
  optionsMock.delai_min_ms = Math.max(0, delai_min_ms);
  optionsMock.delai_max_ms = Math.max(optionsMock.delai_min_ms, delai_max_ms);
}

/** Active/force une erreur réseau (écran « Erreur + Réessayer »). */
export function forcerErreurReseau(actif: boolean): void {
  optionsMock.erreur_reseau_forcee = actif;
}

/** Active/force une erreur serveur 503 (écran « Erreur + Réessayer »). */
export function forcerErreurServeur(actif: boolean): void {
  optionsMock.erreur_serveur_forcee = actif;
}

/** Fait échouer aléatoirement une part des appels (réseau instable). */
export function definirProbabilitesErreur(probabilites: { reseau?: number; serveur?: number }): void {
  if (probabilites.reseau !== undefined) {
    optionsMock.probabilite_erreur_reseau = Math.min(1, Math.max(0, probabilites.reseau));
  }
  if (probabilites.serveur !== undefined) {
    optionsMock.probabilite_erreur_serveur = Math.min(1, Math.max(0, probabilites.serveur));
  }
}
