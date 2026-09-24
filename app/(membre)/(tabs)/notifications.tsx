import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../../src/components/ui';

/** Notifications (squelette d'étape 4, onglet 5/5) : liste lues / non lues. */
export default function NotificationsScreen() {
  return (
    <ScreenContainer titre="Notifications" afficherRetour={false}>
      <Text className="text-base text-omda-textGray">
        Vos notifications, séparées en lues et non lues (données fournies par
        le service).
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Accueil"
          pleineLargeur
          onPress={() => router.push('/(membre)/(tabs)/accueil')}
        />
        <Button
          libelle="Cotisation"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(membre)/(tabs)/cotisation')}
        />
      </View>
    </ScreenContainer>
  );
}
