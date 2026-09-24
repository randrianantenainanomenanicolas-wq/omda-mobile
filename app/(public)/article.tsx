import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranArticle() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Article" sousTitre="Squelette de navigation">
      <View className="gap-3">
        <Button
          libelle="Tous les articles"
          pleineLargeur
          onPress={() => router.push('/documentation')}
        />
        <Button
          libelle="À propos de l’OMDA"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/a-propos')}
        />
      </View>
    </ScreenContainer>
  );
}
