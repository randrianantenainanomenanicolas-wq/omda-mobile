import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranAdhesionIdentite() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Adhésion — Identité" sousTitre="Squelette de navigation">
      <View className="gap-3">
        <Button
          libelle="Continuer vers la catégorie"
          pleineLargeur
          onPress={() => router.push('/categorie')}
        />
        <Button
          libelle="Cas bloquant : moins de 15 ans"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/refus-age')}
        />
      </View>
    </ScreenContainer>
  );
}
