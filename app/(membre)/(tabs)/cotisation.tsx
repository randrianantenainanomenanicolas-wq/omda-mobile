import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranCotisation() {
  const router = useRouter();

  return (
    <ScreenContainer
      titre="Espace membre — Cotisation"
      sousTitre="Squelette de navigation"
      afficherRetour={false}
    >
      <View className="gap-3">
        <Button libelle="Voir mes œuvres" pleineLargeur onPress={() => router.push('/oeuvres')} />
        <Button
          libelle="Voir mon profil"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/profil')}
        />
      </View>
    </ScreenContainer>
  );
}
