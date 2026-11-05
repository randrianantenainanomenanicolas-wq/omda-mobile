/**
 * Validations métier des fichiers par catégorie d'œuvre
 * (`docs/REGLES_METIER_V2.md` §8, « Documents supplémentaires obligatoires
 * selon la catégorie »).
 *
 * Ces règles sont appliquées par l'ÉCRAN (validation avant envoi) et par le
 * SERVICE (mock et Supabase, revalidation serveur). Le module centralise les
 * codes d'erreur, les messages et les fonctions de contrôle pour éviter toute
 * duplication dans les écrans ou les mocks.
 *
 * Règle 8.1 — Musique : le fichier audio MP3 ET le PDF de paroles sont
 * OBLIGATOIRES pour soumettre la déclaration.
 *
 * Règle 8.2 — Audiovisuel (film) : un PDF contenant le résumé du film est
 * OBLIGATOIRE. L'exigence ne s'applique qu'aux œuvres audiovisuelles de type
 * « film » (cinématographique), pas aux autres supports audiovisuels.
 */

import type { TypeBulletin } from '../models';

/* -------------------------------------------------------------- Codes erreur */

/** Codes métier spécifiques à la validation des documents par catégorie. */
export const CODES_VALIDATION_CATEGORIE = {
  MUSIQUE_MP3_OBLIGATOIRE: 'MUSIQUE_MP3_OBLIGATOIRE',
  MUSIQUE_PAROLES_OBLIGATOIRE: 'MUSIQUE_PAROLES_OBLIGATOIRE',
  AUDIOVISUEL_RESUME_OBLIGATOIRE: 'AUDIOVISUEL_RESUME_OBLIGATOIRE',
} as const;

/* ------------------------------------------------------------ Messages */

export const MESSAGE_MUSIQUE_MP3 =
  'Une œuvre musicale doit inclure un fichier audio au format MP3.';

export const MESSAGE_MUSIQUE_PAROLES =
  'Une œuvre musicale doit inclure un PDF contenant les paroles.';

export const MESSAGE_AUDIOVISUEL_RESUME =
  'Un film doit être accompagné d\'un PDF contenant le résumé.';

/* ------------------------------------------------------- Types utilitaires */

/** Fichier joint à une œuvre, tel que reçu par l'écran ou le service. */
export type FichierOeuvreJoint = {
  mime_type: string;
  nom_fichier: string;
  taille_octets: number;
};

/**
 * Description des fichiers joints lors de la soumission d'une œuvre.
 * L'écran (documents-oeuvres, depot-oeuvre) passe cette structure au
 * validateur AVANT tout envoi.
 */
export type ContexteValidationOeuvre = {
  /** Type de bulletin de la catégorie choisie (détermine la règle). */
  type_bulletin: TypeBulletin;
  /** L'œuvre est-elle un film (audiovisuel) ? Si false, pas de règle 8.2. */
  est_film?: boolean;
  /** Fichier principal de l'œuvre. */
  fichier: FichierOeuvreJoint;
  /** Fichier des paroles ou résumé (second document obligatoire selon catégorie). */
  document_annexe?: FichierOeuvreJoint | null;
};

/** Résultat d'une validation : liste de messages d'erreur (vide = OK). */
export type ResultatValidationCategorielle = {
  valide: boolean;
  erreurs: string[];
};

/* ------------------------------------------------------- Fonction principale */

function estMp3(mime: string, nom: string): boolean {
  return mime === 'audio/mpeg' || mime === 'audio/mp3' || nom.toLowerCase().endsWith('.mp3');
}

function estPdf(mime: string, nom: string): boolean {
  return mime === 'application/pdf' || nom.toLowerCase().endsWith('.pdf');
}

/**
 * Valide les fichiers joints en fonction du type de bulletin (catégorie).
 *
 * Règle 8.1 — Musique (MUSIQUE_ACR ou MUSIQUE_COLLECTIVE) :
 *   - fichier principal : MP3 obligatoire ;
 *   - document annexe : PDF de paroles obligatoire.
 *
 * Règle 8.2 — Audiovisuel + `est_film = true` :
 *   - document annexe : PDF de résumé obligatoire.
 *
 * Autres catégories (Littéraire, Dramatique, Figuratif) : aucune règle
 * supplémentaire — la validation générique (type, taille) suffit.
 */
export function validerDocumentsParCategorie(
  ctx: ContexteValidationOeuvre,
): ResultatValidationCategorielle {
  const erreurs: string[] = [];

  switch (ctx.type_bulletin) {
    case 'MUSIQUE_ACR':
    case 'MUSIQUE_COLLECTIVE': {
      if (!estMp3(ctx.fichier.mime_type, ctx.fichier.nom_fichier)) {
        erreurs.push(MESSAGE_MUSIQUE_MP3);
      }
      if (
        !ctx.document_annexe ||
        !estPdf(ctx.document_annexe.mime_type, ctx.document_annexe.nom_fichier)
      ) {
        erreurs.push(MESSAGE_MUSIQUE_PAROLES);
      }
      break;
    }
    case 'AUDIOVISUEL': {
      if (ctx.est_film) {
        if (
          !ctx.document_annexe ||
          !estPdf(ctx.document_annexe.mime_type, ctx.document_annexe.nom_fichier)
        ) {
          erreurs.push(MESSAGE_AUDIOVISUEL_RESUME);
        }
      }
      break;
    }
    default:
      // Littéraire, Dramatique, Figuratif : aucune règle catégorielle supplémentaire.
      break;
  }

  return { valide: erreurs.length === 0, erreurs };
}
