import { Stack } from 'expo-router';

/**
 * Groupe « auth-required » : écrans imposés par l'authentification
 * (changement de mot de passe obligatoire à la première connexion).
 * ⚠️ Aucun menu : l'écran est bloquant tant que l'action n'est pas faite.
 */
export default function AuthRequiredLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
