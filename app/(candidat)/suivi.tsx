import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranSuiviDemande() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Suivre ma demande" sousTitre="Squelette de navigation">
      <View className="gap-3">
        <Button
          libelle="Payer mon adhésion"
          pleineLargeur
          onPress={() => router.push('/paiement')}
        />
        <Button
          libelle="Documentation d’aide"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/documentation')}
        />
      </View>
    </ScreenContainer>
  );
}
