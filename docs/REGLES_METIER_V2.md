# Règles métier v2 : application mobile OMDA

Ce document regroupe les règles fonctionnelles et exigences à prendre en compte dans l'application mobile OMDA. En cas de contradiction avec les autres fichiers de `docs/`, **ce document prime** ; une fois une règle intégrée dans les docs concernés, ceux-ci font foi.

Ces règles ne sont pas encore toutes implémentées. Le développement doit examiner les fonctionnalités existantes, déterminer les modifications nécessaires et les intégrer progressivement, sans compromettre les fonctionnalités déjà opérationnelles.

---

## 1. Catégories d'auteurs et frais applicables

### 1.1. Catégories d'auteurs

L'OMDA comporte cinq catégories d'auteurs. L'ordre suivant doit être strictement respecté dans toute l'application :

1. Musique
2. Littéraire
3. Dramatique
4. Audiovisuel
5. Figuratif

### 1.2. Frais de déclaration des œuvres

- Musique : 1 000 Ar par titre.
- Littéraire :
  - Livre : 1 000 Ar par titre.
  - Poème : 500 Ar par titre.
- Dramatique : 1 000 Ar par titre.
- Audiovisuel : 1 000 Ar par titre.
- Figuratif : 500 Ar par titre.

### 1.3. Frais d'adhésion

- Nouvel adhérent : 20 000 Ar s'il n'est pas encore membre de l'OMDA.
- Membre existant : 10 000 Ar s'il souhaite adhérer à une nouvelle catégorie.

**Règle d'implémentation :** ces montants sont stockés en base et lus par l'application. Ils ne sont jamais codés en dur dans les écrans.

---

## 2. Informations à exclure du parcours utilisateur

Le champ « Lieu de réception du droit », présent dans les fiches d'adhésion, est **complètement exclu** de l'application mobile. Cette information sera renseignée ultérieurement par un agent dans le back-office de l'OMDA. Elle ne doit apparaître dans aucun formulaire destiné aux auteurs.

---

## 3. Auteurs individuels et œuvres collectives

### 3.1. Signification des termes ACR et Collective

- **ACR** : l'œuvre a été créée par un seul auteur (œuvre individuelle).
- **Collective** : l'œuvre a été créée par plusieurs auteurs, par exemple les membres d'un groupe musical.

### 3.2. Parcours candidat

