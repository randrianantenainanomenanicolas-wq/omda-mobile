import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranMotDePasseOublie() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Mot de passe oublié" sousTitre="Squelette de navigation">
      <View className="gap-3">
        <Button
          libelle="Retour à la connexion"
          pleineLargeur
          onPress={() => router.push('/connexion')}
        />
        <Button
          libelle="Retour à l’accueil"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/')}
        />
      </View>
    </ScreenContainer>
  );
}
