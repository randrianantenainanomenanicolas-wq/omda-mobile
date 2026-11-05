/**
 * Envoi robuste sur réseau instable (règle « traitement des fichiers », ÉTAPE 29B).
 *
 * Enveloppe un appel de téléversement (`televerserFichier`) pour lui ajouter la
 * REPRISE AUTOMATIQUE après un échec transitoire, sans toucher au contrat de la
 * couche data :
 * - progression : la fonction enveloppée appelle déjà `onProgression` ; à chaque
 *   nouvelle tentative la progression repart à 0 (l'appelant le voit via
 *   `onReprise`) ;
 * - annulation : si le `signal` est aborté, AUCUNE nouvelle tentative n'est
 *   lancée et l'erreur d'annulation remontée par le service est conservée ;
 * - reprise : seule une erreur TRANSITOIRE (`reseau`, ou `serveur` 5xx / 408 /
 *   429) déclenche une nouvelle tentative. Un refus MÉTIER (format, taille,
 *   conflit, non-authentifié) n'est JAMAIS repris : l'utilisateur doit corriger.
 *
 * La stratégie est volontairement simple et testable : backoff exponentiel
 * (décalage doublé à chaque tentative), nombre de tentatives borné, aucune
 * dépendance à un SDK. Les mocks comme le Storage réel utilisent ce module pour
 * la reprise, et `verif-mocks.ts` en vérifie le comportement.
 */

import type { Result, ResultErr } from '../services/contracts';

/* --------------------------------------------------------------- Réglages */

/** Nombre total de tentatives par défaut (1 envoi initial + 2 reprises). */
export const TENTATIVES_PAR_DEFAUT = 3;

/** Délai de base avant la première reprise (ms), doublé à chaque tentative. */
export const DELAI_REPRISE_BASE_MS = 600;

/** Plafond du décalage entre deux reprises (ms), pour éviter une attente longue. */
export const DELAI_REPRISE_MAX_MS = 8000;

/* -------------------------------------------------------- Reprise ou non */

/**
 * Une erreur est-elle TRANSITOIRE (donc digne d'une nouvelle tentative) ?
 *
 * - `reseau` : toujours (appareil hors ligne, timeout, coupure pendant l'envoi) ;
 * - `serveur` : uniquement 5xx, 408 (timeout) et 429 (trop de demandes) ;
 * - `metier` : jamais (il faut corriger le fichier, pas relancer).
 */
export function estErreurReprebable(erreur: ResultErr['erreur']): boolean {
  if (erreur.type === 'reseau') {
    return true;
  }
  if (erreur.type === 'serveur') {
    const statut = erreur.statut_http;
    if (statut === undefined) {
      // Erreur serveur sans statut (ex. réponse inexploitable) : transitoire.
      return true;
    }
    return statut === 408 || statut === 429 || statut >= 500;
  }
  return false;
}

/** Le résultat est-il une annulation (`signal` aborté) ? Arrête la reprise. */
function estAnnule<T>(resultat: Result<T>): boolean {
  return (
    !resultat.ok &&
    resultat.erreur.type === 'metier' &&
    resultat.erreur.code === 'TELEVERSEMENT_ANNULE'
  );
}

/* ------------------------------------------------------------- Utilitaires */

/** Attente simple (injectable pour les tests via `attendre`). */
export function attendreReprise(ms: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, ms));
}

/** Décalage (ms) avant la `tentative`-ième reprise (backoff exponentiel borné). */
export function delaiReprise(tentative: number, delaiBase: number): number {
  const exponentielle = delaiBase * Math.pow(2, Math.max(0, tentative - 1));
  return Math.min(exponentielle, DELAI_REPRISE_MAX_MS);
}

/* --------------------------------------------------------------- Enveloppe */

/** Options de reprise (fusionnées avec celles du contrat de téléversement). */
export type OptionsEnvoiRobuste = {
  /** Nombre total de tentatives (défaut `TENTATIVES_PAR_DEFAUT`). */
  maxTentatives?: number;
  /** Délai de base (ms) du backoff (défaut `DELAI_REPRISE_BASE_MS`). */
  delaiRepriseMs?: number;
  /** Signal d'annulation partagé : coupe immédiatement la boucle de reprise. */
  signal?: AbortSignal;
  /** Nouvelle tentative imminente (permet à l'UI de réafficher « envoi en cours »). */
  onReprise?: (tentative: number) => void;
  /** Injection du délai pour les tests (défaut : vraie attente). */
  attendre?: (ms: number) => Promise<void>;
};

/**
 * Exécute `envoyer()` en rejouant jusqu'à `maxTentatives` fois sur erreur
 * transitoire. Retourne le premier succès, la dernière erreur transitoire, ou
 * toute erreur non repreérable / annulation immédiatement.
 *
 * @param envoyer  Fonction d'envoi (typiquement `() => api.televerserFichier(...)`).
 * @param options  Réglages de reprise.
 */
export async function avecReprise<T>(
  envoyer: () => Promise<Result<T>>,
  options: OptionsEnvoiRobuste = {},
): Promise<Result<T>> {
  const maxTentatives = Math.max(1, options.maxTentatives ?? TENTATIVES_PAR_DEFAUT);
  const delaiBase = options.delaiRepriseMs ?? DELAI_REPRISE_BASE_MS;
  const attendre = options.attendre ?? attendreReprise;
  const signal = options.signal;

  let derniereErreur: ResultErr | null = null;

  for (let tentative = 1; tentative <= maxTentatives; tentative += 1) {
    if (signal?.aborted) {
      // Annulation avant toute nouvelle tentative : on stoppe proprement.
      break;
    }

    if (tentative > 1) {
      options.onReprise?.(tentative);
      await attendre(delaiReprise(tentative - 1, delaiBase));
    }

    const resultat = await envoyer();

    if (resultat.ok) {
      return resultat;
    }

    // Annulation ou refus définitif : on remonte sans réessayer.
    if (estAnnule(resultat) || !estErreurReprebable(resultat.erreur)) {
      return resultat;
    }

    derniereErreur = resultat;

    if (signal?.aborted) {
      break;
    }
  }

  // Toutes les tentatives ont échoué sur du transitoire : renvoie la dernière.
  return derniereErreur ?? envoyer();
}
