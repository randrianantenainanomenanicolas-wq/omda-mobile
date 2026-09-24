import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../../src/components/ui';

/** Squelette (étape 4) : titre + boutons de navigation, sans contenu métier. */
export default function EcranProfil() {
  const router = useRouter();

  return (
    <ScreenContainer titre="Espace membre — Profil" sousTitre="Squelette de navigation" afficherRetour={false}>
      <View className="gap-3">
        <Button
          libelle="Changer mon mot de passe"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/changer-mot-de-passe')}
        />
        <Button libelle="Se déconnecter" variante="destructive" pleineLargeur onPress={() => router.push('/')} />
      </View>
    </ScreenContainer>
  );
}
