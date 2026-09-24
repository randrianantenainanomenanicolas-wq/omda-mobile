import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranAdhesionCategorie() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Adhésion — Catégorie" sousTitre="Squelette de navigation">
      <View className="gap-3">
        <Button
          libelle="Continuer vers les documents"
          pleineLargeur
          onPress={() => router.push('/documents-oeuvres')}
        />
        <Button
          libelle="Retour à l’identité"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/identite')}
        />
      </View>
    </ScreenContainer>
  );
}
