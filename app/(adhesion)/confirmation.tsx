import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Confirmation d’envoi (squelette d’étape 4) : numéro de dossier + code de
 * suivi en clair, actions copier/partager/sauvegarder, « Délai indicatif :
 * 72 heures », « Aucun paiement n’est demandé pour le moment. » (étapes
 * suivantes).
 */
export default function ConfirmationScreen() {
  return (
    <ScreenContainer titre="Demande envoyée" afficherRetour={false}>
      <Text className="text-base text-omda-textGray">
        Numéro de dossier et code de suivi à conserver — délai indicatif :
        72 heures. Aucun paiement n’est demandé pour le moment.
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Suivre ma demande"
          pleineLargeur
          onPress={() => router.push('/(candidat)/suivi')}
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
