import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../../src/components/ui';

/**
 * Cotisation (squelette d'étape 4, onglet 3/5) : année, montant, statut, date
 * de paiement ; « Payer » seulement si due (règles aux étapes suivantes).
 */
export default function CotisationScreen() {
  return (
    <ScreenContainer titre="Cotisation" afficherRetour={false}>
      <Text className="text-base text-omda-textGray">
        Cotisation de l’année en cours : montant, statut et date de paiement
        (données fournies par le service).
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Mon profil"
          pleineLargeur
          onPress={() => router.push('/(membre)/(tabs)/profil')}
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
