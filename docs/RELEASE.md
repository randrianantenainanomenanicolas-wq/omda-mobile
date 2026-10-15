# OMDA Mobile — Guide de release (EAS Build / Submit)

Ce document décrit la procédure de publication de l'application **OMDA** (Expo + EAS). Il ne change **aucune règle métier** : il documente uniquement la configuration de build, les variables d'environnement et les commandes.

## 1) Variables d'environnement (`EXPO_PUBLIC_*`)

Toutes les variables publiques sont préfixées `EXPO_PUBLIC_` et lues à la compilation du bundle (voir `docs/BRANCHEMENT.md` §2 pour le détail du routage).

| Variable | Rôle | Valeur de production (exemple) |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | URL de l'API Express de suivi candidat (`HttpCandidateApi`). **Vide ⇒ repli automatique sur les mocks** (le parcours candidat reste utilisable). | `https://api-omda.example.org` |
| `EXPO_PUBLIC_USE_MOCKS_CANDIDATE` | Force (ou non) le service candidat en mock. Seule la valeur exacte `false` (minuscules) active le réel ; tout le reste ⇒ mock. | `false` |
| `EXPO_PUBLIC_USE_MOCKS_MEMBER` | Idem pour l'espace membre / auth / contenu public. | `false` |
| `EXPO_PUBLIC_SUPABASE_URL` | URL du projet Supabase (requis dès que le membre ou le contenu public bascule en réel). | `https://xxxx.supabase.co` |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | Clé anon publique Supabase. | `eyJhbGciOi...` |

Modèle copiable : `.env.example` (racine du projet). Un `.env` local sert au développement ; **les valeurs embarquées dans un build EAS** proviennent de l'environnement EAS (voir §4) — ne jamais committer de secret réel, la clé anon est publique par conception.

## 2) Bascule mocks ⇄ réel (membre / candidat)

Résumé des règles appliquées par `src/services/factory.ts` (inchangées par cette étape) :

