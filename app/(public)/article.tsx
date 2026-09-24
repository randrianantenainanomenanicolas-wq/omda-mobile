import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** Article de documentation (squelette d'étape 4) : lecture confortable. */
export default function ArticleScreen() {
  return (
    <ScreenContainer titre="Article" sousTitre="Documentation">
      <Text className="text-base text-omda-textGray">
        Contenu de l’article (texte fourni par le service de documentation).
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="À propos"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(public)/a-propos')}
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
