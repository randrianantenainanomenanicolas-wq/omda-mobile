import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Étape 3 — Documents + œuvres (squelette d'étape 4) : uploads (20 Mo max,
 * progression, retry), au moins 2 œuvres avec 1 attestation chacune.
 */
export default function DocumentsOeuvresScreen() {
  return (
    <ScreenContainer titre="Étape 3 — Documents et œuvres" sousTitre="Adhésion">
      <Text className="text-base text-omda-textGray">
        Pièces (photo, CIN, acte, résidence) et au moins 2 œuvres avec leur
        attestation de diffusion.
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Continuer"
          pleineLargeur
          onPress={() => router.push('/(adhesion)/recapitulatif')}
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
