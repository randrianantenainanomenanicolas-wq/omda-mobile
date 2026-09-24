import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Fiche œuvre (squelette d'étape 4, hors onglets) : actions selon le statut ;
 * « Payer » seulement si l’œuvre est VALIDÉE (règle métier 4 — étapes
 * suivantes).
 */
export default function FicheOeuvreScreen() {
  return (
    <ScreenContainer titre="Fiche de l’œuvre" sousTitre="Espace membre">
      <Text className="text-base text-omda-textGray">
        Détail de l’œuvre et de son statut, avec les actions disponibles pour
        ce statut.
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Mes œuvres"
          pleineLargeur
          onPress={() => router.push('/(membre)/(tabs)/oeuvres')}
        />
        <Button
          libelle="Accueil"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(membre)/(tabs)/accueil')}
        />
      </View>
    </ScreenContainer>
  );
}
