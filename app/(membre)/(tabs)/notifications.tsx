import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranNotifications() {
  const router = useRouter();

  return (
    <ScreenContainer
      titre="Espace membre — Notifications"
      sousTitre="Squelette de navigation"
      afficherRetour={false}
    >
      <View className="gap-3">
        <Button
          libelle="Retour à l’accueil membre"
          pleineLargeur
          onPress={() => router.push('/accueil')}
        />
        <Button
          libelle="Voir mes œuvres"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/oeuvres')}
        />
      </View>
    </ScreenContainer>
  );
}
