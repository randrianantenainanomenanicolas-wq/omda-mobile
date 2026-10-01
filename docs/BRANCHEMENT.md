# Branchement réel (Supabase + API Express) — OMDA Mobile

- **Étape** : 17 — « Préparer le branchement Supabase (sans activer en prod) ».
- **Principe** : l'application fonctionne **intégralement en mode mock par défaut**
  (`EXPO_PUBLIC_USE_MOCKS=true`). Le branchement réel se fait **sans toucher aux
  écrans**, via la fabrique `src/services/factory.ts` et les variables
  d'environnement.

---

## 1) Variables d'environnement à renseigner

Copiez `.env.example` en `.env` (fichier ignoré par git) et complétez :

| Variable | Obligatoire | Rôle |
|---|---|---|
| `EXPO_PUBLIC_USE_MOCKS` | oui | `true` (défaut) = mocks ; `false` = services réels |
| `EXPO_PUBLIC_SUPABASE_URL` | si mode réel | URL du projet Supabase |
| `EXPO_PUBLIC_SUPABASE_ANON_KEY` | si mode réel | Clé publique anonyme (`anon`) |
| `EXPO_PUBLIC_API_BASE_URL` | si parcours candidat réel | URL de l'API REST Express candidat |

> Préfixe `EXPO_PUBLIC_` : ces valeurs sont intégrées au bundle par Expo et sont
> donc **publiques**. N'y mettez jamais de clé `service_role` ni de secret.

Après modification de `.env`, **redémarrez Metro** (`npx expo start -c`) : les
variables sont lues au démarrage du bundle.

---

## 2) Passer en mode réel

1. Renseigner `EXPO_PUBLIC_SUPABASE_URL` et `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
2. Passer `EXPO_PUBLIC_USE_MOCKS=false`.
3. Redémarrer Metro (`npx expo start -c`).

La fabrique `src/services/factory.ts` sélectionne alors :

| Singleton exporté | Mode mock (défaut) | Mode réel |
|---|---|---|
| `authService` | `MockAuthService` | `SupabaseAuthService` (implémenté) |
| `memberRepository` | `MockMemberRepository` | `SupabaseMemberRepository` (squelette) |
| `publicContentService` | `MockPublicContentService` | `SupabasePublicContentService` (squelette) |
| `candidateApi` | `MockCandidateApi` | `HttpCandidateApi` (squelette) |

Pour revenir en démonstration : `EXPO_PUBLIC_USE_MOCKS=true` (ou supprimer la
variable). Toute valeur autre que `false` conserve les mocks.

---

## 3) Fichiers de la couche réelle (étape 17)

| Fichier | Contenu |
|---|---|
| `src/services/factory.ts` | Fabrique : singletons + lecture de `EXPO_PUBLIC_USE_MOCKS` |
| `src/services/supabase/client.ts` | `createClient(URL, anonKey)` **paresseux** + session persistée par `expo-secure-store` |
| `src/services/supabase/SupabaseAuthService.ts` | `AuthService` réel (signInWithPassword / signOut / resetPasswordForEmail / updateUser / getSession / onAuthStateChange) |
| `src/services/supabase/SupabaseMemberRepository.ts` | `MemberRepository` — **squelette** (renvoie un refus « non branché ») |
| `src/services/supabase/SupabasePublicContentService.ts` | `PublicContentService` — **squelette** |
| `src/services/http/HttpCandidateApi.ts` | `CandidateApi` — **squelette** (API Express, `EXPO_PUBLIC_API_BASE_URL`) |
| `src/services/nonImplemente.ts` | Refus serveur standard des squelettes |

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

---

## 6) Ce qui reste à écrire (prochaines étapes)

1. `SupabaseMemberRepository` : requêtes réelles (`utilisateur`, `membre`,
   `membre_categorie`, `oeuvre`, `attestation_diffusion`, `cotisation`,
   `paiement`, `notification`) + Storage (`upload`, progression, URL signées
   pour `obtenirUrlFichier`).
2. `SupabasePublicContentService` : lecture de `documentation`, `categorie`,
   `tarif`, `operateur_mobile_money` (avec `actif = true`).
3. `HttpCandidateApi` : appels REST réels (`docs/API_CANDIDAT.md`).
4. Branchement effectif des écrans/contextes sur `src/services/factory.ts`
   (aujourd'hui ils consomment encore le barrel `src/services/mocks`, dont le
   comportement est identique en mode mock).

---

## 7) Dépannage

| Symptôme | Cause probable |
|---|---|
| Bannière « Service réel pas encore branché… » | `EXPO_PUBLIC_USE_MOCKS=false` alors que les squelettes ne sont pas encore implémentés |
| « Supabase n'est pas configuré… » | `EXPO_PUBLIC_SUPABASE_URL` ou `EXPO_PUBLIC_SUPABASE_ANON_KEY` vide |
| Les variables ne sont pas prises en compte | Metro n'a pas été redémarré (`npx expo start -c`) |

