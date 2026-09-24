import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Succès d’adhésion (squelette d’étape 4) : affiché UNIQUEMENT après
 * confirmation serveur `REUSSI` + adhésion finalisée (étapes suivantes).
 * Pas de connexion automatique : bouton « Se connecter » seulement.
 */
export default function SuccesAdhesionScreen() {
  return (
    <ScreenContainer titre="Adhésion confirmée" afficherRetour={false}>
      <Text className="text-base text-omda-textGray">
        « Paiement confirmé. » — numéro d’adhérent et identifiants envoyés par
        e-mail (après confirmation serveur uniquement).
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Se connecter"
          pleineLargeur
          onPress={() => router.push('/(public)/connexion')}
        />
        <Button
          libelle="Accueil"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(public)/accueil')}
        />
      </View>
    </ScreenContainer>
  );
}
