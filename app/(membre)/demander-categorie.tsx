import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  EmptyState,
  ErrorState,
  InfoBanner,
  LoadingState,
  ScreenContainer,
  SelectField,
  StatusPill,
  type OptionSelect,
} from '../../src/components/ui';
import type { Categorie } from '../../src/models';
import type { ErreurApp } from '../../src/services/contracts';
import { mockMemberRepository, mockPublicContentService } from '../../src/services/mocks';

/**
 * États de l'écran : les 4 états obligatoires (`chargement`, `erreur`,
 * `vide`, `contenu`) + `succes` (accusé de réception d'une demande).
 */
type EtatEcran = 'chargement' | 'erreur' | 'vide' | 'contenu' | 'succes';

/** Message compréhensible selon la famille d'erreur (`Result`). */
function traduireErreur(erreur: ErreurApp): string {
  if (erreur.type === 'metier') return erreur.message;
  if (erreur.type === 'reseau') {
    return 'Impossible de joindre le serveur OMDA. Vérifiez votre connexion Internet puis réessayez.';
  }
  return 'Les catégories sont momentanément indisponibles. Veuillez réessayer dans quelques instants.';
}

/**
 * Demande de catégorie supplémentaire (règle métier 9) — écran HORS onglets,
 * atteint depuis la section « Mes catégories » du Profil.
 *
 * Le membre choisit une catégorie ACTIVE qui ne figure pas encore dans son
 * profil (aucun statut) : la demande est créée au statut `EN_ATTENTE` et seule
 * la décision d'un agent OMDA l'activera — jamais de validation immédiate,
 * aucun paiement.
 *
 * Données : `mockMemberRepository.listerCategoriesMembre()` et
 * `mockPublicContentService.listerCategories()` (aucune catégorie codée en dur ;
 * les catégories déjà au profil sont exclues du choix).
 * Gère obligatoirement les 4 états : `LoadingState`, `ErrorState` + « Réessayer »,
 * `EmptyState` (plus aucune catégorie disponible) et contenu normal.
 */
