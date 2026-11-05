/**
 * Configuration des bulletins de déclaration d'œuvre (source UNIQUE).
 *
 * L'écran `app/(adhesion)/bulletin.tsx` est un formulaire GÉNÉRIQUE piloté par
 * `CONFIG_BULLETIN_PAR_TYPE` : on branche une variante de bulletin en ajoutant
 * ses champs ici, SANS retoucher l'écran.
 *
 * ⚠️ ÉTAPE 29C : les 5 types (littéraire, dramatique, musical ACR, musical
 * collectif, audiovisuel) démarrent avec la liste de CHAMPS COMMUNS décrite
 * dans `docs/FORMULAIRES.md` §2→§7. Les variantes DÉTAILLÉES propres à chaque
 * type (rôles A/C/AR/E/SA/SR/SE, producteur / 1ère diffusion / fonctions,
 * type LIVRE/POÈME, etc.) sont à brancher dans l'**ÉTAPE 29D** (cf.
 * `docs/PROGRESS.md`) : il suffira d'enrichir `CONFIG_BULLETIN_PAR_TYPE`.
 */

import type { TypeBulletin } from './enums';

/* ------------------------------------------------------------- Données */

/** Un ayants droit déclaré dans le bulletin (rôle, identité, n° OMDA facultatif). */
export type AyantDroitDeclaration = {
  /** Rôle (parolier, compositeur, etc.). */
  role: string;
  /** Nom. */
  nom: string;
  /** Prénoms. */
  prenoms: string;
  /** Numéro OMDA (facultatif). */
  numero_omda?: string;
};

/** Édition du bulletin (contrat, validité, territoire). */
export type EditionDeclaration = {
  contrat_du?: string;
  valable_jusqu_au?: string;
  territoire?: string;
};

/** Contenu saisi d'un bulletin d'œuvre. */
export type BulletinDeclaration = {
  titre: string;
  genre: string;
  /** Durée en minutes (saisie libre, contrôlée à la complétude). */
  duree: string;
  ayants_droit: AyantDroitDeclaration[];
  edition: EditionDeclaration;
  lieu: string;
  /** Date de déclaration (`AAAA-MM-JJ`). */
  date: string;
  /** Déclaration sur l'honneur cochée. */
  declaration_honneur: boolean;
};

/** Bulletin vide (point de départ du formulaire). */
export const BULLETIN_VIDE: BulletinDeclaration = {
  titre: '',
  genre: '',
  duree: '',
  ayants_droit: [],
  edition: {},
  lieu: '',
  date: '',
  declaration_honneur: false,
};

/** Rôles proposés en suggestion (libre en 29C, spécialisés en 29D). */
export const ROLES_BULLETIN_SUGGERES: readonly string[] = [
  'Parolier',
  'Compositeur',
  'Arrangeur',
  'Editeur',
  'Auteur',
];

/* ------------------------------------------------------- Configuration */

/** Type de champ rendu par l'écran générique. */
export type TypeChampBulletin =
  | 'texte'
  | 'nombre'
  | 'date'
  | 'liste_ayants_droit'
  | 'edition'
  | 'case';

/** Description d'un champ d'un bulletin. */
export type ChampBulletin = {
  /** Clé stable dans `BulletinDeclaration`. */
  cle: string;
  libelle: string;
  type: TypeChampBulletin;
  obligatoire: boolean;
  aide?: string;
};

/** Champs communs à TOUS les bulletins (base 29C). */
const CHAMPS_COMMUNS: readonly ChampBulletin[] = [
  { cle: 'titre', libelle: 'Titre de l’œuvre', type: 'texte', obligatoire: true },
  { cle: 'genre', libelle: 'Genre', type: 'texte', obligatoire: true },
  { cle: 'duree', libelle: 'Durée (minutes)', type: 'nombre', obligatoire: true },
  {
    cle: 'ayants_droit',
    libelle: 'Ayants droit',
    type: 'liste_ayants_droit',
    obligatoire: true,
    aide: 'Rôle, nom, prénoms ; numéro OMDA facultatif.',
  },
  { cle: 'edition', libelle: 'Édition', type: 'edition', obligatoire: false },
  { cle: 'lieu', libelle: 'Lieu', type: 'texte', obligatoire: true },
  { cle: 'date', libelle: 'Date', type: 'date', obligatoire: true },
  {
    cle: 'declaration_honneur',
    libelle: 'Déclaration sur l’honneur',
    type: 'case',
    obligatoire: true,
  },
];

/**
 * Configuration par type de bulletin. En 29C, tous les types partagent la liste
 * commune ; 29D spécialisé chaque variante en modifiant UNIQUEMENT cette table.
 */
export const CONFIG_BULLETIN_PAR_TYPE: Record<TypeBulletin, readonly ChampBulletin[]> = {
  LITTERAIRE: CHAMPS_COMMUNS,
  DRAMATIQUE: CHAMPS_COMMUNS,
  MUSIQUE_ACR: CHAMPS_COMMUNS,
  MUSIQUE_COLLECTIVE: CHAMPS_COMMUNS,
  AUDIOVISUEL: CHAMPS_COMMUNS,
  FIGURATIF_PROVISOIRE: CHAMPS_COMMUNS,
};

/* ----------------------------------------------------------- Complétude */

function unTexte(valeur: string | undefined): boolean {
  return typeof valeur === 'string' && valeur.trim().length > 0;
}

/** Un ayants droit est valide s'il a rôle + nom + prénoms. */
export function ayantDroitEstValide(ayant: AyantDroitDeclaration): boolean {
  return unTexte(ayant.role) && unTexte(ayant.nom) && unTexte(ayant.prenoms);
}

/**
 * Un bulletin est « complété » lorsque tous ses champs obligatoires de base
 * (29C) sont renseignés : titre, genre, durée, au moins un ayants droit,
 * lieu, date et déclaration sur l'honneur cochée.
 *
 * NOTE 29D : cette règle s'enrichira des contraintes propres à chaque type
 * (édition obligatoire, rôles spécifiques, etc.).
 */
export function bulletinEstComplet(bulletin: BulletinDeclaration): boolean {
  return (
    unTexte(bulletin.titre) &&
    unTexte(bulletin.genre) &&
    unTexte(bulletin.duree) &&
    Number(bulletin.duree) > 0 &&
    bulletin.ayants_droit.some(ayantDroitEstValide) &&
    unTexte(bulletin.lieu) &&
    unTexte(bulletin.date) &&
    bulletin.declaration_honneur === true
  );
}

/** Liste des libellés manquants (pour l'affichage « ce qui reste à faire »). */
export function manquantsBulletin(bulletin: BulletinDeclaration): string[] {
  const manquants: string[] = [];
  const config = CHAMPS_COMMUNS;
  for (const champ of config) {
    if (!champ.obligatoire) {
      continue;
    }
    let rempli = false;
    switch (champ.cle) {
      case 'titre':
        rempli = unTexte(bulletin.titre);
        break;
      case 'genre':
        rempli = unTexte(bulletin.genre);
        break;
      case 'duree':
        rempli = unTexte(bulletin.duree) && Number(bulletin.duree) > 0;
        break;
      case 'ayants_droit':
        rempli = bulletin.ayants_droit.some(ayantDroitEstValide);
        break;
      case 'lieu':
        rempli = unTexte(bulletin.lieu);
        break;
      case 'date':
        rempli = unTexte(bulletin.date);
        break;
      case 'declaration_honneur':
        rempli = bulletin.declaration_honneur === true;
        break;
      default:
        rempli = true;
    }
    if (!rempli) {
      manquants.push(champ.libelle);
    }
  }
  return manquants;
}
