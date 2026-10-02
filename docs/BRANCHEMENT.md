# Branchement réel (Supabase + API Express) — OMDA Mobile

- **Étape** : 21 — « Sélection mock ⇄ réel robuste et séparée (Membre / Candidat) ».
- **Principe** : l'application fonctionne **intégralement en mode mock par
  défaut**. La bascule se fait **sans toucher aux écrans**, via la fabrique
  `src/services/factory.ts` et des variables d'environnement.
- **Deux parcours, deux flags** : le parcours **MEMBRE** (Supabase) et le parcours
  **CANDIDAT** (API REST Express) se branchent **indépendamment**. On peut donc
  passer le membre en réel alors que l'API Express du candidat n'existe pas
  encore : le candidat reste alors en démonstration (voir §2.3).

---

## 1) Variables d'environnement à renseigner

Copiez `.env.example` en `.env` (fichier ignoré par git) et complétez :

| Variable | Obligatoire | Rôle |
|---|---|---|
| `EXPO_PUBLIC_SUPABASE_URL` | si parcours membre réel | URL du projet Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | si parcours membre réel | Clé publique anonyme (`anon`) |
| `EXPO_PUBLIC_API_BASE_URL` | si parcours candidat réel | URL de l'API REST Express candidat. **Vide ⇒ le candidat reste en mock** |
| `EXPO_PUBLIC_USE_MOCKS_MEMBER` | non (`true` par défaut) | Parcours **MEMBRE** : `true` = mocks, `false` = Supabase (auth + données + contenus publics) |
| `EXPO_PUBLIC_USE_MOCKS_CANDIDATE` | non (`true` par défaut) | Parcours **CANDIDAT** : `true` = mock, `false` = API Express (à condition que `EXPO_PUBLIC_API_BASE_URL` soit renseignée) |
| `EXPO_PUBLIC_USE_MOCKS` | non | **Repli de compatibilité** : utilisée seulement si le flag du parcours concerné n'est pas défini |

### Règles de lecture (implémentées dans `src/services/factory.ts`)

1. **Mock par défaut** : seule la valeur exacte `false` (insensible à la casse et
   aux espaces) bascule un parcours en réel ; toute autre valeur — y compris une
   variable absente ou vide — conserve les mocks.
2. **Repli** : `EXPO_PUBLIC_USE_MOCKS` s'applique au parcours dont le flag dédié
   n'est pas défini, de sorte que les `.env` déjà en place continuent de
   fonctionner à l'identique.
3. **Pas d'API Express ⇒ candidat en mock** : même avec
   `EXPO_PUBLIC_USE_MOCKS_CANDIDATE=false`, `candidateApi` reste
   `MockCandidateApi` tant que `EXPO_PUBLIC_API_BASE_URL` est vide : sans serveur
   à joindre, aucun appel réel n'est tenté (le parcours candidat reste utilisable
   en démonstration, cf. §2.3).
4. **Contenus publics** : `publicContentService` suit le flag **MEMBRE**
   (`documentation`, `categorie`, `tarif`, `operateur_mobile_money` sont des
   tables Supabase, §5 de `docs/SCHEMA_DB.md`).

> Préfixe `EXPO_PUBLIC_` : ces valeurs sont intégrées au bundle par Expo et sont
> donc **publiques**. N'y mettez jamais de clé `service_role` ni de secret.

Après modification de `.env`, **redémarrez Metro** (`npx expo start -c`) : les
variables sont lues au démarrage du bundle.

---

## 2) Brancher un parcours

### 2.1 Parcours MEMBRE (Supabase)

1. Renseigner `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. Passer `EXPO_PUBLIC_USE_MOCKS_MEMBER=false`.
3. Redémarrer Metro (`npx expo start -c`).

### 2.2 Avec API Express : endpoints + baseURL

1. Renseigner `EXPO_PUBLIC_API_BASE_URL` — l'URL de **base** de l'API Express,
   **sans barre finale** : `HttpCandidateApi` ajoute lui-même le préfixe `/v1`.
2. Passer `EXPO_PUBLIC_USE_MOCKS_CANDIDATE=false`.
3. Redémarrer Metro (`npx expo start -c`).

`candidateApi` devient alors `HttpCandidateApi` : chaque URL est composée
`EXPO_PUBLIC_API_BASE_URL` + `/v1` + chemin (ex.
`https://api.omda.mg/v1/demandes`). Les 8 méthodes du contrat `CandidateApi`
appellent :

