import { router } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';

import {
  Button,
  ErrorState,
  Icone,
  LoadingState,
  ScreenContainer,
  StepProgress,
  TextField,
} from '../../src/components/ui';
import { useAdhesionDraft } from '../../src/context/AdhesionDraftContext';
import { mockPublicContentService } from '../../src/services/mocks';
import { aujourdhuiLocal, formaterJJ_MM_AAAA, versAAAA_MM_JJ } from '../../src/utils/dates';

/**
 * Étape 4 — Engagement sur l'honneur (règle 3, `docs/FORMULAIRES.md` §1 et
 * `docs/texte-engagement-malgache.md`).
 *
 * Le texte d'engagement malgache est SERVI PAR LE SERVICE (mock puis Supabase
 * plus tard) avec ses 3 variables remplies : `nom_prenoms`, `categorie`,
 * `date_du_jour`. Le reste du texte est recopié tel quel, sans correction,
 * traduction ni reformulation.
 *
 * L'écran collecte 4 valeurs (toutes enregistrées dans le brouillon local) :
 * - `accepte` : case « Déclaration sur l'honneur » cochée (obligatoire) ;
 * - `mention_saisie` : mention « voavaky sy ankatoavina » SAISIE par l'auteur
 *   (obligatoire, règle 3 : pas de signature manuscrite, pas de signature
 *   papier en agence) ;
 * - `lieu` : lieu de l'engagement SAISI (distinct de la ville « Antananarivo »
 *   présente en dur dans le texte source) ;
 * - `date_jour` : date du jour de l'acceptation, en LECTURE SEULE — elle est
 *   calculée automatiquement (`aujourdhuiLocal()`) et n'est JAMAIS éditable ;
 *   `DateField` n'est pas utilisé ici puisque le champ n'est pas modifiable.
 *
 * 4 états : chargement (texte servi), erreur (panne du service), normal,
 * désactivé (soumission en cours).
 */
