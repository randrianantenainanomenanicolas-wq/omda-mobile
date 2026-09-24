import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../../src/components/ui';

/**
 * Accueil membre (squelette d'étape 4, onglet 1/5) : bonjour + prénom, numéro
 * d’adhérent, statut du compte, compteurs (œuvres, cotisation, notifications).
 */
export default function AccueilMembreScreen() {
  return (
    <ScreenContainer titre="Accueil" afficherRetour={false}>
      <Text className="text-base text-omda-textGray">
        Bonjour, votre prénom — numéro d’adhérent, statut du compte, nombre
        d’œuvres, cotisation de l’année et notifications non lues.
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Mes œuvres"
          pleineLargeur
          onPress={() => router.push('/(membre)/(tabs)/oeuvres')}
        />
        <Button
          libelle="Notifications"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(membre)/(tabs)/notifications')}
        />
      </View>
    </ScreenContainer>
  );
}
