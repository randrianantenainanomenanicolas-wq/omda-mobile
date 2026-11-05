import { useLocalSearchParams, router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  Button,
  DateField,
  ErrorState,
  Icone,
  InfoBanner,
  LoadingState,
  ScreenContainer,
  SelectField,
  TextField,
  type OptionSelect,
} from '../../src/components/ui';
import { useAdhesionDraft } from '../../src/context/AdhesionDraftContext';
import {
  BULLETIN_VIDE,
  CONFIG_BULLETIN_PAR_TYPE,
  ROLES_BULLETIN_SUGGERES,
  bulletinEstComplet,
  manquantsBulletin,
  type AyantDroitDeclaration,
  type BulletinDeclaration,
  type ChampBulletin,
  type TypeBulletin,
} from '../../src/models';
import { mockPublicContentService } from '../../src/services/mocks';

/**
 * Écran « Bulletin de déclaration » (formulaire natif, ÉTAPE 29C).
 *
 * Formulaire GÉNÉRIQUE piloté par la configuration `CONFIG_BULLETIN_PAR_TYPE`
 * (source unique) : le type de bulletin est déduit de la catégorie choisie, et
 * chaque champ décrit dans la configuration est rendu selon son `type`. Les 5
 * variantes détaillées (littéraire, dramatique, musical ACR/collectif,
 * audiovisuel) seront branchées en enrichissant la configuration à l'**ÉTAPE
 * 29D**, SANS retoucher cet écran.
 *
 * Le bulletin est enregistré dans le brouillon persistant (`draft.bulletins[cle]`)
 * puis l'utilisateur revient aux documents, où le bloc de l'œuvre affiche l'état
 * « à compléter / complété ».
 */
