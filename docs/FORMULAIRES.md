# OMDA Mobile — Inventaire des formulaires (fiche d'adhésion + bulletins de déclaration)

> **Source des champs** : transcriptions texte des 9 PDF dans `docs/formulaires/` (`.txt`), lues champ par champ, croisées avec `docs/REGLES_METIER_V2.md` (qui prime en cas de contradiction).
> **Note importante** : les PDF eux-mêmes n'ont pas pu être lus textuellement (contenu binaire). L'inventaire ci-dessous est inféré des 9 fichiers `.txt` de transcription.

## 1. Fiche d'adhésion (commune à toutes les catégories)

Champs présents dans les 4 fiches (musique, littéraire, dramatique, audiovisuel) :

| Champ formulaire (.txt) | Libellé français | Type | Obligatoire | Règle métier | Notes |
|-------------------------|------------------|------|-------------|--------------|-------|
| ANARANA | Nom | texte | Oui | — | Nom civil |
| FANAMPINY | Prénoms | texte | Oui | — | |
| SOLON'ANARANA | Pseudonyme | texte | Oui | Règle 4 | Obligatoire, aucune unicité, conservable entre catégories |
| TARIKA | Groupe | texte | Oui | Règle 3 | Le pseudonyme peut le remplacer si aucun groupe |
| TERAKA TAMIN'NY | Né(e) le (lieu) à (date) | date + lieu | Oui | Règle 3 | Lieu de naissance + date de naissance (champ combiné dans le PDF) |
| KARA-PANONDROM-PIRENENA | N° CIN | texte | Oui | Règle 3 | Numéro de la carte d'identité nationale |
| NATAO TAO | Fait à (lieu) le (date) | texte + date | Oui | Règle 3 | Lieu de délivrance CIN + date de délivrance CIN (champ combiné dans le PDF) |
| ASA ATAO | Profession | texte | Oui | Règle 3 | |
| FONENANA | Adresse | texte | Oui | Règle 3 | Libellé PDF : « FONENANA : Adresse » |
| TEL | Téléphone | texte | Non | — | Présent dans le PDF (champ vide à remplir) |
| E MAIL | E-mail | texte | Non | — | Présent dans le PDF (champ vide à remplir) |
| OLONA AFAKA IFANDRAISANA RAHA MISY LANA AZY | Personne à prévenir (nom + contact) | texte | Oui | Règle 3 | |
| KAONTY AMIN'NY BANKY | Compte bancaire | texte | Non (facultatif) | Règle 3 | Jamais bloquant. Donnée sensible : RLS stricte, jamais journalisé |
| TOERANA HANDRAISANA NY ZON' NY MPAMORONA | Lieu de réception du droit d'auteur | — | Exclu | Règle 3 | Complètement exclu de l'app ; renseigné par un agent ultérieurement |
| FIRENENA HIANDREKETAN'NY OMDA | Territoire géré par l'OMDA | valeur fixe | Oui (automatique) | Règle 3 | « Madagascar et le monde entier », non modifiable |
| — | Déclaration sur l'honneur | case cochée | Oui | Règle 3 | Ni signature manuscrite ni signature papier en agence |
| — | Mention « voavaky sy ankatoavina » | texte saisi | Oui | Règle 3 | Saisie par l'auteur (voir fichier de référence §5) |

**Cadre réservé OMDA (côté serveur, jamais saisi)** : N°OMDA, Date d'adhésion (présents en en-tête de chaque fiche).

**Variantes par catégorie (en-tête de fiche)** : Musique = SOKAJY HIRA ; Littéraire = SOKAJY LITERATIORA ; Dramatique = SOKAJY TANTARA ; Audiovisuel = SOKAJY SARIMIHETSIKA.

**Page 3 de chaque fiche (œuvres déjà déclarées)** : tableau « Titre de l'œuvre / Genre / Durée / Auteur » (+ « Compositeur » pour musique uniquement ; + « ADAPTATION / DIALOGUES / REALISATION / MUSIQUES » pour audiovisuel). Pré-rempli côté serveur à partir des œuvres déclarées ; l'auteur ne le modifie pas.

**PDF de référence** : `docs/formulaires/fiche-adhesion-musique.txt`, `fiche-adhesion-litteraire.txt`, `fiche-adhesion-dramatique.txt`, `fiche-adhesion-audiovisuel.txt`.

## 2. Bulletin de déclaration d'œuvre — Littéraire

