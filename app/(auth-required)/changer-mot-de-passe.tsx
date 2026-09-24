import { useRouter } from 'expo-router';
import { View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Écran BLOQUANT de première connexion (groupe `(auth-required)`).
 * Squelette (étape 4) : aucune TabBar, sortie uniquement par validation
 * (simulée ici) ou par déconnexion.
 */
export default function EcranChangerMotDePasse() {
  const router = useRouter();

  return (
    <ScreenContainer
      titre="Changement de mot de passe obligatoire"
      sousTitre="Squelette de navigation — écran bloquant"
      afficherRetour={false}
    >
      <View className="gap-3">
        <Button
          libelle="Valider le nouveau mot de passe (test)"
          pleineLargeur
          onPress={() => router.push('/accueil')}
        />
        <Button
          libelle="Se déconnecter"
          variante="destructive"
          pleineLargeur
          onPress={() => router.push('/')}
        />
      </View>
    </ScreenContainer>
  );
}
