import { Text, View } from 'react-native';

import { Icone } from './Icone';

export type EtapeAdhesionIndex = 1 | 2 | 3 | 4 | 5 | 6 | 7;

export type DefinitionEtapeAdhesion = {
  index: EtapeAdhesionIndex;
  titreCourt: string;
  titreComplet: string;
};

export const ETAPES_ADHESION: DefinitionEtapeAdhesion[] = [
  { index: 1, titreCourt: 'Identité', titreComplet: 'Identité du candidat' },
  { index: 2, titreCourt: 'Catégorie', titreComplet: 'Catégorie d’adhésion' },
  { index: 3, titreCourt: 'Documents', titreComplet: 'Documents & œuvres' },
  { index: 4, titreCourt: 'Engagement', titreComplet: 'Engagement sur l’honneur' },
  { index: 5, titreCourt: 'Récapitulatif', titreComplet: 'Vérification du dossier' },
  { index: 6, titreCourt: 'Vérification', titreComplet: 'Vérification d’identité (selfie)' },
  { index: 7, titreCourt: 'Confirmation', titreComplet: 'Envoi & confirmation' },
];

type PropsStepProgress = {
  /** Étape en cours (1 à 7). */
  etapeCourante: EtapeAdhesionIndex;
};

/**
 * Indicateur de progression du parcours d’adhésion (1 → 7).
 *
 * Affiché en tête des écrans du tunnel pour donner une visibilité claire
 * sur l’état d’avancement :
 * 1. Identité → 2. Catégorie → 3. Documents & œuvres → 4. Engagement →
 * 5. Récapitulatif → 6. Vérification d’identité → 7. Confirmation
 *
 * L’étape « Engagement » a été ajoutée à l’ÉTAPE 29 : le texte malgache est
 * servi par le service avec ses 3 variables, l’auteur saisit la mention, le
 * lieu et coche la déclaration sur l’honneur (la date du jour est en lecture
 * seule).
 *
 * Conforme aux règles projet :
 * - aucun code hexadécimal, tokens NativeWind `omda-*` et `status-*` ;
 * - lisibilité forte en plein soleil (fond contrasté, texte franc) ;
 * - l’étape passée est cochée (icône `check`), l’étape courante est mise en avant.
 */
export function StepProgress({ etapeCourante }: PropsStepProgress) {
  const etapeActive =
    ETAPES_ADHESION.find((element) => element.index === etapeCourante) ?? ETAPES_ADHESION[0];

  return (
    <View
      className="mb-5 rounded-2xl border border-omda-borderGray bg-omda-white p-4"
      accessibilityRole="header"
      accessibilityLabel={`Étape ${etapeCourante} sur 7 : ${etapeActive.titreComplet}`}
    >
      {/* Barre de pastilles numérotées */}
      <View className="flex-row items-center justify-between">
        {ETAPES_ADHESION.map((etape, index) => {
          const estFaite = etape.index < etapeCourante;
          const estCourante = etape.index === etapeCourante;
          const estDerniere = index === ETAPES_ADHESION.length - 1;

          const classePastille = estFaite
            ? 'border-omda-green bg-omda-green'
            : estCourante
              ? 'border-omda-black bg-omda-black'
              : 'border-omda-borderGray bg-omda-warmGray';

          const classeTextePastille = estFaite || estCourante
            ? 'text-omda-white font-bold'
            : 'text-omda-textGray font-semibold';

          const classeTrait = estFaite
            ? 'bg-omda-green'
            : 'bg-omda-borderGray';

          return (
            <View key={etape.index} className="flex-1 flex-row items-center">
              <View
                className={`h-8 w-8 items-center justify-center rounded-full border ${classePastille}`}
              >
                {estFaite ? (
                  <Icone nom="check" taille={14} classeCouleur="text-omda-white" />
                ) : (
                  <Text className={`text-xs ${classeTextePastille}`}>{etape.index}</Text>
                )}
              </View>

              {!estDerniere ? (
                <View className={`mx-1 h-0.5 flex-1 ${classeTrait}`} />
              ) : null}
            </View>
          );
        })}
      </View>

      {/* Intitulé de l'étape courante */}
      <View className="mt-3 flex-row items-baseline justify-between">
        <Text className="text-xs font-semibold uppercase tracking-wider text-omda-textGray">
          {`Étape ${etapeCourante} sur 7`}
        </Text>
        <Text className="text-sm font-bold text-omda-black">{etapeActive.titreComplet}</Text>
      </View>
    </View>
  );
}
