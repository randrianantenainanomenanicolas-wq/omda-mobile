/**
 * Renommage automatique des fichiers selon leur nature (règle métier 6.1,
 * `docs/REGLES_METIER_V2.md` §6.1).
 *
 * Produit DEUX valeurs pour chaque fichier importé :
 * - `nom_lisible` : conservé en base, affiché à l'agent dans le back-office
 *   (accents et espaces autorisés) ;
 * - `cle_storage` : chemin SÛR dans le bucket Supabase Storage — sans accents,
 *   sans espaces, sans caractères spéciaux, suffixe unique (8 caractères
 *   alphanumériques) pour éviter tout conflit.
 *
 * Exemples :
 * - CIN :             `nom_lisible` = « CIN RAKOTO Jean », `cle_storage` = « CIN_RAKOTO-Jean_a3f1b20c.pdf »
 * - Œuvre musicale :  `nom_lisible` = « La varangue – Jean », `cle_storage` = « La-varangue_Jean_9c8d1e4f.mp3 »
 * - Attestation :     `nom_lisible` = « Attestation de diffusion – La varangue », `cle_storage` = « attestation-diffusion_La-varangue_Jean_4f7a2b1c.pdf »
 */

import type { TypePiece } from '../models';

/* -------------------------------------------------------------- Types */

/**
 * Nature d'un fichier dans le parcours de l'app : les types de pièces déjà
 * déclarés dans `TYPES_PIECE`, PLUS deux natures spécifiques au renommage
 * (oeuvre et attestation qui ne sont pas des types de `piece_jointe`).
 */
export type NatureFichier =
  | 'CIN'
  | 'SELFIE_CIN'
  | 'PHOTO'
  | 'ACTE_NAISSANCE'
  | 'CERTIFICAT_RESIDENCE'
  | 'AUTORISATION_PARENTALE'
  | 'OEUVRE'
  | 'ATTESTATION_DIFFUSION'
  | 'BULLETIN'
  | 'AUTRE';

/** Contexte nécessaire pour construire les noms. */
export type ContexteRenommage = {
  /** Nature du fichier. */
  nature: NatureFichier;
  /** Nom du candidat (pièces) ou de l'auteur (œuvres/attestations). */
  nom: string;
  /** Prénom du candidat ou auteur. */
  prenom: string;
  /** Pseudonyme de l'auteur (œuvres et attestations, règle 6.1). */
  pseudonyme?: string;
  /** Titre de l'œuvre (œuvres et attestations). */
  titre?: string;
  /** Extension du fichier (ex. 'pdf', 'jpg', 'mp3'). */
  extension: string;
};

/** Résultat du renommage : les deux valeurs à conserver. */
export type ResultatRenommage = {
  /** Nom lisible stocké en base et affiché aux agents. */
  nom_lisible: string;
  /** Clé de stockage sécurisée (sans accents, espaces ni spéciaux, suffixe unique). */
  cle_storage: string;
};

/* ----------------------------------------------------- Fonctions internes */

/**
 * Translittère les caractères accentués en leurs équivalents ASCII.
 * Les autres caractères non-ASCII (ponctuation Unicode, guillemets, etc.)
 * sont simplement supprimés.
 */
function translitter(chaine: string): string {
  return chaine
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '') // supprime les diacritiques
    .replace(/[^a-zA-Z0-9\s\-_]/g, '') // garde alphanum, espace, tiret, underscore
    .trim();
}

/**
 * Produit une chaîne sans accents, sans espaces, en minuscules/MAJUSCULES
 * conservées, avec des tirets à la place des espaces.
 */
function slugifier(chaine: string): string {
  return translitter(chaine).replace(/\s+/g, '-').replace(/-+/g, '-');
}

/**
 * Suffixe unique de 8 caractères hexadécimaux (basé sur Date.now + random)
 * pour éviter tout conflit de nom dans le bucket.
 */
