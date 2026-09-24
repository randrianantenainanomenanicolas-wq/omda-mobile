import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';

import '../global.css';

/**
 * Navigation racine (étape 4) :
 *
 * - `(public)` / `(adhesion)` / `(candidat)` : parcours visiteur & candidat,
 *   navigation LINÉAIRE (Stack + bouton retour) — AUCUN menu.
 * - `(auth-required)` : écran bloquant de première connexion.
 * - `(membre)` : espace membre connecté, SEULE zone avec une TabBar
 *   (cf. `app/(membre)/(tabs)/_layout.tsx`).
 * - `dev/catalogue` : écran de développement (catalogue du design system).
 *
 * Les en-têtes natifs sont masqués : chaque écran utilise `ScreenContainer`
 * (fond de page, marges et bouton retour homogènes).
 */
export default function RootLayout() {
  return (
    <>
      <StatusBar style="dark" />
      <Stack screenOptions={{ headerShown: false }}>
        <Stack.Screen name="(public)" />
        <Stack.Screen name="(adhesion)" />
        <Stack.Screen name="(candidat)" />
        <Stack.Screen name="(auth-required)" />
        <Stack.Screen name="(membre)" />
        <Stack.Screen name="dev/catalogue" />
      </Stack>
    </>
  );
}