export default function EngagementScreen() {
  const { brouillon, mettreAJourEngagement } = useAdhesionDraft();
  const engagement = brouillon.engagement;

  const [texte, setTexte] = useState<string>('');
  const [etat, setEtat] = useState<'chargement' | 'erreur' | 'pret'>('chargement');
  const [messageErreur, setMessageErreur] = useState<string>('');
  const [tentativeSoumission, setTentativeSoumission] = useState(false);

  // Date du jour : calculée UNE fois au montage, jamais modifiable ensuite.
  const dateDuJourAAAA_MM_JJ = useMemo(() => versAAAA_MM_JJ(aujourdhuiLocal()), []);
  const dateDuJourJJ_MM_AAAA = useMemo(
    () => formaterJJ_MM_AAAA(aujourdhuiLocal()),
    [],
  );

  // Libellé de la catégorie choisie (pour la variable `{{categorie}}`).
  const [libelleCategorie, setLibelleCategorie] = useState<string>('');

  const chargerTexte = useCallback(async () => {
    setEtat('chargement');
    const categoriesRes = await mockPublicContentService.listerCategories();
    const categorieTrouvee = categoriesRes.ok
      ? categoriesRes.valeur.find((c) => c.id === brouillon.categorie_id) ?? null
      : null;
    const categorie = categorieTrouvee?.libelle ?? '';
    setLibelleCategorie(categorie);

    const nomPrenoms = `${brouillon.identite.nom.trim()} ${brouillon.identite.prenom.trim()}`.trim();
    const res = await mockPublicContentService.obtenirTexteEngagement({
      nom_prenoms: nomPrenoms,
      categorie,
      date_du_jour: dateDuJourJJ_MM_AAAA,
    });
    if (res.ok) {
      setTexte(res.valeur.texte);
      setEtat('pret');
      // Date et lieu restent enregistrés dans le brouillon ; on verrouille
      // la date à chaque chargement de l'écran (elle ne doit jamais être
      // modifiable par l'utilisateur).
      void mettreAJourEngagement({ date_jour: dateDuJourAAAA_MM_JJ });
    } else {
      setMessageErreur(res.erreur.message);
      setEtat('erreur');
    }
  }, [
    brouillon.categorie_id,
    brouillon.identite.nom,
    brouillon.identite.prenom,
    dateDuJourAAAA_MM_JJ,
    dateDuJourJJ_MM_AAAA,
    mettreAJourEngagement,
  ]);

  useEffect(() => {
    void chargerTexte();
    // Relance uniquement au montage : le texte ne doit pas se recalculer à
    // chaque frappe dans les champs identité du brouillon.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const validerMention = (val: string) =>
    !val.trim()
      ? 'La mention « voavaky sy ankatoavina » doit être saisie par l’auteur.'
      : undefined;
  const validerLieu = (val: string) =>
    !val.trim() ? 'Le lieu de l’engagement est obligatoire.' : undefined;

  const erreurMention = tentativeSoumission ? validerMention(engagement.mention_saisie) : undefined;
  const erreurLieu = tentativeSoumission ? validerLieu(engagement.lieu) : undefined;
  const erreurAcceptation = tentativeSoumission && !engagement.accepte
    ? 'Vous devez cocher la déclaration sur l’honneur pour continuer.'
    : undefined;

  const continuer = useCallback(() => {
    setTentativeSoumission(true);
    if (!engagement.accepte) return;
    if (validerMention(engagement.mention_saisie)) return;
    if (validerLieu(engagement.lieu)) return;
    // La date reste verrouillée à la date du jour de l'acceptation.
    void mettreAJourEngagement({ date_jour: dateDuJourAAAA_MM_JJ });
    router.push('/(adhesion)/recapitulatif');
  }, [
    dateDuJourAAAA_MM_JJ,
    engagement.accepte,
    engagement.lieu,
    engagement.mention_saisie,
    mettreAJourEngagement,
  ]);

  if (etat === 'chargement') {
    return (
      <ScreenContainer titre="Engagement" sousTitre="Demande d’adhésion">
        <StepProgress etapeCourante={4} />
        <LoadingState message="Chargement du texte d’engagement…" />
      </ScreenContainer>
    );
  }

  if (etat === 'erreur') {
    return (
      <ScreenContainer titre="Engagement" sousTitre="Demande d’adhésion">
        <StepProgress etapeCourante={4} />
        <ErrorState
          message={messageErreur || 'Le texte d’engagement est indisponible.'}
          onReessayer={() => void chargerTexte()}
        />
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer titre="Engagement" sousTitre="Demande d’adhésion">
      <StepProgress etapeCourante={4} />

      <Text className="text-base text-omda-textGray">
        Le texte ci-dessous est servi par le service OMDA, dans la version
        d’origine en malgache, sans reformulation. Les 3 blancs sont renseignés
        automatiquement : votre nom et prénoms, la catégorie choisie
        {libelleCategorie ? ` (${libelleCategorie})` : ''}, la date du jour.
      </Text>

      <View className="mt-4 rounded-xl border border-omda-borderGray bg-omda-warmGray p-4">
        <Text className="text-base leading-6 text-omda-black" selectable>
          {texte}
        </Text>
      </View>

      <View className="mt-5 gap-4">
        <TextField
          libelle="Mention « voavaky sy ankatoavina »"
          valeur={engagement.mention_saisie}
          placeholder="Recopiez la mention en malgache"
          aide="Saisie manuelle par l’auteur : remplace la signature manuscrite (règle 3)."
          multiligne
          obligatoire
          erreur={erreurMention}
          onChangeValeur={(val) => void mettreAJourEngagement({ mention_saisie: val })}
        />

        <TextField
          libelle="Lieu de l’engagement"
          valeur={engagement.lieu}
          placeholder="Ex. Antananarivo"
          aide="Saisi séparément : le texte servi conserve « Antananarivo » tel que dans la fiche de référence."
          obligatoire
          erreur={erreurLieu}
          onChangeValeur={(val) => void mettreAJourEngagement({ lieu: val })}
        />

        {/* Date du jour : LECTURE SEULE, jamais modifiable (règle étape 29).
            `DateField` n'est pas utilisé : le champ ne doit pas être tactile. */}
        <View className="rounded-xl border border-omda-borderGray bg-omda-warmGray px-4 py-3">
          <Text className="text-sm font-semibold text-omda-black">
            Date de l’engagement
          </Text>
          <Text className="mt-1 text-base text-omda-black">{dateDuJourJJ_MM_AAAA}</Text>
          <Text className="mt-1 text-xs text-omda-textGray">
            Date du jour de l’acceptation, calculée automatiquement, non modifiable.
          </Text>
        </View>

        {/* Case « Déclaration sur l'honneur » — acceptation obligatoire. */}
        <Pressable
          accessibilityRole="checkbox"
          accessibilityState={{ checked: engagement.accepte }}
          accessibilityLabel="Déclaration sur l’honneur"
          onPress={() => void mettreAJourEngagement({ accepte: !engagement.accepte })}
          className="min-h-12 flex-row items-start rounded-xl border border-omda-borderGray bg-omda-white px-4 py-3"
        >
          <View
            className={`mr-3 h-6 w-6 items-center justify-center rounded border-2 ${
              engagement.accepte ? 'border-omda-green bg-omda-green' : 'border-omda-borderGray'
            }`}
          >
            {engagement.accepte ? (
              <Icone nom="check" taille={14} classeCouleur="text-omda-white" />
            ) : null}
          </View>
          <Text className="flex-1 text-base text-omda-black">
            Je déclare sur l’honneur que les informations saisies sont exactes
            et j’accepte l’engagement ci-dessus. *
          </Text>
        </Pressable>
        {erreurAcceptation ? (
          <View className="flex-row items-start">
            <Icone nom="circle-xmark" taille={14} classeCouleur="text-status-error" />
            <Text className="ml-2 flex-1 text-sm text-status-error">{erreurAcceptation}</Text>
          </View>
        ) : null}
      </View>

      <View className="mt-8 gap-3">
        <Button libelle="Continuer vers le récapitulatif" pleineLargeur onPress={continuer} />
        <Button
          libelle="Retour aux documents"
          variante="secondary"
          pleineLargeur
          onPress={() => router.back()}
        />
      </View>
    </ScreenContainer>
  );
}
