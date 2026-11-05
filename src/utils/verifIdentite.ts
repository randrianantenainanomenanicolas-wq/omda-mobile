/**
 * Contrôles LOCALS de la vérification d'identité par selfie
 * (`docs/REGLES_METIER_V2.md` §5, `docs/FORMULAIRES.md` §11).
 *
 * Fonctions PURES (aucun import de l'UI ni du contexte) réutilisables par
 * l'écran `verif-identite.tsx`, les mocks et `tools/verif-mocks.ts` :
 * - refus d'un selfie trop petit pour être lisible ;
 * - refus du même fichier que celui d'une autre pièce (empreinte / doublon) ;
 * - signature stable du dossier pour réinvalider le selfie si le candidat
 *   modifie ensuite un formulaire ou une pièce.
 *
 * ⚠️ AUCUNE reconnaissance faciale ici : on ne compare aucun visage. Le selfie
 * est simplement stocké ; c'est l'agent OMDA qui l'examine au back-office.
 */

/* ------------------------------------------------------- Lisibilité (taille) */

/** Dimensions (pixels) d'une image choisie ou capturée. */
export type DimensionsImage = { largeur: number; hauteur: number };

/**
 * Seuil minimal de lisibilité d'un selfie : en dessous, l'image est jugée
 * « trop petite pour être lisible » par un agent OMDA (largeur ET hauteur).
 */
export const SEUILS_LISIBILITE_SELFI = {
  largeurMin: 480,
  hauteurMin: 480,
} as const;

/** Message affiché quand le selfie est trop petit. */
export const MESSAGE_SELFI_TROP_PETIT =
  'Image trop petite pour être lisible. Rapprochez-vous ou refaites le selfie (visage et CIN nets).';

/**
 * Retourne un message d'erreur si le selfie est trop petit pour être lisible,
 * `null` sinon. Un écran sans dimensions connues (0) n'est pas bloqué ici
 * (le contrôle de taille réseau s'applique quand même plus bas).
 */
export function controleLisibiliteSelfie(dimensions: DimensionsImage): string | null {
  const { largeur, hauteur } = dimensions;
  if (largeur <= 0 || hauteur <= 0) {
    return null;
  }
  if (largeur < SEUILS_LISIBILITE_SELFI.largeurMin || hauteur < SEUILS_LISIBILITE_SELFI.hauteurMin) {
    return MESSAGE_SELFI_TROP_PETIT;
  }
  return null;
}

/* --------------------------------------------------- Empreinte / doublon */

/** Identité « physique » d'un fichier : son URI local et sa taille. */
export type DescripteurFichier = {
  uri: string;
  taille_octets: number;
};

/**
 * Empreinte d'un fichier : suffit à détecter si le candidat réutilise
 * EXACTEMENT le même fichier pour une autre pièce (selfie = CIN, etc.).
 */
export function empreinteFichier(fichier: DescripteurFichier): string {
  return `${fichier.taille_octets}:${fichier.uri.trim()}`;
}

/** Une empreinte figure-t-elle déjà parmi d'autres (doublon) ? */
export function empreinteDejaPrise(
  empreinte: string,
  empreintesExistantes: Iterable<string>,
): boolean {
  for (const autre of empreintesExistantes) {
    if (autre === empreinte) {
      return true;
    }
  }
  return false;
}

/** Message affiché quand le selfie est le même fichier qu'une autre pièce. */
export const MESSAGE_SELFI_DOUBLON =
  'Ce fichier est déjà utilisé pour une autre pièce du dossier. Merci de prendre un selfie distinct.';

/* ------------------------------------------- Signature du dossier (validité) */

/**
 * Hachage déterministe court (FNV-1a, 32 bits, hexadécimal) : sert à comparer
 * deux états du dossier sans stocker la totalité des champs.
 */
export function hachageSimple(chaine: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < chaine.length; index += 1) {
    hash ^= chaine.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, '0');
}

/**
 * Signature stable d'un ensemble d'éléments du dossier (identité, engagement,
 * catégorie, empreintes des pièces, bulletins). Le selfie est pris avec une
 * signature donnée ; si le candidat modifie ensuite un formulaire ou une pièce,
 * la recalculée diffère et le selfie doit être refait.
 */
export function signatureDossier(parties: readonly string[]): string {
  return hachageSimple(parties.join('|'));
}
