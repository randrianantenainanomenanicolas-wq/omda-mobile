import { Stack } from 'expo-router';

/**
 * Groupe « candidat » (suivi et paiement publics, sans compte) : navigation linéaire.
 * ⚠️ Aucun menu (ni TabBar, ni Drawer, ni hamburger) dans ce groupe.
 */
export default function CandidatLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
