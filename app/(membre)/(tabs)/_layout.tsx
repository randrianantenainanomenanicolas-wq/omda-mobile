import FontAwesome6 from '@expo/vector-icons/FontAwesome6';
import { Tabs } from 'expo-router';

import type { NomIcone } from '../../../src/components/ui';
import { colors } from '../../../src/theme/colors';

/**
 * ⚠️ SEULE TabBar de l'application : elle n'existe que dans l'espace membre
 * connecté. Les parcours public / candidat n'ont aucun menu.
 *
 * Les couleurs de la TabBar sont des options de React Navigation : elles
 * proviennent de `src/theme/colors.ts` (aucun hex dans le composant).
 * Chaque onglet porte un libellé texte : l'icône n'est jamais seule.
 */
const ONGLETS: { nom: string; titre: string; icone: NomIcone }[] = [
  { nom: 'accueil', titre: 'Accueil', icone: 'house' },
  { nom: 'oeuvres', titre: 'Œuvres', icone: 'folder-open' },
  { nom: 'cotisation', titre: 'Cotisation', icone: 'money-bill-wave' },
  { nom: 'profil', titre: 'Profil', icone: 'user' },
  { nom: 'notifications', titre: 'Notifications', icone: 'bell' },
];

export default function MembreTabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.omda.green,
        tabBarInactiveTintColor: colors.omda.textGray,
        tabBarStyle: {
          backgroundColor: colors.omda.white,
          borderTopColor: colors.omda.borderGray,
        },
        tabBarLabelStyle: { fontSize: 12, fontWeight: '600' },
      }}
    >
      {ONGLETS.map((onglet) => (
        <Tabs.Screen
          key={onglet.nom}
          name={onglet.nom}
          options={{
            title: onglet.titre,
            tabBarIcon: ({ color, size }) => (
              <FontAwesome6 name={onglet.icone} size={size} color={color} />
            ),
          }}
        />
      ))}
    </Tabs>
  );
}
