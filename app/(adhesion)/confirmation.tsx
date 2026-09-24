import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranAdhesionConfirmation() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Demande envoyée" sousTitre="Squelette de navigation">
      <View className="gap-3">
        <Button libelle="Suivre ma demande" pleineLargeur onPress={() => router.push('/suivi')} />
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
