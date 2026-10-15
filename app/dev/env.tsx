import { ScrollView, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import {
  authService,
  candidateApi,
  estApiCandidatConfiguree,
  estModeMockCandidat,
  estModeMockMembre,
  memberRepository,
  publicContentService,
} from '../../src/services/factory';
import {
  mockAuthService,
  mockCandidateApi,
  mockMemberRepository,
  mockPublicContentService,
} from '../../src/services/mocks';
import {
  estSupabaseConfigure,
  SUPABASE_ANON_KEY,
  SUPABASE_URL,
} from '../../src/services/supabase';

/**
 * Écran de DÉVELOPPEMENT (route `/dev/env`) — pré-flight du mode réel.
 *
 * Affiche les drapeaux mock ⇄ réel, le mode résolu par la fabrique, la
 * présence de la configuration Supabase et les services réellement
 * sélectionnés. La clé anon n'est JAMAIS rendue (seule sa présence est
 * affichée).
 *
 * ⚠️ Ce n'est PAS un écran du parcours utilisateur : aucun écran, layout ou
 * menu n'y fait lien (même convention que `/dev/catalogue` et
 * `/dev/installation`) — il ne se rejoint qu'en tapant la route.
 */

type LigneInformation = {
  libelle: string;
  valeur: string;
  classeValeur?: string;
};

type CarteInformation = {
  titre: string;
  lignes: LigneInformation[];
};

const CLASSE_DEFAUT = 'text-base font-semibold text-omda-black';
const CLASSE_MOCK = 'text-base font-semibold text-status-pending';
const CLASSE_REEL = 'text-base font-semibold text-status-info';
const CLASSE_ABSENTE = 'text-base font-semibold text-omda-textGray';

/** Valeur brute d'un drapeau, ou mention « (absente) » — jamais de secret ici. */
function drapeau(valeur: string | undefined): string {
  const brut = (valeur ?? '').trim();
  return brut.length > 0 ? brut : '(absente)';
}

const libelleAuth =
  authService === mockAuthService ? 'MockAuthService (mock)' : 'SupabaseAuthService (réel)';
const libelleMembre =
  memberRepository === mockMemberRepository
    ? 'MockMemberRepository (mock)'
    : 'SupabaseMemberRepository (réel)';
const libelleContenus =
  publicContentService === mockPublicContentService
    ? 'MockPublicContentService (mock)'
    : 'SupabasePublicContentService (réel)';
const libelleCandidat =
  candidateApi === mockCandidateApi ? 'MockCandidateApi (mock)' : 'HttpCandidateApi (réel)';

const CARTES: CarteInformation[] = [
  {
    titre: 'Drapeaux mock ⇄ réel (lus à l’import de la fabrique)',
    lignes: [
      {
        libelle: 'EXPO_PUBLIC_USE_MOCKS_MEMBER',
        valeur: drapeau(process.env.EXPO_PUBLIC_USE_MOCKS_MEMBER),
      },
      {
        libelle: 'EXPO_PUBLIC_USE_MOCKS_CANDIDATE',
        valeur: drapeau(process.env.EXPO_PUBLIC_USE_MOCKS_CANDIDATE),
      },
      {
        libelle: 'EXPO_PUBLIC_USE_MOCKS (repli commun)',
        valeur: drapeau(process.env.EXPO_PUBLIC_USE_MOCKS),
      },
      {
        libelle: 'Parcours MEMBRE résolu',
        valeur: estModeMockMembre() ? 'MOCK (démonstration)' : 'RÉEL (Supabase)',
        classeValeur: estModeMockMembre() ? CLASSE_MOCK : CLASSE_REEL,
      },
      {
        libelle: 'Parcours CANDIDAT résolu',
        valeur: estModeMockCandidat() ? 'MOCK (démonstration)' : 'RÉEL (API Express)',
        classeValeur: estModeMockCandidat() ? CLASSE_MOCK : CLASSE_REEL,
      },
    ],
  },
  {
    titre: 'Supabase',
    lignes: [
      {
        libelle: 'EXPO_PUBLIC_SUPABASE_URL',
        valeur: SUPABASE_URL.length > 0 ? SUPABASE_URL : '(absente)',
        classeValeur: SUPABASE_URL.length > 0 ? CLASSE_REEL : CLASSE_ABSENTE,
      },
      {
        libelle: 'EXPO_PUBLIC_SUPABASE_ANON_KEY',
        valeur: SUPABASE_ANON_KEY.length > 0 ? 'présente (valeur masquée)' : '(absente)',
        classeValeur: SUPABASE_ANON_KEY.length > 0 ? CLASSE_REEL : CLASSE_ABSENTE,
      },
      {
        libelle: 'Configuration complète (URL + clé)',
        valeur: estSupabaseConfigure() ? 'Oui' : 'Non',
        classeValeur: estSupabaseConfigure() ? CLASSE_REEL : CLASSE_ABSENTE,
      },
      {
        libelle: 'Mode réel sans configuration',
        valeur: 'Refus serveur « Supabase n’est pas configuré… » — aucun crash',
      },
    ],
  },
  {
    titre: 'Services sélectionnés par la fabrique',
    lignes: [
      {
        libelle: 'authService (authentification membre)',
        valeur: libelleAuth,
        classeValeur: authService === mockAuthService ? CLASSE_MOCK : CLASSE_REEL,
      },
      {
        libelle: 'memberRepository (données membre)',
        valeur: libelleMembre,
        classeValeur: memberRepository === mockMemberRepository ? CLASSE_MOCK : CLASSE_REEL,
      },
      {
        libelle: 'publicContentService (contenus publics)',
        valeur: libelleContenus,
        classeValeur:
          publicContentService === mockPublicContentService ? CLASSE_MOCK : CLASSE_REEL,
      },
      {
        libelle: 'candidateApi (parcours candidat)',
        valeur: libelleCandidat,
        classeValeur: candidateApi === mockCandidateApi ? CLASSE_MOCK : CLASSE_REEL,
      },
      {
        libelle: 'EXPO_PUBLIC_API_BASE_URL',
        valeur: drapeau(process.env.EXPO_PUBLIC_API_BASE_URL),
        classeValeur:
          (process.env.EXPO_PUBLIC_API_BASE_URL ?? '').trim().length > 0
            ? CLASSE_REEL
            : CLASSE_ABSENTE,
      },
      {
        libelle: 'API candidat configurée',
        valeur: estApiCandidatConfiguree()
          ? 'Oui'
          : 'Non — le candidat reste en mock même si son flag vaut false',
        classeValeur: estApiCandidatConfiguree() ? CLASSE_REEL : CLASSE_ABSENTE,
      },
    ],
  },
];

export default function ConfigurationDeveloppement() {
  return (
    <SafeAreaView className="flex-1 bg-omda-warmGray">
      <ScrollView contentContainerClassName="px-6 py-10">
        <Text className="text-2xl font-bold text-omda-green">Configuration</Text>
        <Text className="mt-1 text-sm leading-5 text-omda-textGray">
          Écran de développement (route /dev/env) — aucun lien depuis le parcours normal. La clé
          anon Supabase n’est jamais affichée.
        </Text>

        {CARTES.map((carte) => (
          <View
            key={carte.titre}
            className="mt-5 rounded-2xl border border-omda-borderGray bg-omda-white p-5"
          >
            <Text className="text-lg font-semibold text-omda-black">{carte.titre}</Text>
            {carte.lignes.map((ligne) => (
              <View key={ligne.libelle} className="mt-3">
                <Text className="text-sm text-omda-textGray">{ligne.libelle}</Text>
                <Text className={ligne.classeValeur ?? CLASSE_DEFAUT}>{ligne.valeur}</Text>
              </View>
            ))}
          </View>
        ))}

        <Text className="mt-6 text-center text-xs leading-5 text-omda-textGray">
          En mode réel non configuré, chaque appel de service renvoie un refus serveur explicite —
          l’application ne plante jamais pour une variable d’environnement manquante.
        </Text>
      </ScrollView>
    </SafeAreaView>
  );
}
