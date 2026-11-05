/**
 * Source UNIQUE de l'ordre d'importation du parcours candidat
 * (`docs/REGLES_METIER_V2.md` §11, `docs/FORMULAIRES.md` §10).
 *
 * Chaque pièce du dossier est décrite une seule fois ici : libellé, aide,
 * icône, groupement (bloc « par œuvre » / pièce d'identité / selfie), bucket
 * de stockage et nature « formulaire ». L'écran Documents, l'écran
 * Vérification d'identité, les mocks et `tools/verif-mocks.ts` consomment tous
 * cette configuration : AUCUN libellé, aucune icône, aucun bucket n'est codé en
 * dur ailleurs.
 *
 * L'ordre provient de l'ENUM `TYPES_PIECE_CANDIDAT` (déjà dans l'ordre imposé) ;
 * on n'ajoute jamais de pièce en tapant une nouvelle liste ailleurs.
 */

import type { BucketStockage } from './common';
import type { TypePieceCandidat } from './enums';
import { TYPES_PIECE_CANDIDAT } from './enums';

/** Où se affiche la pièce dans l'écran d'importation. */
export type GroupementImportation = 'oeuvre' | 'identite' | 'selfie';

/** Description d'une pièce du parcours candidat. */
export type PieceImportation = {
  /** Type de pièce (ENUM `TYPES_PIECE`, porté par `piece_jointe.type`). */
  type: TypePieceCandidat;
  /** Position dans l'ordre imposé (1 = première à importer). */
  position: number;
  /** Libellé affiché à l'écran. */
  libelle: string;
  /** Aide contextuelle affichée sous le libellé. */
  aide: string;
  /**
   * Nom d'icône FontAwesome 6 (stocké en `string` pour que `models` ne dépende
   * pas de l'UI ; l'écran le convertit en `NomIcone`).
   */
  icone: string;
  /** Bloc visuel auquel la pièce appartient. */
  groupement: GroupementImportation;
  /** Bucket Supabase Storage ; `null` pour un formulaire natif (bulletin). */
  bucket: BucketStockage | null;
  /** `true` si rempli dans l'app (aucun fichier à importer). */
  estFormulaire: boolean;
};

/** Configuration de chaque pièce, indexée par son type. */
const CONFIG_PAR_TYPE: Record<TypePieceCandidat, Omit<PieceImportation, 'type' | 'position'>> = {
  OEUVRE: {
    libelle: "Fichier de l'œuvre",
    aide: 'MP3/WAV (musique) ou PDF (écrit, film). 20 Mo maximum.',
    icone: 'file-audio',
    groupement: 'oeuvre',
    bucket: 'oeuvres',
    estFormulaire: false,
  },
  ATTESTATION_DIFFUSION: {
    libelle: 'Attestation de diffusion',
    aide: 'Document prouvant la diffusion : PDF, JPEG ou PNG.',
    icone: 'stamp',
    groupement: 'oeuvre',
    bucket: 'oeuvres',
    estFormulaire: false,
  },
  BULLETIN: {
    libelle: 'Bulletin de déclaration',
    aide: 'Formulaire rempli directement dans l’application, pour chaque œuvre.',
    icone: 'file-pen',
    groupement: 'oeuvre',
    bucket: null,
    estFormulaire: true,
  },
  PHOTO: {
    libelle: "Photo de l'auteur",
    aide: 'Photo claire et récente, visage dégagé.',
    icone: 'camera',
    groupement: 'identite',
    bucket: 'pieces',
    estFormulaire: false,
  },
  CIN: {
    libelle: 'Photocopie de la CIN',
    aide: 'Copie légalisée de la carte d’identité nationale.',
    icone: 'id-card',
    groupement: 'identite',
    bucket: 'pieces',
    estFormulaire: false,
  },
  ACTE_NAISSANCE: {
    libelle: 'Acte de naissance',
    aide: 'Copie lisible de l’acte de naissance.',
    icone: 'file-lines',
    groupement: 'identite',
    bucket: 'pieces',
    estFormulaire: false,
  },
  CERTIFICAT_RESIDENCE: {
    libelle: 'Certificat de résidence',
    aide: 'Copie lisible du certificat de résidence.',
    icone: 'house-circle-check',
    groupement: 'identite',
    bucket: 'pieces',
    estFormulaire: false,
  },
  SELFIE_CIN: {
    libelle: 'Selfie tenant la CIN',
    aide: 'Pris en toute dernière étape (vérification d’identité).',
    icone: 'user-shield',
    groupement: 'selfie',
    bucket: 'pieces',
    estFormulaire: false,
  },
};

/**
 * Liste ordonnée de TOUTES les pièces du parcours candidat.
 * Ordre = ordre de `TYPES_PIECE_CANDIDAT` (déjà imposé par la règle métier 11).
 */
export const ORDRE_IMPORTATION: readonly PieceImportation[] = TYPES_PIECE_CANDIDAT.map(
  (type, index) => ({ type, position: index + 1, ...CONFIG_PAR_TYPE[type] }),
);

/** Pièces regroupées dans le bloc « par œuvre » (fichier, attestation, bulletin). */
export const PIECES_OEUVRE: readonly PieceImportation[] = ORDRE_IMPORTATION.filter(
  (piece) => piece.groupement === 'oeuvre',
);

/** Pièces d'identité importées après le bloc œuvres (photo, CIN, acte, certificat). */
export const PIECES_IDENTITE: readonly PieceImportation[] = ORDRE_IMPORTATION.filter(
  (piece) => piece.groupement === 'identite',
);

/** Selfie de vérification d'identité (étape distincte, toute dernière). */
export const PIECE_SELFIE: PieceImportation =
  ORDRE_IMPORTATION.find((piece) => piece.groupement === 'selfie') ?? ORDRE_IMPORTATION[ORDRE_IMPORTATION.length - 1];

/** Retrouve la configuration d'une pièce depuis son type. */
export function pieceImportationDepuisType(type: TypePieceCandidat): PieceImportation {
  return ORDRE_IMPORTATION.find((piece) => piece.type === type) ?? PIECE_SELFIE;
}
