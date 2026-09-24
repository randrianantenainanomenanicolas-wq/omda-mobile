import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../../src/components/ui';

/** Œuvres du membre (squelette d'étape 4, onglet 2/5) : liste + statuts + empty state. */
export default function OeuvresScreen() {
  return (
    <ScreenContainer titre="Œuvres" afficherRetour={false}>
      <Text className="text-base text-omda-textGray">
        Liste de vos œuvres et de leurs statuts (état vide géré quand aucune
        œuvre n’est déposée).
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Déposer une œuvre"
          pleineLargeur
          onPress={() => router.push('/(membre)/depot-oeuvre')}
        />
        <Button
          libelle="Ouvrir une fiche"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(membre)/fiche-oeuvre')}
        />
      </View>
    </ScreenContainer>
  );
}
