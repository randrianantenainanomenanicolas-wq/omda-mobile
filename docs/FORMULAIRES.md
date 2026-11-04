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
