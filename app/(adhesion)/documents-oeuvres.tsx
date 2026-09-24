import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranAdhesionDocumentsOeuvres() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Adhésion — Documents et œuvres" sousTitre="Squelette de navigation">
      <View className="gap-3">
        <Button
          libelle="Continuer vers le récapitulatif"
          pleineLargeur
          onPress={() => router.push('/recapitulatif')}
        />
        <Button
          libelle="Retour à la catégorie"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/categorie')}
        />
      </View>
    </ScreenContainer>
  );
}
