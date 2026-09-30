# Données de test — mode mock

- Source unique : `src/services/mocks/donneesTestMock.ts` (fixtures fixes, réalistes, reproductibles).
- Activation : `EXPO_PUBLIC_USE_MOCKS=true` (voir `.env.example`).
- Vérification automatisée : `npx --yes tsx tools/verif-mocks.ts` → `TOUS LES CONTROLES SONT PASSES` (111 contrôles sur les 4 mocks).

Aucun montant / catégorie / opérateur n'est codé en dur dans l'UI : tout vient d'un service (mock aujourd'hui, serveur demain).

## Dossiers d'adhésion (suivi + paiement)

Le numéro **et** le code de suivi doivent correspondre.

| Numéro | Code de suivi | Statut | Catégorie | Cas couvert |
| --- | --- | --- | --- | --- |
| OMDA-2026-000001 | K7X4-9B2Q | VALIDEE | Artiste-auteur | Paiement d'adhésion possible |
| OMDA-2026-000002 | M3P8-7T2W | EN_COURS_DE_VERIFICATION | Écrivain | Dossier en examen |
| OMDA-2026-000003 | R9F2-4H6K | REJETEE | Musicien | Motif obligatoire (CIN illisible) |
| OMDA-2026-000004 | D5N7-1Q8Z | ADHESION_TERMINEE | Artiste-auteur | Déjà payée (PAI-2026-000701) |
| OMDA-2026-000005 | B2V6-3L9X | ENVOYEE | Écrivain | En attente de vérification |
| OMDA-2026-000006 | T4C1-8M5J | BROUILLON | Musicien | Brouillon modifiable |
| OMDA-2026-000007 | P6L3-2S7D | BROUILLON | Artiste-auteur | Mineur (17 ans) : autorisation parentale |
| OMDA-2026-000008 | V4J9-6W3N | VALIDEE | Musicien | Tarif catégorie (120 000 Ar) |

Rappels : à l'envoi, « Délai indicatif : 72 heures » + « Aucun paiement n'est demandé pour le moment » ; seuls les dossiers `VALIDEE` peuvent initier un paiement ; `REJETEE` porte toujours un motif non vide.

## Comptes espace membre (mot de passe commun : `Omda2026!`)

| E-mail | Comportement attendu |
| --- | --- |
| `membre@omda.mg` | Compte complet : 3 œuvres, cotisation 2026 NON_PAYEE, 2 notifications non lues |
| `premiere.connexion@omda.mg` | `doit_changer_mot_de_passe = true` (changement obligatoire) |
| `vide@omda.mg` | États vides (0 œuvre, 0 cotisation, 0 notification non lue) |
| `desactive@omda.mg` | Connexion refusée → `COMPTE_DESACTIVE` |
| `bloque@omda.mg` | Après 3 échecs → `TROP_DE_TENTATIVES` (4ᵉ tentative, même juste) |

Données de `membre@omda.mg` : n° d'adhérent `OMDA-2026-A-000123`, catégorie Artiste-auteur ; œuvres « La varangue » (`VALIDEE` → `DEPOT_FINALISE` après paiement), « Le chant des rizières » (`EN_COURS_DE_VALIDATION`), « Récit sans titre » (`REJETEE`, motif non vide) ; cotisations 2026 = 100 000 Ar `NON_PAYEE`, 2025 = `PAYEE`.

## Numéros de test Mobile Money

| Numéro | Statut final simulé | Libellé |
| --- | --- | --- |
| +261340000001 | `REUSSI` | Paiement confirmé (cas nominal) |
| +261340000002 | `ECHEC_SOLDE_INSUFFISANT` | Solde insuffisant |
| +261340000003 | `ECHEC_AUTRE` | Échec technique de l'opérateur |
| +261340000004 | `REJETE` | Annulé par le titulaire |

