/**
 * Compression et conversion des images avant envoi (règle métier 6.2,
 * `docs/REGLES_METIER_V2.md` §6.2).
 *
 * TOUTES les images (JPEG, PNG, HEIC, WebP, GIF…) sont traitées avant d'être
 * téléversées afin de :
 * - réduire leur poids sur le réseau (téléphones modestes, connexion 3G) ;
 * - garantir une lisibilité suffisante pour les agents OMDA dans le back-office ;
 * - uniformiser le format en JPEG (accepté par le bucket `pieces` et `oeuvres`).
 *
 * PDF et MP3 ne sont JAMAIS retraités : le module les laisse passer tels quels.
 *
 * ⚠️ En mode mock (`EXPO_PUBLIC_USE_MOCKS=true`, défaut), aucune compression
 * réelle n'est effectuée : la fonction `compresserSiImage` retourne l'entrée
 * inchangée. La compression native (`expo-image-manipulator`) n'est utilisée
 * que lorsque l'application tourne sur un vrai appareil en mode réel.
 *
 * Réglages retenus (à valider sur un document photographié, scénario T.PHOTO §2.5) :
 * - Qualité JPEG : 82 % (bon compromis poids / lisibilité texte + tampons) ;
 * - Dimension max : 2048 px (largeur OU hauteur, proportionnel) ;
 * - Format cible : JPEG (compatibilité maximale avec les buckets).
 *
 * La limite de taille générale reste **20 Mo** (contrainte `CHECK` du schéma).
 * Un MP3 de 10 min en 320 kbps ≈ 24 Mo dépasse cette limite : le fichier doit
 * être compressé AVANT envoi (encodage 192 kbps recommandé, ≈ 14 Mo) ou la
 * limite étendue à 50 Mo par une migration. Décision en attente de validation.
 */

import type { TypeMime } from '../models';
import { TAILLE_MAX_FICHIER_OCTETS } from '../models';

/* --------------------------------------------------------------- Réglages */

/**
 * Qualité de compression JPEG sur l'échelle utilisateur 0-100 (82 = lisible
 * pour un agent OMDA : texte, tampons et signatures restent nets).
 */
export const QUALITE_COMPRESSION_JPEG = 82;

/**
 * Qualité normalisée 0.0-1.0 attendue par `expo-image-manipulator` (SDK 53+).
 * Dérivée de `QUALITE_COMPRESSION_JPEG` pour garder une seule source de vérité.
 */
export const COMPRESSION_JPEG_NORMALISEE = QUALITE_COMPRESSION_JPEG / 100;

/** Largeur ou hauteur maximale en pixels (proportionnel). */
export const DIMENSION_MAX_PX = 2048;

/** Format cible après compression : toujours JPEG pour les images. */
export const FORMAT_CIBLE = 'image/jpeg' as const;

/* --------------------------------------------------------- Détection nature */

/** Types MIME image qui doivent être compressés avant envoi. */
const MIME_IMAGES: readonly string[] = [
  'image/jpeg',
  'image/jpg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
  'image/gif',
  'image/tiff',
];

/** Types MIME non-images qui ne sont JAMAIS retraités. */
const MIME_SANS_TRAITEMENT: readonly string[] = [
  'application/pdf',
  'audio/mpeg',
  'audio/wav',
];

/** Un type MIME est-il une image à compresser ? */
export function estImageCompressible(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return MIME_IMAGES.includes(mime.trim().toLowerCase());
}

/** Un type MIME doit-il être laissé tel quel (PDF, MP3, WAV) ? */
export function estSansTraitement(mime: string | null | undefined): boolean {
  if (!mime) return false;
  return MIME_SANS_TRAITEMENT.includes(mime.trim().toLowerCase());
}

/* ---------------------------------------------------------- Interface type */

