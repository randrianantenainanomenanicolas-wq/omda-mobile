import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Connexion membre (squelette d'étape 4) : e-mail + mot de passe, erreurs
 * distinctes et accès au mot de passe oublié (étapes suivantes).
 * « Se connecter » mène au changement de mot de passe bloquant (première
 * connexion) pour tester ce groupe de routes.
 */
export default function ConnexionScreen() {
  return (
    <ScreenContainer titre="Connexion" sousTitre="Espace membre">
      <Text className="text-base text-omda-textGray">
        Saisissez votre e-mail et votre mot de passe (formulaire à venir).
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Se connecter"
          pleineLargeur
          onPress={() => router.push('/(auth-required)/changer-mot-de-passe')}
        />
        <Button
          libelle="Mot de passe oublié"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(public)/mot-de-passe-oublie')}
        />
      </View>
    </ScreenContainer>
  );
}
