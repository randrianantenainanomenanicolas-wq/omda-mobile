import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** Documentation (squelette d'étape 4) : liste des articles publiés. */
export default function DocumentationScreen() {
  return (
    <ScreenContainer titre="Documentation" sousTitre="Sans menu — navigation linéaire">
      <Text className="text-base text-omda-textGray">
        Liste des articles publiés (contenu fourni par un service).
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Lire un article"
          pleineLargeur
          onPress={() => router.push('/(public)/article')}
        />
        <Button
          libelle="Voir les tarifs"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(public)/tarifs')}
        />
      </View>
    </ScreenContainer>
  );
}
