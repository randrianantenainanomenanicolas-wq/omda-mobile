import {
  analyserAAAA_MM_JJ,
  anneeCouranteLocale,
  aujourdhuiLocal,
  construireDateLocale,
  estAAAA_MM_JJValide,
  estAnneeBissextile,
  formaterAAAA_MM_JJ_versJJ_MM_AAAA,
  formaterJJ_MM_AAAA,
  joursDansLeMois,
  versAAAA_MM_JJ,
} from '../src/utils/dates';

/**
 * Vérification autonome des utilitaires de date (`src/utils/dates.ts`).
 * Lancer avec `npx --yes tsx tools/verif-dates.ts` — sortie attendue :
 * `TOUS LES CONTROLES SONT PASSES`.
 *
 * Cas couverts : aller-retour `AAAA-MM-JJ`, jours limites (31/12, 01/01, 29/02
 * bissextile et non bissextile, 30/02, 31/04), format strict (rejet des
 * valeurs mal formées), cohérence locale UTC+3 (Madagascar) et utilitaires
 * annexes (`joursDansLeMois`, `estAnneeBissextile`, `aujourdhuiLocal`,
 * `anneeCouranteLocale`).
 */

let echecs = 0;

function verifier(libelle: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log('[OK]    ' + libelle);
  } else {
    echecs += 1;
    console.log('[ECHEC] ' + libelle + (detail ? ' -> ' + detail : ''));
  }
}

function egalite(libelle: string, reel: unknown, attendu: unknown): void {
  verifier(libelle, reel === attendu, `reçu=${String(reel)} attendu=${String(attendu)}`);
}

// ---------------------------------------------------------------------------
// 1. Bissextiles et nombre de jours par mois
// ---------------------------------------------------------------------------

egalite('2024 bissextile (divisible par 4, non séculaire)', estAnneeBissextile(2024) ? 'oui' : 'non', 'oui');
egalite('2023 non bissextile', estAnneeBissextile(2023) ? 'oui' : 'non', 'non');
egalite('1900 non bissextile (séculaire non divisible par 400)', estAnneeBissextile(1900) ? 'oui' : 'non', 'non');
egalite('2000 bissextile (séculaire divisible par 400)', estAnneeBissextile(2000) ? 'oui' : 'non', 'oui');
egalite('Février 2024 : 29 jours', joursDansLeMois(2024, 2), 29);
egalite('Février 2023 : 28 jours', joursDansLeMois(2023, 2), 28);
egalite('Février 1900 : 28 jours (piège séculaire)', joursDansLeMois(1900, 2), 28);
egalite('Février 2000 : 29 jours (piège séculaire validé)', joursDansLeMois(2000, 2), 29);
egalite('Avril : 30 jours', joursDansLeMois(2026, 4), 30);
egalite('Décembre : 31 jours', joursDansLeMois(2026, 12), 31);
egalite('Mois 13 : 0 jour (inexistant)', joursDansLeMois(2026, 13), 0);
egalite('Mois 0 : 0 jour (inexistant)', joursDansLeMois(2026, 0), 0);

// ---------------------------------------------------------------------------
// 2. construireDateLocale — bornes et rejets
// ---------------------------------------------------------------------------

verifier(
  'construireDateLocale(2026, 11, 5) valide',
  construireDateLocale(2026, 11, 5) instanceof Date,
);
verifier(
  'construireDateLocale(2024, 2, 29) valide (bissextile)',
  construireDateLocale(2024, 2, 29) instanceof Date,
);
verifier(
  'construireDateLocale(2023, 2, 29) rejeté (non bissextile)',
  construireDateLocale(2023, 2, 29) === null,
);
verifier(
  'construireDateLocale(2026, 2, 30) rejeté',
  construireDateLocale(2026, 2, 30) === null,
);
verifier(
  'construireDateLocale(2026, 4, 31) rejeté (avril = 30 jours)',
  construireDateLocale(2026, 4, 31) === null,
);
verifier(
  'construireDateLocale(2026, 13, 1) rejeté (mois inexistant)',
  construireDateLocale(2026, 13, 1) === null,
);
verifier(
  'construireDateLocale(2026, 12, 0) rejeté (jour 0)',
  construireDateLocale(2026, 12, 0) === null,
);
verifier(
  'construireDateLocale avec composants non entiers rejeté',
  construireDateLocale(2026, 11.5, 5) === null,
);

