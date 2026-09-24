import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Étape 2 — Catégorie (squelette d'étape 4) : liste des catégories actives +
 * description courte, provenant d’un service (aucune codée en dur).
 */
export default function CategorieScreen() {
  return (
    <ScreenContainer titre="Étape 2 — Catégorie" sousTitre="Adhésion">
      <Text className="text-base text-omda-textGray">
        Liste des catégories actives proposées par le service (à charger).
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Continuer"
          pleineLargeur
          onPress={() => router.push('/(adhesion)/documents-oeuvres')}
        />
        <Button
          libelle="Accueil"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(public)/accueil')}
        />
      </View>
    </ScreenContainer>
  );
}