function suffixeUnique(): string {
  const temps = Date.now().toString(36);
  const alea = Math.random().toString(36).slice(2, 6);
  return `${temps}${alea}`.slice(0, 8);
}

/* -------------------------------------------------------- Libellés lisible */

const LIBELLE_NATURE: Record<NatureFichier, string> = {
  CIN: 'CIN',
  SELFIE_CIN: 'Selfie avec CIN',
  PHOTO: 'Photo de l\'auteur',
  ACTE_NAISSANCE: 'Acte de naissance',
  CERTIFICAT_RESIDENCE: 'Certificat de résidence',
  AUTORISATION_PARENTALE: 'Autorisation parentale',
  OEUVRE: 'Œuvre',
  ATTESTATION_DIFFUSION: 'Attestation de diffusion',
  BULLETIN: 'Bulletin de déclaration',
  AUTRE: 'Document',
};

/* ------------------------------------------------------------ Fonction principale */

/**
 * Génère le nom lisible et la clé de stockage sécurisée pour un fichier
 * importé dans le parcours adhesion ou l'espace membre.
 *
 * Règle 6.1 (`docs/REGLES_METIER_V2.md`) :
 * - Pièces justificatives : nature + nom + prénom ;
 * - Œuvres : titre + pseudonyme de l'auteur ;
 * - Attestation : « attestation de diffusion » + œuvre (titre + pseudonyme).
 */
export function renommerFichier(ctx: ContexteRenommage): ResultatRenommage {
  const { nature, nom, prenom, pseudonyme, titre, extension } = ctx;

  let nomLisible: string;
  let baseSlug: string;

  switch (nature) {
    case 'OEUVRE': {
      const t = titre ?? 'sans-titre';
      const p = pseudonyme || `${prenom} ${nom}`;
      nomLisible = `${t} – ${p}`;
      baseSlug = `${slugifier(t)}_${slugifier(p)}`;
      break;
    }
    case 'ATTESTATION_DIFFUSION': {
      const t = titre ?? 'sans-titre';
      const p = pseudonyme || `${prenom} ${nom}`;
      nomLisible = `Attestation de diffusion – ${t}`;
      baseSlug = `attestation-diffusion_${slugifier(t)}_${slugifier(p)}`;
      break;
    }
    default: {
      // Pièces d'identité et autres documents : nature + identité du candidat.
      const identifiant = `${nom} ${prenom}`.trim();
      nomLisible = `${LIBELLE_NATURE[nature]} ${identifiant}`;
      baseSlug = `${slugifier(LIBELLE_NATURE[nature])}_${slugifier(identifiant)}`;
      break;
    }
  }

  const suffixe = suffixeUnique();
  const ext = extension.replace(/^\./, '').toLowerCase();
  const cleStorage = `${baseSlug}_${suffixe}.${ext}`;

  return { nom_lisible: nomLisible, cle_storage: cleStorage };
}

/* ------------------------------------------- Mapping TypePiece → NatureFichier */

/** Convertit un `TypePiece` existant en `NatureFichier` pour le renommage. */
export function natureDepuisPiece(type: TypePiece): NatureFichier {
  switch (type) {
    case 'CIN':
      return 'CIN';
    case 'SELFIE_CIN':
      return 'SELFIE_CIN';
    case 'PHOTO':
      return 'PHOTO';
    case 'ACTE_NAISSANCE':
      return 'ACTE_NAISSANCE';
    case 'CERTIFICAT_RESIDENCE':
      return 'CERTIFICAT_RESIDENCE';
    case 'AUTORISATION_PARENTALE':
      return 'AUTORISATION_PARENTALE';
    case 'OEUVRE':
      return 'OEUVRE';
    case 'ATTESTATION_DIFFUSION':
      return 'ATTESTATION_DIFFUSION';
    case 'BULLETIN':
      return 'BULLETIN';
    case 'AUTRE':
    default:
      return 'AUTRE';
  }
}
