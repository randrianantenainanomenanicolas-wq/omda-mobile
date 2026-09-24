import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Dépôt d’œuvre (squelette d'étape 4, hors onglets) : création de brouillon,
 * titre, catégorie, description, année, fichier, attestation ; envoi =
 * statut ENVOYEE, aucun paiement (règle métier 4).
 */
export default function DepotOeuvreScreen() {
  return (
    <ScreenContainer titre="Déposer une œuvre" sousTitre="Espace membre">
      <Text className="text-base text-omda-textGray">
        Formulaire de création d’œuvre : titre, catégorie, description, année,
        fichier et attestation de diffusion.
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
