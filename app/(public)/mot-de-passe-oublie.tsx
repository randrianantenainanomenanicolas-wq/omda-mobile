import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Mot de passe oublié (squelette d'étape 4) : confirmation identique que le
 * compte existe ou non (règle du cahier des charges, étape suivante).
 */
export default function MotDePasseOublieScreen() {
  return (
    <ScreenContainer titre="Mot de passe oublié">
      <Text className="text-base text-omda-textGray">
        Saisissez votre e-mail : la confirmation sera identique que le compte
        existe ou non.
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Revenir à la connexion"
          pleineLargeur
          onPress={() => router.push('/(public)/connexion')}
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
