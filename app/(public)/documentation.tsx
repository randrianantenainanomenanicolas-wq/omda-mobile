import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranDocumentation() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Documentation" sousTitre="Squelette de navigation">
      <View className="gap-3">
        <Button libelle="Lire un article" pleineLargeur onPress={() => router.push('/article')} />
        <Button
          libelle="Voir les tarifs"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/tarifs')}
        />
      </View>
    </ScreenContainer>
  );
}
