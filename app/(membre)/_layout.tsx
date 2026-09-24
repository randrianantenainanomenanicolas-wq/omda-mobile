import { Stack } from 'expo-router';

/**
 * Espace membre (connecté) : Stack interne.
 *
 * - `(tabs)` : les 5 onglets (Accueil, Œuvres, Cotisation, Profil,
 *   Notifications) — SEULE TabBar de l'application ;
 * - `depot-oeuvre` et `fiche-oeuvre` : écrans empilés AU-DESSUS des onglets
 *   (bouton retour via `ScreenContainer`), ce qui permet de garder la zone
 *   membre en plein écran pendant le parcours.
 */
export default function MembreLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="depot-oeuvre" />
      <Stack.Screen name="fiche-oeuvre" />
    </Stack>
  );
}