Lorsqu'un candidat remplit son formulaire d'adhésion, il doit obligatoirement renseigner le nom du groupe auquel il appartient. S'il n'appartient à aucun groupe, il peut simplement renseigner son pseudonyme (nom d'artiste) dans ce champ.

### 3.3. Parcours membre

Lorsqu'un membre déclare une œuvre réalisée en collaboration avec d'autres auteurs, il doit pouvoir renseigner :

- le nom du ou des groupes avec lesquels il a collaboré, le cas échéant ;
- le ou les pseudonymes des autres auteurs ayant participé à la création de l'œuvre.

Cette possibilité est prévue même si le membre ne fait partie d'aucun groupe.

---

## 4. Formulaire d'identité du candidat : ancien chef-lieu de province

À la première étape du parcours candidat, le formulaire d'identité comporte un champ permettant de sélectionner l'**ancien chef-lieu de province** de l'auteur. Ce champ est placé juste après celui de l'adresse.

La liste des anciens chefs-lieux est saisie directement dans l'application (donnée de référence stockée en base) et proposée à l'auteur. Liste proposée, d'après les six anciennes provinces, **à valider** : Antananarivo, Antsiranana, Fianarantsoa, Mahajanga, Toamasina, Toliara.

---

## 5. Vérification finale de l'identité par selfie avec CIN

La vérification par selfie intervient à la **toute dernière étape** du parcours candidat, juste avant l'envoi de la demande d'adhésion. Elle n'est effectuée qu'après que l'auteur a rempli tous les formulaires et fourni l'ensemble des documents obligatoires.

À cette étape, l'auteur prend ou importe un selfie sur lequel il apparaît en tenant sa carte d'identité nationale (CIN).

**Objectif :** confirmer que la personne qui soumet la demande est bien celle qui a rempli les formulaires et fourni les documents.

**Règle impérative :** le bouton « Envoyer ma demande » n'est accessible qu'après la réalisation de cette vérification. Sans selfie, l'auteur ne peut pas soumettre sa demande d'adhésion. Ce contrôle est aussi appliqué côté serveur.

Précisions d'implémentation retenues :

- L'étape de vérification est verrouillée tant que les formulaires ne sont pas complets et que les pièces obligatoires ne sont pas toutes importées. Elle affiche alors ce qui manque.
- Le selfie se prend à la caméra ou s'importe depuis la galerie.
- L'application ne fait aucune reconnaissance faciale : le selfie est examiné par un agent au back-office, et l'écran le précise.
- Si le candidat modifie un formulaire ou une pièce après son selfie, le selfie doit être refait et le bouton d'envoi redevient inaccessible.
- Contrôles locaux : image suffisamment grande pour être lisible, et fichier différent de celui des autres pièces.

---

## 6. Gestion et traitement des fichiers importés

### 6.1. Renommage automatique des fichiers

L'application renomme automatiquement les fichiers importés en fonction de leur nature.

- CIN : nom du fichier correspondant au document CIN.
- Certificat de résidence : nom correspondant au certificat de résidence.
- Autres pièces justificatives : nom explicite correspondant à leur type.

Pour les fichiers des œuvres, le nom contient :

- le titre de l'œuvre ;
- le pseudonyme de son auteur.

L'attestation de diffusion associée à chaque œuvre est également renommée automatiquement en précisant qu'il s'agit de l'attestation de diffusion de l'œuvre concernée.

### 6.2. Compression et conversion des images

Toutes les images importées sont automatiquement traitées avant leur envoi vers le serveur :

- compression pour réduire leur taille ;
- conservation d'une qualité suffisante pour garantir leur lisibilité ;
- conversion automatique au format JPG ou PNG.

L'objectif est de permettre aux agents de l'OMDA de consulter et d'examiner facilement les documents depuis le back-office.

---

## 7. Attestations de diffusion

L'attestation de diffusion est **obligatoire pour chaque œuvre** présentée dans le cadre d'une nouvelle demande d'adhésion à une catégorie. Cette obligation s'applique :

- aux auteurs qui ne sont pas encore membres de l'OMDA ;
- aux membres qui souhaitent adhérer à une autre catégorie que celle dans laquelle ils sont déjà inscrits.

En revanche, lorsqu'un auteur est déjà membre dans une catégorie et souhaite y déclarer de nouvelles œuvres, l'attestation de diffusion devient **facultative**.

Dans tous les cas, le **bulletin de déclaration d'œuvre reste obligatoire**.

---

## 8. Documents supplémentaires obligatoires selon la catégorie

### 8.1. Catégorie Musique

Pour chaque œuvre musicale déclarée, l'auteur fournit obligatoirement :

- le fichier audio de l'œuvre au format MP3 ;
- un fichier PDF contenant les paroles de la musique.

Ces deux fichiers sont obligatoires pour soumettre la déclaration.

### 8.2. Catégorie Audiovisuel

Lorsqu'un auteur déclare un film, il fournit obligatoirement un fichier PDF contenant le résumé du film. Cette exigence concerne uniquement les œuvres audiovisuelles de type film, c'est-à-dire une œuvre cinématographique (« movie » en anglais).

---

## 9. Vérification avant l'envoi d'une déclaration d'œuvre (espace membre)

Dans l'espace membre, lorsqu'un auteur souhaite déclarer ou déposer une œuvre, l'application met en place une vérification avant l'envoi.

> **Décision officielle :** la vérification par code SMS est **abandonnée**. Elle est remplacée par la **ressaisie du mot de passe actuel du compte** avant l'envoi d'une déclaration d'œuvre, pour confirmer l'identité de l'auteur et autoriser la soumission.

Fonctionnement :

1. Le membre remplit le formulaire de déclaration de son œuvre et importe les fichiers nécessaires.
2. Avant l'envoi, il saisit son mot de passe.
3. Le serveur vérifie le mot de passe, sans modifier la session en cours, et limite les échecs (5 essais, puis blocage temporaire).
4. Si le mot de passe est correct, le serveur crée une autorisation de soumission à usage unique, liée au membre et à ce brouillon, valable 10 minutes.
5. Le membre peut alors envoyer sa déclaration.

**Règle impérative :** sans autorisation valide (absente, expirée, déjà utilisée ou liée à un autre brouillon), le membre ne peut pas soumettre sa déclaration. Celle-ci reste à l'état « Brouillon ». Le contrôle est appliqué côté serveur. Le mot de passe n'est jamais journalisé.

---

## 10. Consignes générales d'implémentation

- Examiner les fonctionnalités et la structure actuelles du projet avant toute modification.
- Étudier les fiches d'adhésion et les bulletins de déclaration d'œuvre (`docs/formulaires/`).
- Déterminer la meilleure manière d'intégrer les formulaires et exigences dans l'application.
- Adapter la base de données Supabase lorsque cela est nécessaire.
- Assurer la cohérence entre les interfaces mobiles, les services backend et la base de données.
- Éviter toute simulation présentée comme une fonctionnalité réellement opérationnelle.
- Tester chaque modification avant de passer à l'étape suivante.
- Mettre à jour les fichiers de documentation concernés dans `docs/`.
- Si une information technique ou fonctionnelle manque, la signaler plutôt que d'inventer une règle ou de prendre une décision susceptible de compromettre l'application.

---

## 11. Ordre obligatoire d'importation des documents (parcours candidat)

**Tous les documents à importer dans le parcours candidat sont obligatoires.**

L'interface d'importation respecte l'ordre suivant :

1. **Œuvres et documents associés**, regroupés par œuvre pour éviter toute confusion entre les œuvres et leurs pièces :
   - le fichier de chaque œuvre ;
   - l'attestation de diffusion correspondante ;
   - le bulletin de déclaration d'œuvre correspondant (rempli dans l'application, avec son état « à compléter » ou « complété »).
