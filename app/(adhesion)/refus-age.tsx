import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Écran de blocage âge (squelette d'étape 4) : moins de 15 ans → refus
 * bloquant avec retour à l’accueil public (règle métier 7).
 */
export default function RefusAgeScreen() {
  return (
    <ScreenContainer titre="Demande non possible">
      <Text className="text-base text-omda-textGray">
        Une demande d’adhésion est possible à partir de 15 ans. Cette règle
        sera confirmée côté serveur.
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Retour à l’accueil"
          pleineLargeur
          onPress={() => router.push('/(public)/accueil')}
        />
        <Button
          libelle="Revenir à l’identité"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(adhesion)/identite')}
        />
      </View>
    </ScreenContainer>
  );
}
