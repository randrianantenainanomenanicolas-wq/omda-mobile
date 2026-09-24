import { router } from 'expo-router';
import { Text, View } from 'react-native';

import { Button, ScreenContainer } from '../../src/components/ui';

/**
 * Changement de mot de passe obligatoire (squelette d'étape 4, BLOQUANT) :
 * affiché quand `doit_changer_mot_de_passe = true` à la première connexion.
 * Aucun retour arrière (en-tête masqué) : le reste de l’app est inaccessible
 * tant que le nouveau mot de passe n’est pas validé (règle métier 10).
 */
export default function ChangerMotDePasseScreen() {
  return (
    <ScreenContainer
      titre="Changement de mot de passe"
      sousTitre="Obligatoire à la première connexion"
      afficherRetour={false}
    >
      <Text className="text-base text-omda-textGray">
        Choisissez un nouveau mot de passe (règles d’affichage à venir). Le
        reste de l’application reste bloqué tant que ce champ n’est pas validé.
      </Text>

      <View className="mt-6 gap-3">
        <Button
          libelle="Valider mon nouveau mot de passe"
          pleineLargeur
          onPress={() => router.push('/(membre)/(tabs)/accueil')}
        />
        <Button
          libelle="Annuler"
          variante="secondary"
          pleineLargeur
          onPress={() => router.push('/(public)/connexion')}
        />
      </View>
    </ScreenContainer>
  );
}