// ---------------------------------------------------------------------------
// 3. versAAAA_MM_JJ — composants locaux uniquement, JAMAIS toISOString
// ---------------------------------------------------------------------------

const dateFinAnnee = construireDateLocale(2026, 12, 31);
verifier('versAAAA_MM_JJ(31/12/2026 local)', dateFinAnnee !== null);
egalite(
  '31 décembre local → 2026-12-31 (aucun décalage UTC)',
  dateFinAnnee ? versAAAA_MM_JJ(dateFinAnnee) : '(null)',
  '2026-12-31',
);

const dateDebutAnnee = construireDateLocale(2027, 1, 1);
egalite(
  '1er janvier local → 2027-01-01 (aucun décalage UTC)',
  dateDebutAnnee ? versAAAA_MM_JJ(dateDebutAnnee) : '(null)',
  '2027-01-01',
);

// Le test suivant prouve l\'absence de \`toISOString\` : une date locale à minuit,
// convertie par \`toISOString\`, aurait décalé d\'un jour en UTC- ; ici on garde
// une Date explicite et on vérifie que la conversion est bien STRICTEMENT locale.
const dateNoel = construireDateLocale(2026, 12, 25);
egalite(
  'Noël 2026 reste 2026-12-25 quelque soit le fuseau',
  dateNoel ? versAAAA_MM_JJ(dateNoel) : '(null)',
  '2026-12-25',
);

egalite('versAAAA_MM_JJ(null) → chaîne vide', versAAAA_MM_JJ(null), '');
verifier(
  'versAAAA_MM_JJ(new Date(NaN)) → chaîne vide',
  versAAAA_MM_JJ(new Date(NaN)) === '',
);

// ---------------------------------------------------------------------------
// 4. analyserAAAA_MM_JJ — lecture STRICTE
// ---------------------------------------------------------------------------

const analyseeValide = analyserAAAA_MM_JJ('2024-02-29');
verifier('analyse 2024-02-29 acceptée (bissextile)', analyseeValide !== null);
egalite(
  'aller simple 2024-02-29 → jour 29 / mois 2 (0-based 1) / année 2024',
  analyseeValide
    ? `${analyseeValide.getFullYear()}-${analyseeValide.getMonth() + 1}-${analyseeValide.getDate()}`
    : '(null)',
  '2024-2-29',
);

verifier('analyse 2023-02-29 rejetée (non bissextile)', analyserAAAA_MM_JJ('2023-02-29') === null);
verifier('analyse 2026-02-30 rejetée (30 février)', analyserAAAA_MM_JJ('2026-02-30') === null);
verifier('analyse 2026-04-31 rejetée (31 avril)', analyserAAAA_MM_JJ('2026-04-31') === null);
verifier('analyse 2026-13-01 rejetée (mois 13)', analyserAAAA_MM_JJ('2026-13-01') === null);
verifier('analyse 2026-00-10 rejetée (mois 0)', analyserAAAA_MM_JJ('2026-00-10') === null);
verifier('analyse 2026-11-00 rejetée (jour 0)', analyserAAAA_MM_JJ('2026-11-00') === null);
verifier('analyse 2026-11-32 rejetée (jour > 31)', analyserAAAA_MM_JJ('2026-11-32') === null);
verifier('analyse 26-11-05 rejetée (AAAA attendu sur 4 chiffres)', analyserAAAA_MM_JJ('26-11-05') === null);
verifier('analyse 2026/11/05 rejetée (séparateurs non conformes)', analyserAAAA_MM_JJ('2026/11/05') === null);
verifier('analyse 2026-1-5 rejetée (MM et JJ attendus sur 2 chiffres)', analyserAAAA_MM_JJ('2026-1-5') === null);
verifier('analyse chaîne vide rejetée', analyserAAAA_MM_JJ('') === null);
verifier('analyse null/undefined rejeté', analyserAAAA_MM_JJ(null) === null && analyserAAAA_MM_JJ(undefined) === null);
verifier('analyse texte libre rejeté', analyserAAAA_MM_JJ('pas une date') === null);