| Méthode `CandidateApi` | Requête (après `baseURL` + `/v1`) |
|---|---|
| `creerDemande` | `POST /demandes` |
| `mettreAJourDemande` | `PATCH /demandes/{numero_dossier}` |
| `soumettreDemande` | `POST /demandes/{numero_dossier}/envoi` (+ `Idempotency-Key`) |
| `televerserFichier` | `POST /fichiers` (multipart) |
| `suivreDemande` | `GET /suivi/{numero_dossier}` |
| `obtenirOptionsPaiement` | `GET /paiements/options/{numero_dossier}` |
| `initierPaiement` | `POST /paiements` (+ `Idempotency-Key`) |
| `obtenirEtatPaiement` | `GET /paiements/{reference_interne}` |

En-têtes : `X-Numero-Dossier` / `X-Code-Suivi` (dès qu'un dossier est connu) et
`Idempotency-Key` (envoi de dossier, initiation de paiement) ; délai **15 s** par
requête JSON et **120 s** par téléversement. Contrat complet :
`docs/API_CANDIDAT.md` (§5, §7, §9).

### 2.3 Sans API Express : parcours candidat reste en mock

Le parcours candidat **reste en mock**, sans aucune configuration à ajouter :

- soit `EXPO_PUBLIC_USE_MOCKS_CANDIDATE` vaut `true` (valeur par défaut) ;
- soit `EXPO_PUBLIC_API_BASE_URL` est **vide**, même avec
  `EXPO_PUBLIC_USE_MOCKS_CANDIDATE=false`.

Ce garde-fou évite d'instancier `HttpCandidateApi` sans serveur à joindre : aucun
écran ne peut afficher le refus « L'API OMDA n'est pas configurée
(EXPO_PUBLIC_API_BASE_URL)… ». Le parcours adhésion / suivi / paiement continue
donc de fonctionner avec ses données de démonstration pendant que le parcours
membre est déjà branché sur Supabase.

**Aucun crash si la base URL est vide** (vérifié par script, étape 25) : même si
`HttpCandidateApi` était instancié à la main, aucune méthode ne lève
d'exception — `demander()` et `televerserFichier()` renvoient immédiatement un
`Result` `serveur` « L'API OMDA n'est pas configurée (EXPO_PUBLIC_API_BASE_URL)… »,
sans aucun appel réseau. Le parcours candidat reste donc utilisable et
l'application ne plante jamais, même sans configuration.

### 2.4 Sélection effectuée par la fabrique

| Singleton exporté | Parcours | Mode mock (défaut) | Mode réel |
|---|---|---|---|
| `authService` | Membre | `MockAuthService` | `SupabaseAuthService` (implémenté) |
| `memberRepository` | Membre | `MockMemberRepository` | `SupabaseMemberRepository` (lectures + Storage branchés, écritures à venir) |
| `publicContentService` | Membre | `MockPublicContentService` | `SupabasePublicContentService` (squelette) |
| `candidateApi` | Candidat | `MockCandidateApi` | `HttpCandidateApi` (implémenté) |

Pour revenir en démonstration : passer le flag du parcours à `true` (ou le
supprimer). Toute valeur autre que `false` conserve les mocks.

---

## 3) Fichiers de la couche réelle (étape 17)

| Fichier | Contenu |
|---|---|
| `src/services/factory.ts` | Fabrique : singletons + lecture des flags `EXPO_PUBLIC_USE_MOCKS_MEMBER` / `EXPO_PUBLIC_USE_MOCKS_CANDIDATE` (repli `EXPO_PUBLIC_USE_MOCKS`) |
| `src/services/supabase/client.ts` | `createClient(URL, anonKey)` **paresseux** + session persistée par `expo-secure-store` |
| `src/services/supabase/SupabaseAuthService.ts` | `AuthService` réel (signInWithPassword / signOut / resetPasswordForEmail / updateUser / getSession / onAuthStateChange) |
| `src/services/supabase/SupabaseMemberRepository.ts` | `MemberRepository` — 9 lectures réelles + Storage (`televerserFichier`, `obtenirUrlFichier`) ; **écritures encore en `erreurNonBranche()`** |
| `src/services/supabase/storage.ts` | Envoi natif avec progression + annulation, liens signés et suppression — buckets `pieces` / `oeuvres` |
| `src/services/supabase/SupabasePublicContentService.ts` | `PublicContentService` — **squelette** (refus « non branché ») : à écrire avant de brancher les contenus publics |
| `src/services/http/HttpCandidateApi.ts` | `CandidateApi` — **implémenté** (8/8 méthodes, `docs/API_CANDIDAT.md`, `EXPO_PUBLIC_API_BASE_URL`) |
| `src/services/nonImplemente.ts` | Refus serveur standard des parties non encore branchées |

**Sécurité du démarrage** : le client Supabase est créé au **premier appel réel**
(`getSupabaseClient()`), jamais à l'import. Une configuration absente ne fait donc
jamais planter l'application ; elle produit un refus `serveur` explicite.

---
## 4) Buckets Storage attendus

| Bucket | Usage | Accès |
|---|---|---|
| `pieces` | Pièces justificatives du candidat : `PHOTO`, `CIN` légalisée, `ACTE_NAISSANCE`, `CERTIFICAT_RESIDENCE`, `AUTORISATION_PARENTALE` (15–17 ans) | Privé |
| `oeuvres` | Fichiers d'œuvre (MP3, WAV, PDF, JPEG, PNG) **et** attestations de diffusion (PDF, JPEG, PNG uniquement) | Privé |

> **Le bucket `preuves` a été SUPPRIMÉ** : l'ancien paiement manuel (dépôt d'un
> justificatif) n'existe plus. Seul **Mobile Money (MVola)** subsiste, avec
> confirmation automatique par le serveur.