- **Mock par défaut** : toute valeur autre que `false` exact (absente, `true`, `1`, `0`, ` FALSE `…) laisse le service en mock.
- Passer `EXPO_PUBLIC_USE_MOCKS_MEMBER=false` ⇒ le membre et l'authentification utilisent Supabase (`EXPO_PUBLIC_SUPABASE_URL` + `EXPO_PUBLIC_SUPABASE_ANON_KEY` requis ; migrations `supabase/migrations/` exécutées — voir `docs/BRANCHEMENT.md`).
- Passer `EXPO_PUBLIC_USE_MOCKS_CANDIDATE=false` ⇒ le parcours candidat utilise `HttpCandidateApi` (`EXPO_PUBLIC_API_BASE_URL` requis ; sinon `HttpCandidateApi` renvoie une erreur « non configurée » sans crash).
- Laisser `EXPO_PUBLIC_API_BASE_URL` **vide** ⇒ le candidat reste en mock **même** si le drapeau vaut `false` (repli sûr vérifié à l'étape 25).

Exemple `.env` de démonstration (repli total mock) :

```bash
EXPO_PUBLIC_API_BASE_URL=
EXPO_PUBLIC_USE_MOCKS_MEMBER=true
EXPO_PUBLIC_USE_MOCKS_CANDIDATE=true
```

Exemple `.env` de recette connectée :

```bash
EXPO_PUBLIC_API_BASE_URL=https://api-omda.example.org
EXPO_PUBLIC_USE_MOCKS_MEMBER=false
EXPO_PUBLIC_USE_MOCKS_CANDIDATE=false
EXPO_PUBLIC_SUPABASE_URL=https://xxxx.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOi...
```

## 3) Prérequis EAS

1. Compte Expo : `npx eas-cli whoami` (sinon `npx eas-cli login`).
2. Lier le projet : déjà fait via `app.json` (`expo.name` = **OMDA**, `expo.slug` = **omda-mobile**, `expo.version` = **1.0.0**) ; `eas.json` (racine) définit les profils `development` / `preview` / `production`.
3. CLI : `eas.json` impose `cli.version` `>= 16.0.0` et `appVersionSource` `local` (le numéro de version vient de `app.json`).
4. Assets présents : `assets/icon.png`, `assets/splash.png`, `assets/android-icon-*.png`, `assets/favicon.png` (déjà référencés dans `app.json`, splash en `contain` sur fond `#F5F4EF`).
5. Android : keystore de signature (ou laisser EAS en générer un — demandé à la première construction `production`). iOS : compte Apple Developer requis pour `eas submit`.

## 4) Commandes EAS

Exécuter à la racine du projet :

```bash
# Connexion (une fois par machine)
npx eas-cli login

# Lister / vérifier les builds
npx eas-cli build:list

# Android — développement (development client, distribution interne)
npx eas-cli build --platform android --profile development

# Android — preview (APK interne pour recette hors store)
npx eas-cli build --platform android --profile preview

# Android — production (AAB Google Play, autoIncrement)
npx eas-cli build --platform android --profile production

# iOS — production (App Store, compte Apple Developer requis)
npx eas-cli build --platform ios --profile production

# Soumission aux stores
npx eas-cli submit --platform android --profile production
npx eas-cli submit --platform ios --profile production
```

Profils définis dans `eas.json` :

| Profil | Détails | Usage |
| --- | --- | --- |
| `development` | `developmentClient: true`, `distribution: "internal"` | Build de développement (expo-dev-client) installable en interne. |
| `preview` | `distribution: "internal"` (APK Android par défaut) | Recette sur appareil réel **sans** store — idéal pour `docs/TEST_PLAN.md`. |
| `production` | `autoIncrement: true` (version locale `app.json`) | Publication store (AAB / IPA). |

### Variables EAS pour un build connecté

Le bundle embarque les valeurs `EXPO_PUBLIC_*` présentes au moment de la construction. Deux méthodes :

1. **Bloc `"env"` dans `eas.json`** : ajouter à chaque profil un bloc `"env": { "EXPO_PUBLIC_...": "..." }` (valeurs à ne pas committer si elles sont sensibles — préférer les secrets Expo), ou
2. **Secrets EAS** : `npx eas-cli secret:create --name EXPO_PUBLIC_SUPABASE_URL --value https://....supabase.co` (idem pour les autres variables) — injectés par le CLI pendant le build.

Pour un **build de démonstration 100 % mock**, ne rien déclarer : les services restent en mock par défaut.

## 5) Checklist avant release

1. `npx tsc --noEmit` → 0 erreur.
2. `npx --yes tsx tools/verif-mocks.ts` → `TOUS LES CONTROLES SONT PASSES` (mocks inchangés).
3. Exécuter `docs/TEST_PLAN.md` sur appareil (rappels T1–T7 + scénarios §1–§11) sur un build `preview`.
4. Si bascule réel membre : exécuter `supabase/migrations/0001_oeuvre_membre.sql` → `0002_attestation_diffusion_membre.sql` → `0003_membre_categorie_membre.sql` dans l'éditeur SQL Supabase (voir `docs/BRANCHEMENT.md`).
5. Variables du profil visé (§1) : aucun secret réel commité, `.env.example` à jour, secrets EAS renseignés pour les builds connectés.
6. Drapeaux confirmés (§2) : mock par défaut ; seule la valeur exacte `false` bascule un parcours en réel.
7. Version et assets : `app.json` (`expo.version`, icône, splash) cohérents — l'incrément `production` est géré par `autoIncrement`.
8. `git status --short` propre avant commit, puis tag `etape-N` (convention du projet).
9. Construction : `npx eas-cli build --platform android --profile preview` → recette → `production` puis `npx eas-cli submit` pour les stores.

## 6) Limitations connues (aucune règle métier changée)

- Les écrans consomment encore `src/services/mocks` directement : le raccordement des écrans et d'`AuthContext` à `src/services/factory.ts` reste différé (`docs/BRANCHEMENT.md` §6).
- Restent en `erreurNonBranche()` côté réel : `SupabasePublicContentService`, `demanderCategorieSupplementaire` (variante sans œuvres), mise à jour du profil, paiements et marquage des notifications.
- Réouverture d'une catégorie `ANNULEE` / `REJETEE` bloquée par la migration 0003 (annulation stricte assumée ; toute extension demande une décision explicite).
- Les migrations RLS (0001 → 0003) s'exécutent manuellement dans le SQL editor Supabase avant toute session réelle membre.
- Sans `EXPO_PUBLIC_API_BASE_URL`, `HttpCandidateApi` renvoie un `Result` `serveur` typé sans crash (comportement voulu, étape 25).
- `eas submit` iOS exige un compte Apple Developer ; la construction `production` Android demande un keystore (généré à la demande par EAS).
