import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranAPropos() {
  const router = useRouter();

  return (
    <ScreenContainer titre="À propos" sousTitre="Squelette de navigation">
      <View className="gap-3">
        <Button libelle="Documentation" pleineLargeur onPress={() => router.push('/documentation')} />
        <Button
          libelle="Se connecter"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/connexion')}
        />
      </View>
    </ScreenContainer>
  );
}
