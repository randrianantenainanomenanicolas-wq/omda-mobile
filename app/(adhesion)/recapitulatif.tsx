import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranAdhesionRecapitulatif() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Adhésion — Récapitulatif" sousTitre="Squelette de navigation">
      <View className="gap-3">
        <Button
          libelle="Envoyer ma demande"
          pleineLargeur
          onPress={() => router.push('/confirmation')}
        />
        <Button
          libelle="Modifier l’identité"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/identite')}
        />
      </View>
    </ScreenContainer>
  );
}