// ---------------------------------------------------------------------------
// 5. Aller-retour AAAA-MM-JJ vers Date locale et retour (toujours identique)
// ---------------------------------------------------------------------------

const echantillonAllerRetour = [
  '1996-04-12',
  '2000-02-29',
  '1900-01-01',
  '2024-12-31',
  '2026-11-05',
  '2100-03-15',
];
for (const valeur of echantillonAllerRetour) {
  const parse = analyserAAAA_MM_JJ(valeur);
  egalite(
    `aller-retour ${valeur} → Date → ${valeur}`,
    parse ? versAAAA_MM_JJ(parse) : '(null)',
    valeur,
  );
}

// ---------------------------------------------------------------------------
// 6. formaterJJ_MM_AAAA et helper AAAA-MM-JJ → JJ/MM/AAAA
// ---------------------------------------------------------------------------

egalite(
  'formaterJJ_MM_AAAA(2026-11-05 local)',
  construireDateLocale(2026, 11, 5)
    ? formaterJJ_MM_AAAA(construireDateLocale(2026, 11, 5))
    : '(null)',
  '05/11/2026',
);
egalite(
  'formaterJJ_MM_AAAA(date invalide) → chaîne vide',
  formaterJJ_MM_AAAA(new Date(NaN)),
  '',
);
egalite(
  'formaterJJ_MM_AAAA(null) → chaîne vide',
  formaterJJ_MM_AAAA(null),
  '',
);
egalite(
  'formaterAAAA_MM_JJ_versJJ_MM_AAAA("1996-04-12")',
  formaterAAAA_MM_JJ_versJJ_MM_AAAA('1996-04-12'),
  '12/04/1996',
);
egalite(
  'formaterAAAA_MM_JJ_versJJ_MM_AAAA("2026-02-30") → vide (date impossible)',
  formaterAAAA_MM_JJ_versJJ_MM_AAAA('2026-02-30'),
  '',
);
egalite(
  'formaterAAAA_MM_JJ_versJJ_MM_AAAA(null) → vide',
  formaterAAAA_MM_JJ_versJJ_MM_AAAA(null),
  '',
);

// ---------------------------------------------------------------------------
// 7. estAAAA_MM_JJValide — garde-fou des validateurs de champ
// ---------------------------------------------------------------------------

verifier('estAAAA_MM_JJValide("1996-04-12") = true', estAAAA_MM_JJValide('1996-04-12'));
verifier('estAAAA_MM_JJValide("2026-02-30") = false', !estAAAA_MM_JJValide('2026-02-30'));
verifier('estAAAA_MM_JJValide("") = false', !estAAAA_MM_JJValide(''));
verifier('estAAAA_MM_JJValide(null) = false', !estAAAA_MM_JJValide(null));

// ---------------------------------------------------------------------------
// 8. aujourdhuiLocal et anneeCouranteLocale — aucune trace d'UTC
// ---------------------------------------------------------------------------

const aujourdhui = aujourdhuiLocal();
verifier(
  'aujourdhuiLocal() = minuit local (heures/minutes/secondes/ms à 0)',
  aujourdhui.getHours() === 0 &&
    aujourdhui.getMinutes() === 0 &&
    aujourdhui.getSeconds() === 0 &&
    aujourdhui.getMilliseconds() === 0,
);
egalite(
  'aujourdhuiLocal().getFullYear() === anneeCouranteLocale()',
  aujourdhui.getFullYear(),
  anneeCouranteLocale(),
);
egalite(
  'versAAAA_MM_JJ(aujourdhuiLocal()) commence par l\'année courante',
  versAAAA_MM_JJ(aujourdhui).slice(0, 4),
  String(anneeCouranteLocale()),
);

// ---------------------------------------------------------------------------
// Synthèse
// ---------------------------------------------------------------------------

if (echecs > 0) {
  console.log(`\n${echecs} CONTRÔLE(S) EN ÉCHEC.`);
  process.exit(1);
}
console.log('\nTOUS LES CONTROLES SONT PASSES');
