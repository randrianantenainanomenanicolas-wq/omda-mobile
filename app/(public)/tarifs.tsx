import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Tarifs / simulateur (squelette d'étape 4) :
 * montants dynamiques + mention « Estimation — le montant final est confirmé
 * par le serveur. » (étapes suivantes).
 */
export default function TarifsScreen() {
  return (
    <ScreenContainer titre="Tarifs" sousTitre="Simulateur — estimation uniquement">
      <Text className="text-base text-omda-textGray">
        Type d’opération, catégorie et montant estimatif proviennent d’un
        service (jamais codés en dur).
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Se connecter"
          pleineLargeur
          onPress={() => router.push('/(public)/connexion')}
        />
        <Button
          libelle="Documentation"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(public)/documentation')}
        />
      </View>
    </ScreenContainer>
  );
}
