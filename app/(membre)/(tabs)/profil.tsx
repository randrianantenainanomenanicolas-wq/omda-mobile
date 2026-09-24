import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../../src/components/ui';

/**
 * Profil (squelette d'étape 4, onglet 4/5) : infos utilisateur + membre +
 * catégories, distinction modifiable / lecture seule.
 * Déconnexion : confirmation puis retour à l’accueil public sans menu
 * (règle métier W).
 */
export default function ProfilScreen() {
  return (
    <ScreenContainer titre="Profil" afficherRetour={false}>
      <Text className="text-base text-omda-textGray">
        Informations du compte et du profil membre : certains champs sont en
        lecture seule.
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Accueil"
          pleineLargeur
          onPress={() => router.push('/(membre)/(tabs)/accueil')}
        />
        <Button
          libelle="Se déconnecter"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(public)/accueil')}
        />
      </View>
    </ScreenContainer>
  );
}
