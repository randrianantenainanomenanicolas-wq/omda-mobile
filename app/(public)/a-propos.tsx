import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** À propos (squelette d'étape 4). */
export default function AProposScreen() {
  return (
    <ScreenContainer titre="À propos">
      <Text className="text-base text-omda-textGray">
        Présentation de l’association OMDA et de sa mission (contenu à
        charger).
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Documentation"
          pleineLargeur
          onPress={() => router.push('/(public)/documentation')}
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
