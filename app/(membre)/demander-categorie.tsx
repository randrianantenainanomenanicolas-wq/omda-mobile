import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
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
 * États de rendu de l'écran HORS chargement : les états obligatoires `erreur`,
 * `vide` et `contenu`, plus `succes` (accusé de réception d'une demande).
 *
 * L'état `chargement` est porté par le drapeau booléen `chargement` : il est
 * désactivé dans le `finally` de la fonction de chargement, l'écran ne peut donc
 * jamais rester bloqué sur le message « Chargement… ».
 */
type EtatEcran = 'erreur' | 'vide' | 'contenu' | 'succes';

/**
 * Délai de sécurité du chargement : au-delà, la réponse est considérée perdue —
 * l'écran sort du chargement et propose « Réessayer ».
 */
const DELAI_MAX_CHARGEMENT_MS = 9000;

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
 * `mockPublicContentService.listerCategories()` — instances centralisées de la
 * couche data (`src/services/mocks`, aucune classe HTTP ni interface instanciée
 * ici ; aucune catégorie codée en dur ; les catégories déjà au profil sont
 * exclues du choix).
 * Gère obligatoirement les 4 états : `LoadingState`, `ErrorState` + « Réessayer »,
 * `EmptyState` (plus aucune catégorie disponible) et contenu normal.
 * Le choix est chargé par un `useEffect` au montage, sous try/catch/finally, avec
 * un délai de sécurité : l'écran ne peut jamais rester bloqué sur le chargement.
 */
export default function DemanderCategorieScreen() {
  const [chargement, setChargement] = useState(true);
  const [etat, setEtat] = useState<EtatEcran>('vide');
  const [messageErreur, setMessageErreur] = useState('');
  const [options, setOptions] = useState<OptionSelect[]>([]);
  const [libellesDejaPresents, setLibellesDejaPresents] = useState<string[]>([]);
  const [categorieSelectionnee, setCategorieSelectionnee] = useState<string | null>(null);
  const [erreurSelection, setErreurSelection] = useState<string | undefined>(undefined);
  const [envoiEnCours, setEnvoiEnCours] = useState(false);
  const [erreurEnvoi, setErreurEnvoi] = useState<string | null>(null);
  const [libelleDemande, setLibelleDemande] = useState('');

  /**
   * Charge le choix proposé : catégories déjà rattachées au profil
   * (`listerCategoriesMembre`) et catégories actives du référentiel public
   * (`listerCategories`), toutes deux fournies par les mocks centralisés.
   *
   * `setChargement(false)` est appelé dans le `finally` : l'écran sort donc
   * TOUJOURS du chargement, qu'il réussisse, qu'il échoue, qu'une exception
   * survienne ou que le délai de sécurité soit dépassé.
   */
  const chargerChoix = useCallback(async () => {
    setChargement(true);
    setMessageErreur('');
    setErreurSelection(undefined);
    setCategorieSelectionnee(null);
    setErreurEnvoi(null);

    let minuteurSecurite: ReturnType<typeof setTimeout> | null = null;

    try {
      const reponses = await Promise.race([
        Promise.all([
          mockMemberRepository.listerCategoriesMembre(),
          mockPublicContentService.listerCategories(),
        ]),
        new Promise<null>((resoudre) => {
          minuteurSecurite = setTimeout(() => resoudre(null), DELAI_MAX_CHARGEMENT_MS);
        }),
      ]);

      if (reponses === null) {
        setMessageErreur(
          'Délai dépassé : le serveur OMDA met trop de temps à répondre. Vérifiez votre connexion Internet puis réessayez.',
        );
        setEtat('erreur');
        return;
      }

      const [appartenances, categoriesActives] = reponses;

      if (!appartenances.ok) {
        setMessageErreur(traduireErreur(appartenances.erreur));
        setEtat('erreur');
        return;
      }
      if (!categoriesActives.ok) {
        setMessageErreur(traduireErreur(categoriesActives.erreur));
        setEtat('erreur');
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
    } catch {
      setMessageErreur(
        'Une erreur inattendue est survenue pendant le chargement des catégories. Veuillez réessayer dans quelques instants.',
      );
      setEtat('erreur');
    } finally {
      if (minuteurSecurite) {
        clearTimeout(minuteurSecurite);
      }
      setChargement(false);
    }
  }, []);

  /**
   * Chargement initial du choix : sans cet appel, l'écran resterait bloqué sur
   * « Chargement des catégories disponibles… ».
   */
  useEffect(() => {
    void chargerChoix();
  }, [chargerChoix]);

  const envoyerDemande = useCallback(async () => {
    if (!categorieSelectionnee) {
      setErreurSelection('Sélectionnez la catégorie que vous souhaitez ajouter.');
      return;
    }

    setEnvoiEnCours(true);
    setErreurEnvoi(null);

    try {
      const resultat = await mockMemberRepository.demanderCategorieSupplementaire(
        categorieSelectionnee,
      );

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
    } catch {
      setErreurEnvoi(
        'Une erreur inattendue est survenue pendant l’envoi de votre demande. Veuillez réessayer dans quelques instants.',
      );
    } finally {
      // Le bouton ne doit jamais rester bloqué sur son indicateur de chargement.
      setEnvoiEnCours(false);
    }
  }, [chargerChoix, categorieSelectionnee, options]);

  const retourProfil = useCallback(() => {
    if (router.canGoBack()) {
      router.back();
      return;
    }
    router.replace('/(membre)/(tabs)/profil');
  }, []);

  if (chargement) {
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
