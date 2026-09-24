# OMDA Mobile — Règles strictes

- Construire UNIQUEMENT l'application mobile (iOS/Android). Interdiction totale de générer un back-office web.
- Stack : Expo + React Native + TypeScript + Expo Router + NativeWind + FontAwesome (@expo/vector-icons).
- UI en français (vouvoiement). Devise : Ariary (Ar).
- AUCUN montant / tarif / opérateur / catégorie codé en dur dans les composants UI : tout provient d’un service (mockable).
- Couleurs : uniquement via tokens NativeWind (omda-*, status-*). Jamais de hex dans les composants.
- Vert = succès confirmé serveur (paiement REUSSI). Jamais décoratif près d’un bouton “Payer” avant confirmation.
- Navigation : aucun menu (tab/drawer) côté Public/Candidat. Tabs uniquement pour Membre connecté.
- Chaque écran data-driven gère : loading / erreur + “Réessayer” / vide / contenu.
- Ne faire QUE l’étape demandée. Ne pas anticiper.
- Format de sortie obligatoire : liste des fichiers créés/modifiés + contenu complet de chaque fichier.