2. **Photo de l'auteur** : photo claire et récente.
3. **Photocopie de la CIN** : copie légalisée de la carte d'identité nationale.
4. **Acte de naissance.**
5. **Certificat de résidence.**

Le selfie avec CIN (section 5) n'est pas un document de cette liste : c'est l'étape finale et distincte qui suit.

---

## 12. Moyens de paiement

Les membres choisissent leur opérateur mobile parmi : **MVola, Orange Money, Airtel Money**. Les opérateurs sont servis par la base (table `operateur_mobile_money`), jamais codés en dur. Cette règle remplace l'ancienne règle « MVola seul ».

L'intégration des paiements réels est **hors périmètre pour le moment** et sera traitée à la fin.

---

## 13. Pseudonyme

Toute personne qui adhère à une catégorie, qu'elle soit déjà membre ou non, renseigne obligatoirement son pseudonyme (nom d'artiste). Un membre qui adhère à une autre catégorie peut conserver le même pseudonyme. Plusieurs auteurs peuvent utiliser le même pseudonyme : **aucune unicité n'est exigée**.

---

## 14. Numéro OMDA et compte utilisateur

Lorsque la demande d'adhésion d'un auteur à une catégorie est validée, un **numéro OMDA** lui est attribué **pour cette catégorie**. Un auteur déjà membre qui adhère à une autre catégorie reçoit un nouveau numéro OMDA, distinct de ceux de ses autres catégories.

Même s'il est membre de plusieurs catégories avec un numéro propre à chacune, l'auteur conserve **un seul compte utilisateur** dans l'application. Il n'a pas à créer de compte distinct par catégorie.

Le numéro OMDA est attribué uniquement côté serveur, jamais généré par l'application.

---

## 15. Fiches d'adhésion et bulletins de déclaration d'œuvre

Les fiches d'adhésion et les bulletins de toutes les catégories sont disponibles dans `docs/formulaires/`. Ils sont intégrés sous forme de **formulaires natifs** remplis directement dans l'application, et non par téléchargement puis téléversement d'un modèle.

- Les données sont enregistrées de façon structurée dans Supabase.
- Un PDF récapitulatif est généré et archivé dans le stockage pour consultation par l'agent.
- La signature manuscrite n'est pas gérée : elle est remplacée par une déclaration sur l'honneur cochée et la mention saisie. La signature papier auprès d'une agence de l'OMDA n'est **plus exigée** : aucune étape de signature papier n'est imposée à l'auteur dans le parcours d'adhésion.
- Les cadres « réservés à l'OMDA » (numéro OMDA, date d'adhésion, numéro de l'œuvre) sont attribués côté serveur et jamais saisis par l'auteur.

**Fiche d'adhésion** (identique pour les catégories fournies, seul le titre change) : catégorie (automatique), nom, prénoms, pseudonyme, groupe, date et lieu de naissance, CIN avec lieu et date de délivrance, profession, adresse, ancien chef-lieu de province, téléphone, e-mail, personne à prévenir, compte bancaire (**facultatif**, il ne bloque pas la soumission), territoire géré par l'OMDA (**valeur fixe « Madagascar et le monde entier »**, renseignée automatiquement, non modifiable par l'auteur) ; engagement et cession de droits (texte en malgache affiché tel quel) avec acceptation, mention « voavaky sy ankatoavina » saisie, lieu et date ; liste des œuvres reprise des œuvres déjà saisies. Le « lieu de réception du droit » est exclu (section 2). Le compte bancaire est une donnée sensible : accès strictement limité, jamais journalisé.

**Bulletin de déclaration d'œuvre** : cinq variantes (littéraire, dramatique, musicale ACR, musicale collective, audiovisuelle). Champs communs : titre, genre, durée en minutes, ayants droit (rôle, nom et prénoms, numéro OMDA), édition (contrat du, valable jusqu'au, territoire), lieu, date, déclaration sur l'honneur. Variante musicale : rôles parolier, compositeur, arrangeur, éditeur (ACR : un seul auteur ; collective : plusieurs auteurs). Les libellés « Parolier » et « Parole ou partition » des bulletins **littéraire et dramatique** sont intentionnels : ils sont conservés tels quels. Variante audiovisuelle : producteur, date de première diffusion, genre (fiction, comédie musicale, dessins animés, animation, autres avec précision), fonctions scénario/dialogues, réalisation, musique.