/** Résultat de la préparation d'un fichier (après compression éventuelle). */
export type FichierPrepare = {
  /** URI locale du fichier prêt à l'envoi (original ou version compressée). */
  fichier_uri: string;
  /** Type MIME final (jpeg après compression, inchangé sinon). */
  mime_type: TypeMime | string;
  /** Taille en octets du fichier prêt à l'envoi. */
  taille_octets: number;
  /** Nom du fichier (original ou compressé). */
  nom_fichier: string;
};

/**
 * Paramètres d'entrée pour la préparation avant envoi.
 */
export type ParametresPreparation = {
  fichier_uri: string;
  mime_type: string;
  taille_octets: number;
  nom_fichier: string;
};

/* ------------------------------------------------------------ Compression */

/**
 * Indique si le mode mock est actif (aucune compression réelle possible).
 * Injecté par le caller (écran) pour éviter un import direct de config
 * dans ce module utilitaire.
 */
export type EstimateurModeMock = () => boolean;

/**
 * Compresse une image en JPEG via `expo-image-manipulator` si le fichier est
 * une image et que le mode réel est actif.
 *
 * En mode mock ou pour un fichier non-image (PDF, MP3, WAV), retourne les
 * paramètres inchangés : `compresserSiImage` est une PASSE-Partout.
 *
 * @param params   Fichier choisi sur le téléphone (URI, MIME, taille, nom).
 * @param isMock   Estimateur du mode (true = mock = pas de compression native).
 * @returns Le fichier prêt à l'envoi (éventuellement compressé).
 */
export async function compresserSiImage(
  params: ParametresPreparation,
  isMock: EstimateurModeMock,
): Promise<FichierPrepare> {
  // PDF, MP3, WAV : aucun traitement.
  if (estSansTraitement(params.mime_type)) {
    return { ...params };
  }

  // Si ce n'est pas une image ou si le mode mock est actif : passe-partout.
  if (!estImageCompressible(params.mime_type) || isMock()) {
    return { ...params };
  }

  // --- Mode réel sur appareil : compression native via expo-image-manipulator.
  try {
    // Import dynamique pour ne pas casser le bundler web (module natif uniquement).
    const { ImageManipulator, SaveFormat } = await import('expo-image-manipulator');

    const context = ImageManipulator.manipulate(params.fichier_uri);
    context.resize({ width: DIMENSION_MAX_PX });
    const image = await context.renderAsync();
    const result = await image.saveAsync({
      compress: COMPRESSION_JPEG_NORMALISEE,
      format: SaveFormat.JPEG,
    });

    // Nom du fichier : on force l'extension .jpg après conversion.
    const sansExt = params.nom_fichier.replace(/\.[^.]+$/, '');
    const nomFinal = `${sansExt}.jpg`;

    // Récupérer la taille réelle du fichier compressé.
    let tailleReelle = params.taille_octets;
    try {
      const FileSystem = await import('expo-file-system/legacy');
      const info = await FileSystem.getInfoAsync(result.uri);
      if (info.exists && typeof info.size === 'number') {
        tailleReelle = info.size;
      }
    } catch {
      // Si l'info échoue, garder la taille originale (overestimate).
    }

    return {
      fichier_uri: result.uri,
      mime_type: FORMAT_CIBLE,
      taille_octets: tailleReelle,
      nom_fichier: nomFinal,
    };
  } catch {
    // En cas d'échec de compression (HEIC non supporté, crash natif, etc.) :
    // on passe le fichier original sans bloquer l'utilisateur.
    // L'écran affichera un avertissement discret si la taille dépasse la limite.
    return { ...params };
  }
}

/* ------------------------------------------------------------ Validation taille */

/**
 * Vérifie que la taille du fichier préparé reste dans la limite autorisée.
 * Retourne un message d'erreur explicite si dépassement, `null` sinon.
 */
export function validerTaillePreparee(taille: number): string | null {
  if (taille > TAILLE_MAX_FICHIER_OCTETS) {
    return `Le fichier dépasse la taille maximale de ${TAILLE_MAX_FICHIER_OCTETS / 1048576} Mo.`;
  }
  return null;
}