| Champ | Type | Obligatoire | Règle métier | Notes |
|-------|------|-------------|--------------|-------|
| Titre | texte | Oui | Règle 3 | |
| Genre | texte | Oui | — | |
| Durée (minutes) | nombre | Oui | — | |
| Ayants droit | liste (rôle, nom, prénoms, n° OMDA) | Oui | — | |
| A Parolier (Mpamorona ny tonony) | texte | Oui | Règle 3 | Libellé conservé tel quel |
| E Editeur (Mpanonta) | texte | Non | — | Rôle éditeur présent dans le PDF |
| SA Sous-parolier | texte | Non | — | Rôle présent dans le PDF |
| SR Sous-arrangeur | texte | Non | — | Rôle présent dans le PDF |
| SE Sous-éditeur | texte | Non | — | Rôle présent dans le PDF |
| Édition (contrat du, valable jusqu'au, territoire) | texte/date | Oui | — | |
| Lieu | texte | Oui | — | |
| Date | date | Oui | — | |
| Déclaration sur l'honneur | case cochée | Oui | Règle 3 | |
| Pièce jointe | Parole ou partition de l'œuvre | Oui | Règle 3 | Libellé conservé tel quel |
| Type d'œuvre | Livre / Poème | Oui | Conception SQL | `litteraire_type` : `LIVRE` / `POEME` |

**PDF de référence** : `docs/formulaires/bulletin-litteraire.txt`

## 3. Bulletin de déclaration d'œuvre — Dramatique

| Champ | Type | Obligatoire | Règle métier | Notes |
|-------|------|-------------|--------------|-------|
| Titre | texte | Oui | Règle 3 | |
| Genre | texte | Oui | — | |
| Durée (minutes) | nombre | Oui | — | |
| Ayants droit | liste (rôle, nom, prénoms, n° OMDA) | Oui | — | |
| A Parolier (Mpamorona ny tonony) | texte | Oui | Règle 3 | Libellé conservé tel quel |
| E Editeur (Mpanonta) | texte | Non | — | Rôle éditeur présent dans le PDF |
| SA Sous-parolier | texte | Non | — | Rôle présent dans le PDF |
| SR Sous-arrangeur | texte | Non | — | Rôle présent dans le PDF |
| SE Sous-éditeur | texte | Non | — | Rôle présent dans le PDF |
| Édition (contrat du, valable jusqu'au, territoire) | texte/date | Oui | — | |
| Lieu | texte | Oui | — | |
| Date | date | Oui | — | |
| Déclaration sur l'honneur | case cochée | Oui | Règle 3 | |
| Pièce jointe | Parole ou partition de l'œuvre | Oui | Règle 3 | Libellé conservé tel quel |

**PDF de référence** : `docs/formulaires/bulletin-dramatique.txt`

## 4. Bulletin de déclaration d'œuvre — Musicale ACR (un seul auteur)

| Champ | Type | Obligatoire | Règle métier | Notes |
|-------|------|-------------|--------------|-------|
| Titre | texte | Oui | Règle 3 | |
| Genre | texte | Oui | — | |
| Durée (minutes) | nombre | Oui | — | |
| Ayants droit | liste (rôle, nom, prénoms, n° OMDA) | Oui | — | |
| A Parolier (Mpamorona ny tonony) | texte | Oui | Règle 3 | Libellé conservé tel quel |
| C Compositeur (Mpamorona ny feony) | texte | Oui | Règle 3 | Rôle compositeur spécifique musique |
| AR Arrangeur (Mpandrindra) | texte | Non | — | Rôle arrangeur spécifique musique ACR |
| E Editeur (Mpanonta) | texte | Non | — | Rôle éditeur présent dans le PDF |
| SA Sous-parolier | texte | Non | — | Rôle présent dans le PDF |
| SR Sous-arrangeur | texte | Non | — | Rôle présent dans le PDF |
| SE Sous-éditeur | texte | Non | — | Rôle présent dans le PDF |
| Édition (contrat du, valable jusqu'au, territoire) | texte/date | Oui | — | |
| Lieu | texte | Oui | — | |
| Date | date | Oui | — | |
| Déclaration sur l'honneur | case cochée | Oui | Règle 3 | |
| Pièce jointe | Parole ou partition de l'œuvre | Oui | Règle 3 | Libellé conservé tel quel |

**PDF de référence** : `docs/formulaires/bulletin-musical-acr.txt`

## 5. Bulletin de déclaration d'œuvre — Musicale collective (plusieurs auteurs)

| Champ | Type | Obligatoire | Règle métier | Notes |
|-------|------|-------------|--------------|-------|
| Titre | texte | Oui | Règle 3 | |
| Genre | texte | Oui | — | |
| Durée (minutes) | nombre | Oui | — | |
| Ayants droit | liste (rôle, nom, prénoms, n° OMDA) | Oui | — | |
| A Parolier (Mpamorona ny tonony) | texte | Oui | Règle 3 | Libellé conservé tel quel |
| C Compositeur (Mpamorona ny feony) | texte | Oui | Règle 3 | Rôle compositeur spécifique musique |
| E Editeur (Mpanonta) | texte | Non | — | Rôle éditeur présent dans le PDF |
| SA Sous-parolier | texte | Non | — | Rôle présent dans le PDF |
| SR Sous-arrangeur | texte | Non | — | Rôle présent dans le PDF |
| SE Sous-éditeur | texte | Non | — | Rôle présent dans le PDF |
| Édition (contrat du, valable jusqu'au, territoire) | texte/date | Oui | — | |
| Lieu | texte | Oui | — | |
| Date | date | Oui | — | |
| Déclaration sur l'honneur | case cochée | Oui | Règle 3 | |
| Pièce jointe | Parole ou partition de l'œuvre | Oui | Règle 3 | Libellé conservé tel quel |

> **Note** : le rôle « Arrangeur (AR) » n'est pas présent dans le bulletin musical collectif (contrairement au bulletin ACR qui le contient). Aucun champ n'est inventé.

**PDF de référence** : `docs/formulaires/bulletin-musical-collective.txt`

## 6. Bulletin de déclaration d'œuvre — Audiovisuel

| Champ | Type | Obligatoire | Règle métier | Notes |
|-------|------|-------------|--------------|-------|
| Titre | texte | Oui | Règle 3 | |
| Producteur (mpamokatra) | texte | Oui | — | |
| Durée (faharetany) | nombre | Oui | — | |
| Date de 1ère diffusion | date | Oui | — | |
| Genre | Fiction / comédie musicale / dessins animés / animation / Autres (précisez) | Oui | — | |
| Fonctions | Scénario / Dialogues / Réalisation / Musique | Oui | — | |
| Ayants droit | liste (rôle, nom, prénoms, n° OMDA) | Oui | — | |
| Lieu | texte | Oui | — | |
| Date | date | Oui | — | |
| Déclaration sur l'honneur | case cochée | Oui | Règle 3 | |

**PDF de référence** : `docs/formulaires/bulletin-audiovisuel.txt`

## 7. Bulletin de déclaration d'œuvre — Figuratif (provisoire « à confirmer »)

| Champ | Type | Obligatoire | Règle métier | Notes |
|-------|------|-------------|--------------|-------|
| Champs communs uniquement | titre, genre, durée, ayants droit, édition, lieu, date, déclaration sur l'honneur | Oui | Règle 3 | Bulletin minimal provisoire, marqué « à confirmer » |
| Spécifiques figuratif | — | Non | Règle 3 | Aucun champ inventé. Structure prête à recevoir les vrais documents sans refonte |

**PDF de référence** : aucun disponible à ce jour. Les documents du Figuratif sont à fournir ultérieurement.

## 8. Correspondance avec les règles métier (`REGLES_METIER_V2.md`)

| Règle | Application dans les formulaires |
|-------|----------------------------------|
| Règle 1 | 5 catégories dans l'ordre : Musique, Littéraire, Dramatique, Audiovisuel, Figuratif |
| Règle 3 | Fiche d'adhésion native dans l'app ; compte bancaire facultatif ; territoire fixe ; groupe obligatoire (pseudonyme peut remplacer) ; ancien chef-lieu de province juste après l'adresse ; pas de « lieu de réception du droit » ; pas de signature papier ; mention « voavaky sy ankatoavina » |
| Règle 3 (bulletins) | Libellés « Parolier » et « Parole ou partition » conservés tels quels pour Littéraire et Dramatique |
| Règle 3 (Figuratif) | Formulaire d'adhésion commun et bulletin minimal provisoires, marqués « à confirmer » |
| Règle 4 | Pseudonyme obligatoire, aucune unicité |
| Règle 8 | Musique : MP3 + PDF de paroles obligatoires ; film : PDF de résumé obligatoire |

## 9. Fichier de référence — Texte d'engagement malgache

Le texte d'engagement malgache de la fiche d'adhésion est recopié **EXACTEMENT** depuis `docs/formulaires/fiche-adhesion-musique.txt` (lignes 60-83) dans le fichier `docs/texte-engagement-malgache.md`, sans correction, traduction ni reformulation. Les passages mal extraits (coupures de ligne, caractères suspects) sont signalés tels quels dans ce fichier.

## 10. Ordre d'importation des documents (parcours candidat)

> Règle de référence : `docs/REGLES_METIER_V2.md` §11. **Tous les documents à importer sont obligatoires.** L'écran d'importation respecte strictement l'ordre ci-dessous ; types de pièces **et** ordre proviennent d'une **source unique** (`src/models/importation.ts`, dérivée de l'ENUM `TYPES_PIECE_CANDIDAT`) consommée à la fois par l'écran Documents, l'écran Vérification d'identité, les mocks et `tools/verif-mocks.ts`. Aucun libellé, aucune icône, aucun bucket n'est codé en dur dans un écran.

| Position | Groupement | Pièce (`TypePiece`) | Libellé affiché | Bucket | Nature (renommage 29B) |
|----------|-----------|---------------------|-----------------|--------|------------------------|
| 1 | **Par œuvre** (bloc regroupé et visuellement distinct, portant le **titre de l'œuvre**) | `OEUVRE` | Fichier de l'œuvre | `oeuvres` | `OEUVRE` |
| 1 | idem | `ATTESTATION_DIFFUSION` | Attestation de diffusion | `oeuvres` | `ATTESTATION_DIFFUSION` |
| 1 | idem | `BULLETIN` | Bulletin de déclaration (rempli dans l'app) | — (formulaire natif, pas de fichier) | `BULLETIN` |
| 2 | Pièce d'identité | `PHOTO` | Photo de l'auteur (claire et récente) | `pieces` | `PHOTO` |
| 3 | Pièce d'identité | `CIN` | Photocopie de la CIN (copie légalisée) | `pieces` | `CIN` |
| 4 | Pièce d'identité | `ACTE_NAISSANCE` | Acte de naissance | `pieces` | `ACTE_NAISSANCE` |
| 5 | Pièce d'identité | `CERTIFICAT_RESIDENCE` | Certificat de résidence | `pieces` | `CERTIFICAT_RESIDENCE` |

- **Bloc « par œuvre »** : chaque œuvre forme un bloc distinct qui affiche son **titre** et regroupe ses trois éléments (fichier, attestation, bulletin) pour éviter toute confusion entre les œuvres. Le **bulletin** porte un état **« à compléter » / « complété »** et un **accès direct au formulaire** (écran `app/(adhesion)/bulletin.tsx`, §11 ci-dessous et §2→§7). Une autorisation parentale s'ajoute pour les 15–17 ans (règle 7).
- Chaque section indique son **état** : *manquant*, *envoi en cours*, *importé*, ou *erreur avec reprise* (via `UploadTile`). Les images passent par le traitement de l'**ÉTAPE 29B** (compression + renommage + contrôles de type/taille) ; PDF et MP3 ne sont pas retraités.
- Le **selfie avec CIN n'est pas** dans cette liste : c'est l'étape finale et distincte décrite en §11.

## 11. Vérification d'identité par selfie (dernière étape)

> Règle de référence : `docs/REGLES_METIER_V2.md` §5. Écran dédié `app/(adhesion)/verif-identite.tsx`, **étape distincte et toute dernière**, juste avant l'envoi.

- **Accès verrouillé** : l'écran n'est atteignable que lorsque **tous les formulaires sont complets** (identité valide, catégorie choisie, engagement accepté et saisi, **chaque bulletin complété**) **et toutes les pièces importées** (bloc œuvres complet + les 4 pièces d'identité). Sinon la vérification est **verrouillée** et affiche la **liste précise de ce qui manque**, chacun avec un **lien** vers l'écran/section concerné.
- **Prise du selfie** : le candidat prend un selfie **à la caméra** (`expo-image-picker`, caméra) **ou importe une image** depuis la galerie, **en tenant sa CIN**. La **permission caméra est demandée au bon moment** (à l'appui sur « Prendre le selfie », jamais à l'ouverture de l'écran) ; un **message clair** explique le refus et la marche à suivre. La **consigne** (« tenez votre CIN, visage et carte visibles et lisibles ») est **affichée avant la prise**.
- **Traitement** : le selfie suit l'**ÉTAPE 29B** (compression JPEG, renommage `Selfie avec CIN {nom} {prénom}`, clé de stockage sûre, contrôles type/taille).
- **Contrôles locaux** : l'image est **refusée si trop petite pour être lisible** (`verifIdentite.ts`, seuils en pixels) et si son **empreinte est identique à celle d'une autre pièce** (même fichier que la CIN, etc.).
- **Aucune reconnaissance faciale** : l'application ne compare aucun visage ; **l'agent OMDA examine la photo au back-office**, et **le texte de l'écran le dit explicitement**.
- **Verrou d'envoi** : le bouton **« Envoyer ma demande » n'est accessible qu'après un selfie importé avec succès** et encore valide. **Le contrôle est aussi appliqué côté serveur** : `soumettreDemande` refuse (`SELFIE_REQUIS`) sans selfie.
- **Réinvalidation** : si le candidat **modifie ensuite un formulaire ou une pièce**, le **selfie doit être refait** et le bouton redevient **inaccessible** (comparaison d'une **empreinte du dossier** capturée au moment du selfie, `signatureDossier`).
- **4 états** obligatoires (chargement / erreur + reprise / verrouillé-manquants / prêt) et **reprise après échec** d'envoi **sans perdre le reste** du dossier.