**Catégorie Figuratif :** la fiche d'adhésion et le bulletin de déclaration ne sont pas encore disponibles. Leur intégration est à prévoir dès qu'ils seront fournis. D'ici là, le formulaire d'adhésion commun et un bulletin minimal provisoire (champs communs uniquement) sont utilisés, marqués « à confirmer », sans champ inventé.

---

## 16. Notifications

Le système de notifications n'est pas encore opérationnel. Il couvre les notifications liées aux actions de l'utilisateur et aux événements (validation d'une demande d'adhésion avec numéro OMDA, validation ou rejet d'un dépôt d'œuvre, demande, annulation ou validation d'une catégorie supplémentaire, confirmation d'un paiement, annonces globales).

- Les notifications sont écrites **uniquement côté serveur** à chaque événement métier. L'application n'en fabrique jamais.
- Un seul message par événement, sans doublon.
- Le candidat n'a pas de compte : il n'a pas de boîte de notifications et suit son dossier dans l'écran de suivi.
- Les notifications intégrées à l'application passent avant les notifications push. Le push (téléphone) est **reporté**, hors périmètre de cette semaine.
- Le type « paiement confirmé » est préparé, mais branché seulement avec les paiements.

---

## 17. Périmètre et délai

- **Délai :** toutes les fonctionnalités de l'application doivent être développées, intégrées et vérifiées d'ici la fin de la semaine du 3 novembre 2026.
- **Hors périmètre :** les paiements réels (traités ultérieurement) et les notifications push.
- **Priorités :** parcours candidat réel sur Supabase, puis parcours membre, puis notifications dans l'application.
- Aucun parcours n'est considéré comme terminé sans vérification effective de son fonctionnement.

---

## 18. Points restants et décisions confirmées

### Points restants

- **Figuratif :** fiche d'adhésion, bulletin de déclaration et pièces à fournir, à intégrer dès réception (section 15).
- **Anciens chefs-lieux de province :** valider la liste proposée en section 4.

### Décisions confirmées (anciens points à confirmer)

- Compte bancaire : facultatif, ne bloque pas la soumission.
- Territoire : valeur fixe « Madagascar et le monde entier », automatique et non modifiable.
- Signature papier en agence : plus exigée.
- Vérification par SMS : abandonnée, remplacée par la ressaisie du mot de passe (section 9).
- Vocabulaire « Parolier » et « Parole ou partition » (Littéraire, Dramatique) : intentionnel, conservé tel quel.
- « Film » (Audiovisuel) : œuvre cinématographique (section 8.2).

## 19. Exclusions (décision de l'étape 28C)

Les éléments suivants sont **totalement exclus** de l'application mobile : aucune fonctionnalité, aucun formulaire, aucune interface et aucun texte ne s'y rapporte.

- **Cotisation annuelle** : la table `cotisation`, l'écran `cotisation`, l'onglet « Cotisation », le bloc cotisation du tableau de bord, les méthodes `listerCotisations` / `obtenirCotisation`, le type `StatutCotisation`, la valeur `COTISATION` des enums de paiement et de tarif, et toute mention de « cotisation » dans les écrans, contrats, mocks et documentation sont supprimés.
- **Virement bancaire** : aucun mode ni écran de virement bancaire n'existe ; le seul mode de paiement est Mobile Money (3 opérateurs servis par `operateur_mobile_money`), et les paiements réels restent hors périmètre.

### Ce qui reste (non concerné par l'exclusion)

- Le champ « compte bancaire » facultatif de la fiche d'adhésion (donnée sensible, RLS stricte, jamais journalisé) est conservé : il n'a aucun lien avec la cotisation.
- Les frais d'adhésion et les frais de déclaration d'œuvre restent gérés par la table `tarif` et l'écran de paiement (dépôt d'œuvre).
- Les paiements Mobile Money (étape paiements à venir) restent ; seule la partie « cotisation » des écrans de paiement disparaît.
