import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranOeuvres() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Espace membre — Œuvres" sousTitre="Squelette de navigation" afficherRetour={false}>
      <View className="gap-3">
        <Button libelle="Déposer une œuvre" pleineLargeur onPress={() => router.push('/depot-oeuvre')} />
        <Button
          libelle="Ouvrir une fiche œuvre"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/fiche-oeuvre')}
        />
      </View>
    </ScreenContainer>
  );
}
