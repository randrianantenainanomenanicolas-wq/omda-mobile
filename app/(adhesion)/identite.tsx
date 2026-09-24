import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Étape 1 — Identité (squelette d'étape 4).
 * Futurs champs : nom, prénom, date de naissance, CIN, téléphone +261,
 * e-mail, adresse. Cas < 15 ans → écran `refus-age` (blocage).
 */
export default function IdentiteScreen() {
  return (
    <ScreenContainer titre="Étape 1 — Identité" sousTitre="Adhésion">
      <Text className="text-base text-omda-textGray">
        Formulaire d’identité (champs et règles d’âge à venir).
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Continuer"
          pleineLargeur
          onPress={() => router.push('/(adhesion)/categorie')}
        />
        <Button
          libelle="Vérifier la règle d’âge"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(adhesion)/refus-age')}
        />
      </View>
    </ScreenContainer>
  );
}
