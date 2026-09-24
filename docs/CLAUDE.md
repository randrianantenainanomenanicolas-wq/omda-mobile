# Règles du projet OMDA Mobile

- Projet : application mobile UNIQUEMENT. Ne jamais créer de back-office, d'écran admin ou agent.
- Stack : Expo (SDK stable actuel), React Native, TypeScript strict, Expo Router, NativeWind, @expo/vector-icons (FontAwesome).
- Toujours lire docs/CAHIER_DES_CHARGES.md, docs/SCHEMA_DB.md et docs/PROGRESS.md avant de coder.
- Langue de l'UI : français, vouvoiement. Devise : Ariary (Ar).
- Aucune couleur en hexadécimal dans les composants : utiliser uniquement les tokens (omda-*, status-*).
- Le vert (status-success) est réservé au succès confirmé par le serveur. Jamais près d'un bouton « Payer » avant statut REUSSI.
- Aucun montant, tarif, catégorie ou opérateur codé en dur dans l'UI : tout passe par un service (mock pour l'instant).
- Aucun menu (TabBar, Drawer, hamburger) hors espace membre connecté.
- Chaque écran qui charge des données gère : loading / erreur + « Réessayer » / vide / contenu.
- Pas de classes `hover:` ni de classes Tailwind web non supportées par NativeWind.
- Ne faire QUE l'étape demandée. Ne pas anticiper les étapes suivantes.
- À la fin de chaque étape : mettre à jour docs/PROGRESS.md et lister les fichiers créés ou modifiés.
- Le projet doit toujours compiler (`npx tsc --noEmit` sans erreur) à la fin d'une étape.