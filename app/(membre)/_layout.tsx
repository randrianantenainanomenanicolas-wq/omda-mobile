import { Redirect, Stack } from 'expo-router';

import { LoadingState } from '../../src/components/ui';
import { useAuth } from '../../src/context/AuthContext';

/**
 * Espace membre : Stack interne contenant les onglets `(tabs)`
 * (Accueil, Œuvres, Cotisation, Profil, Notifications) et les écrans
 * hors onglets `depot-oeuvre` et `fiche-oeuvre`.
 * C'est le SEUL espace de l'application à afficher une TabBar.
 *
 * Garde de navigation :
 * - non connecté => redirection vers `/(public)/connexion`
 * - connecté avec `doit_changer_mot_de_passe = true` => redirection bloquante vers `/(auth-required)/changer-mot-de-passe`
 * - connecté avec mot de passe valide => autorise l'accès à l'espace membre.
 */
export default function MembreLayout() {
  const { estCharge, estConnecte, doitChangerMotDePasse } = useAuth();

  if (!estCharge) {
    return <LoadingState message="Chargement de votre espace membre…" />;
  }

  if (!estConnecte) {
    return <Redirect href="/(public)/connexion" />;
  }

  if (doitChangerMotDePasse) {
    return <Redirect href="/(auth-required)/changer-mot-de-passe" />;
  }

  return <Stack screenOptions={{ headerShown: false }} />;
}