Contraintes déjà appliquées côté application : **20 Mo maximum** par fichier ;
attestation de diffusion limitée à **`application/pdf`, `image/jpeg`,
`image/png`** (`TYPES_MIME_ATTESTATION`) ; le fichier d'œuvre accepte en plus
l'audio (`audio/mpeg`, `audio/wav`).

---

## 5) Points RLS à vérifier (Supabase)

RLS **activée sur toutes les tables** ; aucune règle n'est déléguée à l'UI.

| Table | Règle attendue pour le rôle `authenticated` |
|---|---|
| `utilisateur` | `SELECT`/`UPDATE` sur sa propre ligne (`id = auth.uid()`) ; aucune lecture des autres comptes |
| `membre` | `SELECT` sur son propre membre (`utilisateur_id = auth.uid()`) |
| `membre_categorie` | `SELECT` sur ses appartenances ; **aucun** `UPDATE` de `statut` (seul un agent OMDA active une catégorie) |
| `oeuvre` | `SELECT`/`INSERT`/`UPDATE` sur ses propres œuvres ; `UPDATE` interdit dès que le statut sort de `STATUTS_OEUVRE_MODIFIABLES` |
| `attestation_diffusion` | `SELECT` sur ses attestations ; `INSERT`/`UPDATE` (remplacement) uniquement ; **aucun `DELETE`** |
| `cotisation` | `SELECT` seul (une cotisation est produite par le serveur) |
| `paiement` | `INSERT` (initiation) + `SELECT` de ses paiements ; **jamais** de passage manuel à `REUSSI` (confirmation serveur / opérateur uniquement) |
| `notification` | `SELECT` sur ses notifications + celles globales (`utilisateur_id IS NULL`) ; `UPDATE` limité au marquage « lue » |
| `documentation`, `categorie`, `tarif`, `operateur_mobile_money` | `SELECT` public (lecture seule ; un élément `actif = false` ne doit pas être exposé) |
| `candidat`, `demande_adhesion` | **Aucun accès direct** depuis le mobile : le parcours candidat passe par l'API Express (clé `service_role` côté serveur) |

Buckets (`storage.objects`) : `pieces` et `oeuvres` en **privé** ; politique
autorisant un membre à lire/écrire uniquement sous son propre préfixe
(`<utilisateur_id>/…`), et l'API Express à écrire pour le candidat.

### Migrations RLS à exécuter

Les écritures membre de `SupabaseMemberRepository` (étape 23) exigent des
politiques absentes du script initial de `docs/SCHEMA_DB.md`. Elles sont
fournies dans `supabase/migrations/` et doivent être exécutées **dans
l'éditeur SQL de Supabase** (Dashboard Supabase → **SQL Editor** →
*New query* → coller le contenu du fichier → **Run**), **dans cet ordre** :

