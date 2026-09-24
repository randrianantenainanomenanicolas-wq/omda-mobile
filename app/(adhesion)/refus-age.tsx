import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Cas bloquant « moins de 15 ans » (< 15 : refus, cf. règle métier 7).
 * Squelette (étape 4) : titre + boutons de navigation.
 */
export default function EcranRefusAge() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Demande impossible — âge" sousTitre="Squelette de navigation">
      <View className="gap-3">
        <Button libelle="Retour à l’accueil" pleineLargeur onPress={() => router.push('/')} />
        <Button
          libelle="Corriger ma date de naissance"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/identite')}
        />
      </View>
    </ScreenContainer>
  );
}
