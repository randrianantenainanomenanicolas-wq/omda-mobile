import { Stack } from 'expo-router';

/**
 * Groupe « adhésion » (candidat sans compte) : parcours guidé linéaire.
 * ⚠️ Aucun menu (ni TabBar, ni Drawer, ni hamburger) dans ce groupe.
 */
export default function AdhesionLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
