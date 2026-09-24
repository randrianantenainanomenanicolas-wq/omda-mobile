import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Paiement candidat (squelette d'étape 4) : frais d’adhésion (montant non
 * modifiable, fourni par le serveur), Mobile Money / virement, polling —
 * aucun succès annoncé avant confirmation `REUSSI` (étapes suivantes).
 */
export default function PaiementScreen() {
  return (
    <ScreenContainer titre="Paiement des frais" sousTitre="Dossier validé">
      <Text className="text-base text-omda-textGray">
        Objet « Frais d’adhésion », montant confirmé par le serveur, modes et
        opérateurs fournis dynamiquement.
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Passer à l’étape suivante"
          pleineLargeur
          onPress={() => router.push('/(candidat)/succes-adhesion')}
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
