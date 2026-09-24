import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranConnexion() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Connexion membre" sousTitre="Squelette de navigation">
      <View className="gap-3">
        <Button
          libelle="Se connecter (simulation)"
          pleineLargeur
          onPress={() => router.push('/accueil')}
        />
        <Button
          libelle="Mot de passe oublié"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/mot-de-passe-oublie')}
        />
      </View>
    </ScreenContainer>
  );
}
