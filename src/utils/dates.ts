/**
 * Aides pures pour les champs de date et d'année.
 *
 * ⚠️ Madagascar est en UTC+3 : toute conversion passe par les composants
 * LOCAUX (`getFullYear`, `getMonth`, `getDate`). `toISOString()` est formellement
 * interdit ici — il décalerai le jour (une naissance saisie `1996-04-12`
 * locale remonterait à `1996-04-11` en UTC vers minuit).
 *
 * Aucun formatage `Intl` n'est utilisé (cohérent avec les copies locales
 * `formaterDateCourte` / `formaterDateHeure` déjà en place dans les écrans,
 * hors périmètre de ce module).
 */

/** Gabarit strict d'une date stockée : `AAAA-MM-JJ` avec mois et jour sur 2 chiffres. */
const patronAAAA_MM_JJ = /^(\d{4})-(\d{2})-(\d{2})$/;

/** Une année est-elle bissextile (règle grégorienne) ? */
export function estAnneeBissextile(annee: number): boolean {
  return (annee % 4 === 0 && annee % 100 !== 0) || annee % 400 === 0;
}

/** Nombre de jours d'un mois donné (`mois` = 1 à 12), en tenant compte des années bissextiles. */
export function joursDansLeMois(annee: number, mois: number): number {
  if (!Number.isInteger(mois) || mois < 1 || mois > 12) {
    return 0;
  }
  switch (mois) {
    case 2:
      return estAnneeBissextile(annee) ? 29 : 28;
    case 4:
    case 6:
    case 9:
    case 11:
      return 30;
    default:
      return 31;
  }
}

/**
 * Construit une date LOCALE à minuit à partir d'une année, d'un mois (1 à 12)
 * et d'un jour. Aucune conversion UTC n'intervient : le `Date` retourné
 * représente exactement la journée saisie par l'utilisateur, quel que soit le
 * fuseau de l'appareil.
 *
 * Retourne `null` si le combo n'existe pas (30 février, 31 avril, mois hors 1-12,
 * jour hors 1-31).
 */
export function construireDateLocale(
  annee: number,
  mois: number,
  jour: number,
): Date | null {
  if (
    !Number.isInteger(annee) ||
    !Number.isInteger(mois) ||
    !Number.isInteger(jour)
  ) {
    return null;
  }
  if (mois < 1 || mois > 12) return null;
  if (jour < 1 || jour > joursDansLeMois(annee, mois)) return null;
  return new Date(annee, mois - 1, jour, 0, 0, 0, 0);
}

/**
 * Convertit un `Date` en chaîne locale `AAAA-MM-JJ` (composants locaux, jamais
 * `toISOString`). Toute date invalide (`NaN`) renvoie la chaîne vide.
 */
export function versAAAA_MM_JJ(date: Date | null | undefined): string {
  if (!date) return '';
  const temps = date.getTime();
  if (Number.isNaN(temps)) return '';
  const annee = date.getFullYear();
  const mois = date.getMonth() + 1;
  const jour = date.getDate();
  const anneeTexte = String(annee).padStart(4, '0');
  const moisTexte = String(mois).padStart(2, '0');
  const jourTexte = String(jour).padStart(2, '0');
  return `${anneeTexte}-${moisTexte}-${jourTexte}`;
}

/**
 * Analyse une chaîne `AAAA-MM-JJ` de façon STRICTE : le gabarit doit coller
 * exactement, le mois doit être entre 1 et 12, et le jour ne peut pas dépasser
 * le nombre de jours réels du mois (le 30 février, le 31 avril et le 29 février
 * hors année bissextile sont rejetés).
 *
 * Renvoie la `Date` locale correspondante, ou `null` si la chaîne est invalide.
 */
export function analyserAAAA_MM_JJ(texte: string | null | undefined): Date | null {
  if (!texte) return null;
  const propre = texte.trim();
  const resultat = patronAAAA_MM_JJ.exec(propre);
  if (!resultat) return null;
  const annee = Number.parseInt(resultat[1], 10);
  const mois = Number.parseInt(resultat[2], 10);
  const jour = Number.parseInt(resultat[3], 10);
  return construireDateLocale(annee, mois, jour);
}

/**
 * Formate une `Date` locale en `JJ/MM/AAAA` à la main (sans `Intl`), pour un
 * affichage court dans les champs et récapitulatifs.
 */
export function formaterJJ_MM_AAAA(date: Date | null | undefined): string {
  if (!date) return '';
  const temps = date.getTime();
  if (Number.isNaN(temps)) return '';
  const annee = date.getFullYear();
  const mois = date.getMonth() + 1;
  const jour = date.getDate();
  const jourTexte = String(jour).padStart(2, '0');
  const moisTexte = String(mois).padStart(2, '0');
  return `${jourTexte}/${moisTexte}/${annee}`;
}

/** Chaîne `AAAA-MM-JJ` → affichage `JJ/MM/AAAA` ; chaîne invalide → chaîne vide. */
export function formaterAAAA_MM_JJ_versJJ_MM_AAAA(
  valeur: string | null | undefined,
): string {
  return formaterJJ_MM_AAAA(analyserAAAA_MM_JJ(valeur));
}

/**
 * Une chaîne `AAAA-MM-JJ` est-elle une date RÉELLEMENT valide (format strict et
 * jour en fonction du mois et de l'année) ? Utilisé par les validateurs de
 * champ comme garde-fou, même si le sélecteur ne peut produire qu'une date valide.
 */
export function estAAAA_MM_JJValide(texte: string | null | undefined): boolean {
  return analyserAAAA_MM_JJ(texte) !== null;
}

/** Aujourd'hui, à minuit local (pour `dateMax = aujourd'hui` des champs de date). */
export function aujourdhuiLocal(): Date {
  const maintenant = new Date();
  return new Date(maintenant.getFullYear(), maintenant.getMonth(), maintenant.getDate(), 0, 0, 0, 0);
}

/** Année courante locale (jamais dérivée d'UTC). */
export function anneeCouranteLocale(): number {
  return new Date().getFullYear();
}