export default function BulletinScreen() {
  const { cle, titre } = useLocalSearchParams<{ cle?: string; titre?: string }>();
  const cleBulletin = (cle ?? '').trim();
  const { brouillon, definirBulletin } = useAdhesionDraft();

  const [bulletin, setBulletin] = useState<BulletinDeclaration>(BULLETIN_VIDE);
  const [champs, setChamps] = useState<readonly ChampBulletin[]>([]);
  const [etat, setEtat] = useState<'chargement' | 'erreur' | 'contenu'>('chargement');
  const [messageErreur, setMessageErreur] = useState('');
  const [tentativeEnregistrement, setTentativeEnregistrement] = useState(false);

  /* ------------------------------------ Résolution du type de bulletin */

  const chargerConfiguration = useCallback(async () => {
    setEtat('chargement');

    const initial = brouillon.bulletins[cleBulletin];
    if (initial) {
      setBulletin(initial);
    }

    const resultat = await mockPublicContentService.listerCategories();
    if (!resultat.ok) {
      setMessageErreur(resultat.erreur.message);
      setEtat('erreur');
      return;
    }
    const categorie = resultat.valeur.find((element) => element.id === brouillon.categorie_id);
    const typeBulletin: TypeBulletin = categorie?.type_bulletin ?? 'FIGURATIF_PROVISOIRE';
    setChamps(CONFIG_BULLETIN_PAR_TYPE[typeBulletin]);
    setEtat('contenu');
  }, [brouillon.bulletins, brouillon.categorie_id, cleBulletin]);

  useEffect(() => {
    void chargerConfiguration();
    // Relance uniquement au montage (reprise de la saisie du brouillon).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ------------------------------------------------- Helpers de saisie */

  const majChamp = useCallback((cleChamp: string, valeur: string | boolean) => {
    setBulletin((precedent) => ({ ...precedent, [cleChamp]: valeur }) as BulletinDeclaration);
  }, []);

  const optionsRoles: OptionSelect[] = useMemo(
    () => ROLES_BULLETIN_SUGGERES.map((role) => ({ valeur: role, libelle: role })),
    [],
  );

  const ajouterAyantDroit = useCallback(() => {
    setBulletin((precedent) => ({
      ...precedent,
      ayants_droit: [...precedent.ayants_droit, { role: '', nom: '', prenoms: '' }],
    }));
  }, []);

  const majAyantDroit = useCallback((index: number, partiel: Partial<AyantDroitDeclaration>) => {
    setBulletin((precedent) => ({
      ...precedent,
      ayants_droit: precedent.ayants_droit.map((ayant, position) =>
        position === index ? { ...ayant, ...partiel } : ayant,
      ),
    }));
  }, []);

  const retirerAyantDroit = useCallback((index: number) => {
    setBulletin((precedent) => ({
      ...precedent,
      ayants_droit: precedent.ayants_droit.filter((_, position) => position !== index),
    }));
  }, []);

  /* ------------------------------------------------------- Enregistrement */

  const complets = bulletinEstComplet(bulletin);
  const manquants = useMemo(() => manquantsBulletin(bulletin), [bulletin]);

  const enregistrer = useCallback(() => {
    setTentativeEnregistrement(true);
    // On enregistre toujours l'état courant (partiel ou complet) : le bloc de
    // l'œuvre affichera « à compléter » tant que les champs obligatoires ne
    // sont pas tous renseignés.
    if (cleBulletin) {
      void definirBulletin(cleBulletin, bulletin);
    }
    if (!bulletinEstComplet(bulletin)) {
      return;
    }
    router.back();
  }, [bulletin, cleBulletin, definirBulletin]);

  if (etat === 'chargement') {
    return (
      <ScreenContainer titre="Bulletin de déclaration" sousTitre={titre ?? "Œuvre"}>
        <LoadingState message="Chargement du formulaire du bulletin…" />
      </ScreenContainer>
    );
  }

  if (etat === 'erreur') {
    return (
      <ScreenContainer titre="Bulletin de déclaration" sousTitre={titre ?? "Œuvre"}>
        <ErrorState
          titre="Formulaire indisponible"
          message={messageErreur || 'Le référentiel des bulletins est momentanément indisponible.'}
          onReessayer={() => void chargerConfiguration()}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer titre="Bulletin de déclaration" sousTitre={titre ?? "Œuvre"}>
      <Text className="text-base text-omda-textGray">
        Renseignez le bulletin de déclaration de cette œuvre. Tous les champs
        marqués d’un astérisque sont obligatoires pour passer la vérification
        d’identité.
      </Text>

      <View className="mt-5 gap-4">
        {champs.map((champ) => {
          switch (champ.type) {
            case 'texte':
            case 'nombre':
              return (
                <TextField
                  key={champ.cle}
                  libelle={champ.libelle}
                  valeur={String((bulletin as Record<string, unknown>)[champ.cle] ?? '')}
                  obligatoire={champ.obligatoire}
                  aide={champ.aide}
                  clavier={champ.type === 'nombre' ? 'number-pad' : undefined}
                  erreur={
                    tentativeEnregistrement && champ.obligatoire
                      ? manquants.includes(champ.libelle)
                        ? 'Champ obligatoire à renseigner.'
                        : undefined
                      : undefined
                  }
                  onChangeValeur={(valeur) => majChamp(champ.cle, valeur)}
                />
              );

            case 'date':
              return (
                <DateField
                  key={champ.cle}
                  mode="date"
                  libelle={champ.libelle}
                  valeur={String((bulletin as Record<string, unknown>)[champ.cle] ?? '')}
                  obligatoire={champ.obligatoire}
                  aide={champ.aide}
                  onChangeValeur={(valeur) => majChamp(champ.cle, valeur)}
                />
              );

            case 'case':
              return (
                <Pressable
                  key={champ.cle}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: bulletin.declaration_honneur }}
                  accessibilityLabel={champ.libelle}
                  onPress={() =>
                    majChamp('declaration_honneur', !bulletin.declaration_honneur)
                  }
                  className="min-h-12 flex-row items-start rounded-xl border border-omda-borderGray bg-omda-white px-4 py-3"
                >
                  <View
                    className={`mr-3 h-6 w-6 items-center justify-center rounded border-2 ${
                      bulletin.declaration_honneur
                        ? 'border-omda-green bg-omda-green'
                        : 'border-omda-borderGray'
                    }`}
                  >
                    {bulletin.declaration_honneur ? (
                      <Icone nom="check" taille={14} classeCouleur="text-omda-white" />
                    ) : null}
                  </View>
                  <Text className="flex-1 text-base text-omda-black">
                    {champ.libelle}
                    {champ.obligatoire ? ' *' : ''}
                  </Text>
                </Pressable>
              );

            case 'liste_ayants_droit':
              return (
                <View key={champ.cle} className="gap-3">
                  <Text className="text-base font-semibold text-omda-black">
                    {champ.libelle}
                    {champ.obligatoire ? ' *' : ''}
                  </Text>
                  {champ.aide ? (
                    <Text className="text-sm text-omda-textGray">{champ.aide}</Text>
                  ) : null}

                  {bulletin.ayants_droit.map((ayant, index) => (
                    <View
                      key={index}
                      className="rounded-xl border border-omda-borderGray bg-omda-warmGray p-3"
                    >
                      <View className="flex-row items-center justify-between">
                        <Text className="text-sm font-semibold text-omda-black">
                          {`Ayant droit ${index + 1}`}
                        </Text>
                        <Button
                          libelle="Retirer"
                          variante="destructive"
                          icone="trash"
                          onPress={() => retirerAyantDroit(index)}
                        />
                      </View>

                      <View className="mt-2 gap-3">
                        <SelectField
                          libelle="Rôle"
                          options={optionsRoles}
                          valeur={ayant.role || null}
                          obligatoire
                          onChangeValeur={(valeur) => majAyantDroit(index, { role: valeur })}
                        />
                        <TextField
                          libelle="Nom"
                          valeur={ayant.nom}
                          obligatoire
                          onChangeValeur={(valeur) => majAyantDroit(index, { nom: valeur })}
                        />
                        <TextField
                          libelle="Prénoms"
                          valeur={ayant.prenoms}
                          obligatoire
                          onChangeValeur={(valeur) => majAyantDroit(index, { prenoms: valeur })}
                        />
                        <TextField
                          libelle="Numéro OMDA"
                          valeur={ayant.numero_omda ?? ''}
                          placeholder="Facultatif"
                          onChangeValeur={(valeur) => majAyantDroit(index, { numero_omda: valeur })}
                        />
                      </View>
                    </View>
                  ))}

                  <Button
                    libelle="Ajouter un ayant droit"
                    variante="secondary"
                    icone="plus"
                    onPress={ajouterAyantDroit}
                  />
                </View>
              );

            case 'edition':
              return (
                <View key={champ.cle} className="gap-3">
                  <Text className="text-base font-semibold text-omda-black">{champ.libelle}</Text>
                  <TextField
                    libelle="Contrat du"
                    valeur={bulletin.edition.contrat_du ?? ''}
                    onChangeValeur={(valeur) =>
                      setBulletin((precedent) => ({
                        ...precedent,
                        edition: { ...precedent.edition, contrat_du: valeur },
                      }))
                    }
                  />
                  <TextField
                    libelle="Valable jusqu’au"
                    valeur={bulletin.edition.valable_jusqu_au ?? ''}
                    onChangeValeur={(valeur) =>
                      setBulletin((precedent) => ({
                        ...precedent,
                        edition: { ...precedent.edition, valable_jusqu_au: valeur },
                      }))
                    }
                  />
                  <TextField
                    libelle="Territoire"
                    valeur={bulletin.edition.territoire ?? ''}
                    onChangeValeur={(valeur) =>
                      setBulletin((precedent) => ({
                        ...precedent,
                        edition: { ...precedent.edition, territoire: valeur },
                      }))
                    }
                  />
                </View>
              );

            default:
              return null;
          }
        })}
      </View>

      <View className="mt-6">
        {complets ? (
          <InfoBanner
            variante="info"
            titre="Bulletin complet"
            message="Tous les champs obligatoires sont renseignés. Vous pouvez enregistrer et revenir aux documents."
          />
        ) : (
          <InfoBanner
            variante="pending"
            titre="Bulletin à compléter"
            message={
              manquants.length > 0
                ? `Champs obligatoires restants : ${manquants.join(', ')}.`
                : 'Renseignez les champs obligatoires pour valider ce bulletin.'
            }
          />
        )}
      </View>

      <View className="mt-8 gap-3">
        <Button libelle="Enregistrer le bulletin" pleineLargeur onPress={enregistrer} />
        <Button
          libelle="Annuler et revenir"
          variante="secondary"
          pleineLargeur
          onPress={() => router.back()}
        />
      </View>
    </ScreenContainer>
  );
}