| Ordre | Fichier | Ce qu'il apporte |
|---|---|---|
| 1 | `supabase/migrations/0001_oeuvre_membre.sql` | Vérifie la politique `INSERT` `oeuvre_insert_owner_or_staff` du schéma initial (bloc `DO`), puis ajoute la politique `UPDATE` du membre sur **ses propres œuvres** (`membre_id` lié à `auth.uid()`), réservée aux statuts `BROUILLON` / `ENVOYEE` / `EN_COURS_DE_VALIDATION` |
| 2 | `supabase/migrations/0002_attestation_diffusion_membre.sql` | `SELECT` / `INSERT` / `UPDATE` pour le **propriétaire de l'œuvre** (remplacement d'attestation, jamais de `DELETE`) + contrainte `CHECK` sur `mime_type` : `application/pdf`, `image/jpeg`, `image/png` |
| 3 | `supabase/migrations/0003_membre_categorie_membre.sql` | `INSERT` d'une demande `EN_ATTENTE` par le membre + `UPDATE` d'**annulation uniquement** (`EN_ATTENTE` ⇒ `ANNULEE`, propriétaire seulement) |

> **Avertissement** : exécuter ces fichiers **dans le SQL editor Supabase**
> (ni depuis un terminal, ni depuis l'application), **après** le script
> initial de `docs/SCHEMA_DB.md` et **dans l'ordre 0001 → 0002 → 0003**.
> Chaque migration est idempotente (`drop policy if exists`) et peut être
> relancée sans risque.

> **Limite connue** : la migration 0003 n'ouvre que l'annulation — la
> **réouverture** d'une demande (`ANNULEE` / `REJETEE` ⇒ `EN_ATTENTE`) reste
> bloquée par RLS en mode réel (refus « écriture sans ligne » dans
> `demanderCategorieSupplementaireAvecOeuvres`). Signal détaillé dans la
> note d'étape 24 de `docs/PROGRESS.md`.

---

## 6) Ce qui reste à écrire (prochaines étapes)

1. `SupabaseMemberRepository` : les **écritures** encore en `erreurNonBranche()`
   (`mettreAJourProfil`, demandes de catégorie, `creerOeuvre`,
   `mettreAJourOeuvre`, `soumettreOeuvre`, paiements, marquage des
   notifications) — les 9 lectures et le Storage sont déjà branchés (étapes 18
   et 20).
2. `SupabasePublicContentService` : lecture de `documentation`,
   `categorie`, `tarif`, `operateur_mobile_money` (avec `actif = true`). ⚠️ Tant
   qu'il reste un squelette, passer `EXPO_PUBLIC_USE_MOCKS_MEMBER=false` bascule
   AUSSI les contenus publics (documentation, tarifs, catégories) sur ce
   squelette : ils renverront un refus « non branché ».
3. Branchement effectif des écrans/contextes sur `src/services/factory.ts`
   (aujourd'hui ils consomment encore le barrel `src/services/mocks`, dont le
   comportement est identique en mode mock).

---

## 7) Dépannage

| Symptôme | Cause probable |
|---|---|
| Bannière « Service réel pas encore branché… » | Un parcours est en réel alors que son implémentation est encore un squelette (typiquement `EXPO_PUBLIC_USE_MOCKS_MEMBER=false` et les contenus publics) |
| « Supabase n'est pas configuré… » | `EXPO_PUBLIC_SUPABASE_URL` ou `EXPO_PUBLIC_SUPABASE_ANON_KEY` vide alors que le parcours membre est en réel |
| « L'API OMDA n'est pas configurée… » | `HttpCandidateApi` utilisé sans `EXPO_PUBLIC_API_BASE_URL` (impossible via la fabrique : le candidat reste alors en mock) |
| Le parcours candidat reste en mock | `EXPO_PUBLIC_API_BASE_URL` vide, ou `EXPO_PUBLIC_USE_MOCKS_CANDIDATE` pas passée à `false` |
| Le parcours membre reste en mock | `EXPO_PUBLIC_USE_MOCKS_MEMBER` absente et repli `EXPO_PUBLIC_USE_MOCKS` encore à `true` |
| Les variables ne sont pas prises en compte | Metro n'a pas été redémarré (`npx expo start -c`) |

