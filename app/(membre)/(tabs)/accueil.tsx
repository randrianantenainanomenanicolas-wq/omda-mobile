import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranAccueilMembre() {
  const router = useRouter();

  return (
    <ScreenContainer
      titre="Espace membre — Accueil"
      sousTitre="Squelette de navigation"
      afficherRetour={false}
    >
      <View className="gap-3">
        <Button
          libelle="Déposer une œuvre"
          pleineLargeur
          onPress={() => router.push('/depot-oeuvre')}
        />
        <Button
          libelle="Voir mes œuvres"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/oeuvres')}
        />
      </View>
    </ScreenContainer>
  );
}
