import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Récapitulatif modifiable (squelette d'étape 4) : sections éditables et
 * bouton « Envoyer ma demande » actif seulement si le dossier est complet.
 * Aucun paiement à l’envoi (règle métier 1).
 */
export default function RecapitulatifScreen() {
  return (
    <ScreenContainer titre="Récapitulatif" sousTitre="Adhésion">
      <Text className="text-base text-omda-textGray">
        Sections éditables : identité, catégorie, documents, œuvres. Aucun
        paiement n’est demandé à l’envoi.
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Envoyer ma demande"
          pleineLargeur
          onPress={() => router.push('/(adhesion)/confirmation')}
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
