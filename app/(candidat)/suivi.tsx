import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Suivi de demande (squelette d'étape 4) : numéro de dossier + code de suivi,
 * statut, timeline, motif de rejet, paiement si VALIDÉE (étapes suivantes).
 */
export default function SuiviScreen() {
  return (
    <ScreenContainer titre="Suivre ma demande" sousTitre="Sans compte">
      <Text className="text-base text-omda-textGray">
        Saisissez votre numéro de dossier et votre code de suivi pour afficher
        le statut et la timeline.
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Voir le paiement"
          pleineLargeur
          onPress={() => router.push('/(candidat)/paiement')}
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
