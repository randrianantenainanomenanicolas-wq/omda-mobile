import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranPaiementCandidat() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Paiement des frais d’adhésion" sousTitre="Squelette de navigation">
      <View className="gap-3">
        <Button
          libelle="Paiement réussi (simulation)"
          pleineLargeur
          onPress={() => router.push('/succes-adhesion')}
        />
        <Button
          libelle="Retour au suivi"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/suivi')}
        />
      </View>
    </ScreenContainer>
  );
}