Tout autre numéro `+261…` → `REUSSI`. **Seul opérateur : MVola** (unique du schéma, non sélectionnable dans l'UI) ; liste dynamique : s'il est désactivé côté « serveur » (`definirOperateurActif('MVOLA', false)`), la liste devient vide et aucun paiement n'est proposé.

## Tarifs (Ariary, dynamiques via `estimerMontant`)

| Opération | Montant |
| --- | --- |
| ADHESION (par défaut) | 150 000 Ar |
| ADHESION — catégorie Musicien | 120 000 Ar |
| DEPOT_OEUVRE | 50 000 Ar |
| COTISATION | 100 000 Ar |

Toute estimation est affichée avec la mention : « Estimation — le montant final est confirmé par le serveur. »

## Autres référentiels

- Catégories actives : Artiste-auteur, Écrivain, Musicien ; Arts numériques est désactivée (jamais listée).
- Articles publiés : `devenir-membre`, `documents-a-fournir`, `vos-droits-d-auteur` ; `article-en-preparation` n'est jamais listé et renvoie `ARTICLE_INTROUVABLE`.

## Codes d'erreur propres aux mocks (`CODES_MOCK`)

`DEMANDE_NON_MODIFIABLE`, `PAIEMENT_INTROUVABLE`, `MODE_PAIEMENT_INVALIDE`, `NOTIFICATION_INTROUVABLE`, `NUMERO_TELEPHONE_INVALIDE`, `OEUVRE_NON_MODIFIABLE`, `PAIEMENT_DEJA_REUSSI`, `ARTICLE_INTROUVABLE`, `TARIF_INDISPONIBLE`, `TELEVERSEMENT_ANNULE`.

Ils sont à reprendre tels quels côté serveur au branchement (les codes métier déjà contractés figurent dans `docs/API_CANDIDAT.md`).

## Options de debug (`src/services/mocks/configMock.ts`)

| Fonction | Effet |
| --- | --- |
| `definirDelaisMock(min, max?)` | Délai réseau simulé (défaut 250–900 ms) |
| `forcerErreurReseau(bool)` | Chaque appel échoue (écran Erreur + « Réessayer ») |
| `forcerErreurServeur(bool)` | Chaque appel → 503 |
| `definirProbabilitesErreur({ reseau?, serveur? })` | Pannes aléatoires (probabilité 0 → 1) |
| `definirOperateurActif(code, bool)` | Liste d'opérateurs dynamique (côté « serveur ») |
| `reinitialiserOptionsMock()` | Retour aux réglages par défaut |

Défauts : `polls_avant_statut_final = 2` (poll 1 → `EN_ATTENTE_CONFIRMATION`, poll 2 → statut final), aucune panne.

## Règles non configurables

- `REUSSI` uniquement par confirmation « serveur » (machine à états) — jamais par une action locale de l'app.
- `TENTATIVES_MAX = 3` échecs de connexion consécutifs avant `TROP_DE_TENTATIVES`.
- Le compteur d'échecs porte sur l'e-mail : il est remis à zéro à chaque connexion réussie.

## Scénarios couverts par le smoke test

`npx --yes tsx tools/verif-mocks.ts` exécute 111 contrôles : contenus publics (listes dynamiques, tarifs, estimation), suivi des dossiers (numéro + code, timeline, rejet motivé), création/brouillon (âge, autorisation parentale, 2 œuvres minimum), paiement Mobile Money MVola (machine à états + numéros ci-dessus : succès, solde insuffisant, échec autre, rejet, délai dépassé), pannes et délais (`configMock`), puis l'espace membre (connexion, profil, tableau de bord, œuvres, cotisation → `PAYEE` + notification, notifications lues, états vides, comptes désactivé et bloqué, mot de passe oublié non révélateur, déconnexion) et les catégories multiples (règle métier 9 : 1 appartenance ACTIVE au départ, demande de catégorie supplémentaire créée `EN_ATTENTE` sans activation locale, refus `CATEGORIE_DEJA_DEMANDEE` / `CATEGORIE_DEJA_ENREGISTREE` / `CATEGORIE_INDISPONIBLE`, profil final avec 2 catégories dont 1 en attente).

