import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Accueil public (route `/`).
 * Squelette (étape 4) : titre + 2 boutons de navigation (contenu réel ensuite).
 * ⚠️ Aucun menu : navigation linéaire.
 */
export default function EcranAccueilPublic() {
  const router = useRouter();

  return (
    <ScreenContainer
      titre="OMDA"
      sousTitre="Application mobile — squelette de navigation"
      afficherRetour={false}
    >
      <View className="gap-3">
        <Button libelle="Devenir membre" pleineLargeur onPress={() => router.push('/identite')} />
        <Button
          libelle="Se connecter"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/connexion')}
        />
      </View>
    </ScreenContainer>
  );
}
