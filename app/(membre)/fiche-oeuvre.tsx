import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Squelette (étape 4) : écran du Stack interne membre, empilé au-dessus des
 * onglets (bouton retour dans l'en-tête).
 */
export default function EcranFicheOeuvre() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Fiche œuvre" sousTitre="Squelette de navigation">
      <View className="gap-3">
        <Button
          libelle="Ma cotisation"
          pleineLargeur
          onPress={() => router.push('/cotisation')}
        />
        <Button
          libelle="Mes œuvres"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/oeuvres')}
        />
      </View>
    </ScreenContainer>
  );
}
