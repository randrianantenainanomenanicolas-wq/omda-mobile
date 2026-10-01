/**
 * Refus « non branché » des implémentations réelles (Supabase / API Express).
 *
 * L'étape 17 livre ces implémentations en SQUELETTE : elles respectent les
 * contrats et compilent, mais aucune donnée réelle n'est encore lue ou écrite.
 * Tant que `EXPO_PUBLIC_USE_MOCKS` n'est pas passé à `false`, ce code n'est
 * JAMAIS exécuté : le mode mock reste le comportement par défaut.
 */
import { erreurServeur, type ResultErr } from './contracts';

/** Message affiché tant qu'un service réel n'est pas branché. */
export const MESSAGE_SERVICE_NON_BRANCHE =
  'Service réel pas encore branché. Utilisez le mode démonstration (EXPO_PUBLIC_USE_MOCKS=true) ou branchez l’API (voir docs/BRANCHEMENT.md).';

/** Refus serveur standard d'une implémentation non branchée. */
export function erreurNonBranche(): ResultErr {
  return erreurServeur({ message: MESSAGE_SERVICE_NON_BRANCHE });
}
