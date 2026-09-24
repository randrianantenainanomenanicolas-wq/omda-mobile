import { Stack } from 'expo-router';

/**
 * Espace membre : Stack interne contenant les onglets `(tabs)`
 * (Accueil, Œuvres, Cotisation, Profil, Notifications) et les écrans
 * hors onglets `depot-oeuvre` et `fiche-oeuvre`.
 * C'est le SEUL espace de l'application à afficher une TabBar.
 */
export default function MembreLayout() {
  return <Stack screenOptions={{ headerShown: false }} />;
}
