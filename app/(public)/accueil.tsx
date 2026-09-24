import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Accueil public (squelette d'étape 4) — futurs boutons :
 * « Devenir membre », « Suivre ma demande », « Se connecter » + liens.
 */
export default function AccueilPublicScreen() {
  return (
    <ScreenContainer
      titre="OMDA"
      sousTitre="Application mobile — relations avec les auteurs"
      afficherRetour={false}
    >
      <Text className="text-base text-omda-textGray">
        Accueil de l’application : consultez la documentation, les tarifs et
        démarrez votre demande d’adhésion.
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Devenir membre"
          pleineLargeur
          onPress={() => router.push('/(adhesion)/identite')}
        />
        <Button
          libelle="Suivre ma demande"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(candidat)/suivi')}
        />
      </View>
    </ScreenContainer>
  );
}
