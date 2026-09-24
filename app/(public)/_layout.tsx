import { Stack } from 'expo-router';

/**
 * Groupe « public » (visiteur) : navigation LINÉAIRE.
 * ⚠️ Aucun menu (ni TabBar, ni Drawer, ni hamburger) dans ce groupe.
 */
export default function PublicLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