export default function DemanderCategorieScreen() {
  const [etat, setEtat] = useState<EtatEcran>('chargement');
  const [messageErreur, setMessageErreur] = useState('');
  const [options, setOptions] = useState<OptionSelect[]>([]);
  const [libellesDejaPresents, setLibellesDejaPresents] = useState<string[]>([]);
  const [categorieSelectionnee, setCategorieSelectionnee] = useState<string | null>(null);
  const [erreurSelection, setErreurSelection] = useState<string | undefined>(undefined);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const [libelleDemande, setLibelleDemande] = useState('');

  const chargerChoix = useCallback(async () => {
    setEtat('chargement');
    setMessageErreur('');
    setErreurSelection(undefined);
    setCategorieSelectionnee(null);
    setErreurEnvoi(null);

    const [appartenances, categoriesActives] = await Promise.all([
      mockMemberRepository.listerCategoriesMembre(),
      mockPublicContentService.listerCategories(),
    ]);

    if (!appartenances.ok) {
      setEtat('erreur');
      setMessageErreur(traduireErreur(appartenances.erreur));
      return;
    }
    if (!categoriesActives.ok) {
      setEtat('erreur');
      setMessageErreur(traduireErreur(categoriesActives.erreur));
      return;
    }

    // Déjà présentes au profil (tout statut) ⇒ jamais proposées à nouveau.
    const dejaRattachees = new Set(
      appartenances.valeur.membre_categories.map((appartenance) => appartenance.categorie_id),
    );
    const disponibles: Categorie[] = categoriesActives.valeur.filter(
      (categorie) => !dejaRattachees.has(categorie.id),
    );

    setOptions(
      disponibles.map((categorie) => ({
        valeur: categorie.id,
        libelle: categorie.libelle,
        description: categorie.description ?? undefined,
      })),
    );
    setLibellesDejaPresents(
      appartenances.valeur.categories.map((categorie) => categorie.libelle),
    );
    setEtat(disponibles.length === 0 ? 'vide' : 'contenu');
  }, []);

  const envoyerDemande = useCallback(async () => {
    if (!categorieSelectionnee) {
      setErreurSelection('Sélectionnez la catégorie que vous souhaitez ajouter.');
      return;
    }

    setEnvoiEnCours(true);
    setErreurEnvoi(null);

    const resultat = await mockMemberRepository.demanderCategorieSupplementaire(
      categorieSelectionnee,
    );

    setEnvoiEnCours(false);

    if (!resultat.ok) {
      if (resultat.erreur.type === 'metier' && resultat.erreur.code.startsWith('CATEGORIE_')) {
        // Liste périmée (catégorie déjà ajoutée entre-temps) : on resynchronise
        // l'écran avec l'état du serveur plutôt que de proposer un renvoi voué à
        // échouer — la catégorie demandée disparaît alors du choix proposé.
        await chargerChoix();
        return;
      }
      setErreurEnvoi(traduireErreur(resultat.erreur));
      return;
    }

    setLibelleDemande(
      options.find((option) => option.valeur === categorieSelectionnee)?.libelle ?? '',
    );
    setEtat('succes');
  }, [chargerChoix, categorieSelectionnee, options]);

  const retourProfil = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(membre)/(tabs)/profil');
  }, []);

  if (etat === 'chargement') {
    return (
      <ScreenContainer titre="Demander une catégorie" sousTitre="Mes catégories">
        <LoadingState message="Chargement des catégories disponibles…" />
      </ScreenContainer>
    );
  }

  if (etat === 'erreur') {
    return (
      <ScreenContainer titre="Demander une catégorie" sousTitre="Mes catégories">
        <ErrorState
          titre="Catégories indisponibles"
          message={messageErreur}
          onReessayer={() => void chargerChoix()}
        />
      </ScreenContainer>
    );
  }

  if (etat === 'succes') {
    return (
      <ScreenContainer titre="Demander une catégorie" sousTitre="Mes catégories">
        <InfoBanner
          variante="success"
          titre="Demande transmise"
          message={`Votre demande pour la catégorie « ${libelleDemande} » a bien été envoyée. Elle apparaît dans votre profil sous le statut « Demande en attente ».`}
        />

        <View className="mt-5 w-full rounded-2xl border border-omda-borderGray bg-omda-white p-5">
          <Text className="text-base font-semibold text-omda-black">{libelleDemande}</Text>

          <View className="mt-3">
            <StatusPill statut="pending" libelle="Demande en attente" />
          </View>

          <Text className="mt-3 text-sm text-omda-textGray">
            Rien à faire de votre côté : un agent OMDA examinera votre demande.
            La catégorie sera activée après sa décision — elle n’est pas encore
            utilisable en l’état.
          </Text>
        </View>

        <View className="mt-5 gap-3">
          <Button libelle="Retour à mon profil" icone="user" pleineLargeur onPress={retourProfil} />
          <Button
            libelle="Demander une autre catégorie"
            variante="secondary"
            pleineLargeur
            onPress={() => void chargerChoix()}
          />
        </View>
      </ScreenContainer>
    );
  }

  return (
    <ScreenContainer titre="Demander une catégorie" sousTitre="Mes catégories">
      <InfoBanner
        variante="info"
        titre="Comment cela fonctionne"
        message="Choisissez une catégorie à ajouter à votre profil : votre demande est transmise à l’équipe OMDA et reste « en attente » jusqu’à la décision d’un agent. Aucun paiement n’est requis et aucune catégorie n’est activée automatiquement."
      />

      {etat === 'vide' ? (
        <View className="mt-5">
          <EmptyState
            titre="Aucune catégorie supplémentaire disponible"
            message="Toutes les catégories actives sont déjà associées à votre profil. Contactez l’OMDA si vous pensez qu’une catégorie manque."
            icone="layer-group"
            actionLibelle="Actualiser"
            onAction={() => void chargerChoix()}
          />
        </View>
      ) : (
        <View className="mt-5 w-full rounded-2xl border border-omda-borderGray bg-omda-white p-5">
          {libellesDejaPresents.length > 0 ? (
            <Text className="text-sm text-omda-textGray">
              Déjà dans votre profil : {libellesDejaPresents.join(', ')}.
            </Text>
          ) : null}

          <View className={libellesDejaPresents.length > 0 ? 'mt-4' : undefined}>
            <SelectField
              libelle="Catégorie souhaitée"
              options={options}
              valeur={categorieSelectionnee}
              onChangeValeur={(valeur) => {
                setCategorieSelectionnee(valeur);
                setErreurSelection(undefined);
                setErreurEnvoi(null);
              }}
              placeholder="Sélectionnez une catégorie"
              aide="Seules les catégories actives non déjà associées à votre profil sont proposées."
              erreur={erreurSelection}
              obligatoire
            />
          </View>

          {erreurEnvoi ? (
            <View className="mt-4">
              <InfoBanner
                variante="error"
                titre="Envoi impossible"
                message={erreurEnvoi}
                actionLibelle="Réessayer"
                onAction={() => void envoyerDemande()}
              />
            </View>
          ) : null}

          <View className="mt-5">
            <Button
              libelle="Envoyer la demande"
              icone="paper-plane"
              pleineLargeur
              chargement={envoiEnCours}
              desactive={envoiEnCours}
              onPress={() => void envoyerDemande()}
            />
          </View>
        </View>
      )}

      <View className="mt-5">
        <Button
          libelle="Retour à mon profil"
          variante="secondary"
          pleineLargeur
          desactive={envoiEnCours}
          onPress={retourProfil}
        />
      </View>
    </ScreenContainer>
  );
}
