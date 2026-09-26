import type { Categorie, Cotisation, Membre, MembreCategorie, Notification, Oeuvre, Paiement, UUID, Utilisateur } from '../../models';
import { CODE_DEVISE_MGA } from '../../models';
import type {
  CategoriesMembre,
  CreerOeuvreEntree,
  FichierTeleverse,
  InitierPaiementMembreEntree,
  ListerCotisationsEntree,
  ListerNotificationsEntree,
  ListerOeuvresEntree,
  MemberRepository,
  MettreAJourOeuvreEntree,
  MiseAJourProfilEntree,
  OptionsTeleversement,
  ProfilMembre,
  SoumettreOeuvreEntree,
  TableauDeBordEntree,
  TableauDeBordMembre,
  TeleversementEntree,
} from '../contracts';
import {
  CODES_ERREUR_CANDIDAT,
  CODES_ERREUR_MEMBRE,
  erreurMetier,
  ok,
  type Result,
  type ResultErr,
} from '../contracts';
import { CATEGORIES_TEST, tarifApplique } from './donneesTestMock';
import {
  ajouterAppartenanceCategorie,
  appliquerEffetsPaiementReussi,
  avancerPaiement,
  candidatParUtilisateur,
  categoriesDuMembre,
  CODES_MOCK,
  cotisationsDuMembre,
  cotisationsMock,
  estOperateurActif,
  genererUUID,
  membreCourant,
  maintenantISO,
  notificationsDeUtilisateur,
  notificationsMock,
  nouvelleReferencePaiement,
  oeuvresDuMembre,
  oeuvresMock,
  paiementMembrePublic,
  type PaiementMembreInterne,
  paiementsMembreMock,
  preparerAppelMock,
  prochainIdentifiantOeuvre,
  refusMock,
  simulerTeleversement,
  utilisateurCourant,
} from './etatMock';

/** Contexte de la session membre (utilisateur + profil adhérent). */
type ContexteMembre = { utilisateur: Utilisateur; membre: Membre };

/** Contexte courant, ou `null` si personne n'est connecté. */
function contexteMembre(): ContexteMembre | null {
  const utilisateur = utilisateurCourant();
  const membre = membreCourant();
  if (!utilisateur || !membre) {
    return null;
  }
  return { utilisateur, membre };
}

/** Refus métier standard lorsqu'aucune session n'est ouverte. */
function sessionRequise(): ResultErr {
  return erreurMetier(
    CODES_ERREUR_MEMBRE.NON_AUTHENTIFIE,
    'Vous devez être connecté pour accéder à cette information.',
  );
}

/** Catégories du membre (référentiel + statut de chaque appartenance) d'un contexte. */
function categoriesDepuisContexte(contexte: ContexteMembre): CategoriesMembre {
  const appartenances = categoriesDuMembre(contexte.membre.id);
  const categories = appartenances
    .map(
      (appartenance) =>
        CATEGORIES_TEST.find((categorie) => categorie.id === appartenance.categorie_id) ?? null,
    )
    .filter((categorie): categorie is Categorie => categorie !== null);

  return {
    categories,
    membre_categories: appartenances,
  };
}

/** Profil complet (utilisateur + membre + catégories) d'un contexte donné. */
function profilDepuisContexte(contexte: ContexteMembre): ProfilMembre {
  return {
    utilisateur: contexte.utilisateur,
    membre: contexte.membre,
    ...categoriesDepuisContexte(contexte),
  };
}

/**
 * `MemberRepository` simulé (Supabase côté réel : Auth + Postgres + Storage).
 *
 * ⚠️ Règles métier simulées :
 * - aucune session ⇒ `NON_AUTHENTIFIE` (comme un refus RLS) ;
 * - paiement d'un dépôt possible UNIQUEMENT si l'œuvre est `VALIDEE` ;
 * - cotisation payable seulement si `NON_PAYEE` ;
 * - le paiement ne passe à `REUSSI` que par la « confirmation serveur »
 *   (machine à états partagée), puis les effets sont appliqués côté serveur
 *   (cotisation `PAYEE`, œuvre `DEPOT_FINALISE`, notification créée).
 */
export class MockMemberRepository implements MemberRepository {
  /* ------------------------------------------------------------ Profil (U) */

  /** Profil : informations modifiables vs lecture seule (`ProfilMembre`). */
  async obtenirProfil(): Promise<Result<ProfilMembre>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }
    return ok(profilDepuisContexte(contexte));
  }

  /** Catégories du membre : référentiel du profil + statut de chaque appartenance. */
  async listerCategoriesMembre(): Promise<Result<CategoriesMembre>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }
    return ok(categoriesDepuisContexte(contexte));
  }

  /**
   * Demande de catégorie supplémentaire (règle métier 9) : la catégorie doit
   * être active au référentiel et ne pas déjà figurer au profil (dans aucun
   * statut). L'appartenance est créée au statut `EN_ATTENTE` : seul un agent
   * OMDA décidera de son activation (aucune validation locale).
   */
  async demanderCategorieSupplementaire(categorie_id: UUID): Promise<Result<MembreCategorie>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const categorie = CATEGORIES_TEST.find(
      (element) => element.id === categorie_id && element.actif,
    );
    if (!categorie) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.CATEGORIE_INDISPONIBLE,
        'Cette catégorie n’est pas proposée actuellement.',
      );
    }

    const existante = categoriesDuMembre(contexte.membre.id).find(
      (appartenance) => appartenance.categorie_id === categorie_id,
    );
    if (existante) {
      return existante.statut === 'EN_ATTENTE'
        ? erreurMetier(
            CODES_ERREUR_MEMBRE.CATEGORIE_DEJA_DEMANDEE,
            'Une demande est déjà en attente pour cette catégorie.',
          )
        : erreurMetier(
            CODES_ERREUR_MEMBRE.CATEGORIE_DEJA_ENREGISTREE,
            'Cette catégorie figure déjà dans votre profil.',
          );
    }

    return ok(
      ajouterAppartenanceCategorie({
        membre_id: contexte.membre.id,
        categorie_id,
        statut: 'EN_ATTENTE',
      }),
    );
  }

  /** Seul le téléphone est modifiable par le membre (le reste vient du dossier). */
  async mettreAJourProfil(entree: MiseAJourProfilEntree): Promise<Result<ProfilMembre>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    if (entree.telephone !== undefined) {
      contexte.utilisateur.telephone = entree.telephone;
      contexte.utilisateur.updated_at = maintenantISO();
    }
    return ok(profilDepuisContexte(contexte));
  }

  /* --------------------------------------------------- Accueil membre (P) */

  /** Compteurs de l'accueil : œuvres, cotisation de l'année, notifications non lues. */
  async obtenirTableauDeBord(entree?: TableauDeBordEntree): Promise<Result<TableauDeBordMembre>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const annee = entree?.annee ?? new Date().getFullYear();
    const oeuvres = oeuvresDuMembre(contexte.membre.id);
    const cotisation =
      cotisationsMock.find(
        (element) => element.membre_id === contexte.membre.id && element.annee === annee,
      ) ?? null;
    const notifications = notificationsDeUtilisateur(contexte.utilisateur.id);
    const candidat = candidatParUtilisateur(contexte.utilisateur.id);

    return ok({
      prenom: candidat ? candidat.prenom : contexte.utilisateur.email,
      numero_adherent: contexte.membre.numero_adherent,
      statut_compte: contexte.membre.statut,
      nombre_oeuvres: oeuvres.length,
      cotisation_annee: cotisation,
      notifications_non_lues: notifications.filter((element) => !element.lue).length,
    });
  }

  /* ------------------------------------------------------- Œuvres (Q, R, S) */

  /** Liste des œuvres du membre (filtrable par statut) ; vide si aucune œuvre. */
  async listerOeuvres(entree?: ListerOeuvresEntree): Promise<Result<Oeuvre[]>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const oeuvres = oeuvresDuMembre(contexte.membre.id);
    if (!entree?.statut) {
      return ok(oeuvres);
    }
    return ok(oeuvres.filter((oeuvre) => oeuvre.statut === entree.statut));
  }

  /** Détail d'une œuvre du membre (motif de rejet éventuel). */
  async obtenirOeuvre(oeuvre_id: UUID): Promise<Result<Oeuvre>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const oeuvre = oeuvresMock.find(
      (element) => element.id === oeuvre_id && element.membre_id === contexte.membre.id,
    );
    if (!oeuvre) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.OEUVRE_INTROUVABLE,
        'Cette œuvre est introuvable.',
      );
    }
    return ok(oeuvre);
  }

  /** Crée un brouillon d'œuvre : aucun envoi, aucun paiement (règle métier 4). */
  async creerOeuvre(entree: CreerOeuvreEntree): Promise<Result<Oeuvre>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const maintenant = maintenantISO();
    const oeuvre: Oeuvre = {
      id: prochainIdentifiantOeuvre(),
      membre_id: contexte.membre.id,
      demande_adhesion_id: null,
      categorie_id: entree.categorie_id,
      titre: entree.titre.trim(),
      description: entree.description ?? null,
      annee: entree.annee ?? null,
      statut: 'BROUILLON',
      motif_rejet: null,
      chemin_fichier: null,
      mime_type: null,
      taille_octets: null,
      date_soumission: null,
      date_decision: null,
      agent_id: null,
      created_at: maintenant,
      updated_at: maintenant,
    };
    oeuvresMock.push(oeuvre);
    return ok(oeuvre);
  }

  /** Modifie un brouillon ; une œuvre déjà envoyée n'est plus modifiable. */
  async mettreAJourOeuvre(
    oeuvre_id: UUID,
    entree: MettreAJourOeuvreEntree,
  ): Promise<Result<Oeuvre>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const oeuvre = oeuvresMock.find(
      (element) => element.id === oeuvre_id && element.membre_id === contexte.membre.id,
    );
    if (!oeuvre) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.OEUVRE_INTROUVABLE,
        'Cette œuvre est introuvable.',
      );
    }
    if (oeuvre.statut !== 'BROUILLON') {
      return refusMock(
        CODES_MOCK.OEUVRE_NON_MODIFIABLE,
        'Cette œuvre a déjà été envoyée : elle n’est plus modifiable.',
      );
    }

    if (entree.titre !== undefined) {
      oeuvre.titre = entree.titre.trim();
    }
    if (entree.categorie_id !== undefined) {
      oeuvre.categorie_id = entree.categorie_id;
    }
    if (entree.description !== undefined) {
      oeuvre.description = entree.description;
    }
    if (entree.annee !== undefined) {
      oeuvre.annee = entree.annee;
    }
    oeuvre.updated_at = maintenantISO();
    return ok(oeuvre);
  }

  /**
   * Envoie l'œuvre (`ENVOYEE`) avec son fichier et au moins une attestation.
   * ⚠️ Aucun paiement n'est déclenché à l'envoi : le paiement des frais de
   * dépôt n'est proposé qu'après `VALIDEE`.
   */
  async soumettreOeuvre(entree: SoumettreOeuvreEntree): Promise<Result<Oeuvre>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const oeuvre = oeuvresMock.find(
      (element) => element.id === entree.oeuvre_id && element.membre_id === contexte.membre.id,
    );
    if (!oeuvre) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.OEUVRE_INTROUVABLE,
        'Cette œuvre est introuvable.',
      );
    }
    if (oeuvre.statut !== 'BROUILLON') {
      return refusMock(
        CODES_MOCK.OEUVRE_NON_MODIFIABLE,
        'Cette œuvre a déjà été envoyée : vous pouvez suivre son état.',
      );
    }
    if (entree.attestations.length === 0) {
      return erreurMetier(
        CODES_ERREUR_CANDIDAT.DOSSIER_INCOMPLET,
        'Joignez au moins une attestation de diffusion avant d’envoyer l’œuvre.',
      );
    }

    const dateSoumission = maintenantISO();
    oeuvre.chemin_fichier = entree.fichier.chemin_stockage;
    oeuvre.mime_type = entree.fichier.mime_type;
    oeuvre.taille_octets = entree.fichier.taille_octets;
    oeuvre.statut = 'ENVOYEE';
    oeuvre.date_soumission = dateSoumission;
    oeuvre.updated_at = dateSoumission;
    return ok(oeuvre);
  }

  /** Téléversement (bucket `oeuvres` ou `pieces`) : progression, retry, 20 Mo max. */
  async televerserFichier(
    entree: TeleversementEntree,
    options?: OptionsTeleversement,
  ): Promise<Result<FichierTeleverse>> {
    return simulerTeleversement(entree, options);
  }

  /* ------------------------------------------------------- Cotisations (T) */

  /** Cotisations du membre (année décroissante) ; vide si aucune. */
  async listerCotisations(entree?: ListerCotisationsEntree): Promise<Result<Cotisation[]>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const cotisations = cotisationsDuMembre(contexte.membre.id);
    if (entree?.annee === undefined) {
      return ok(cotisations);
    }
    return ok(cotisations.filter((cotisation) => cotisation.annee === entree.annee));
  }

  /** Cotisation d'une année donnée. */
  async obtenirCotisation(annee: number): Promise<Result<Cotisation>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const cotisation = cotisationsMock.find(
      (element) => element.membre_id === contexte.membre.id && element.annee === annee,
    );
    if (!cotisation) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.COTISATION_INTROUVABLE,
        `Aucune cotisation n’est enregistrée pour l’année ${annee}.`,
      );
    }
    return ok(cotisation);
  }

  /* ------------------------------------------------------- Paiements (S, T) */

  /**
   * Initie un paiement de membre (dépôt d'œuvre `VALIDEE` ou cotisation due).
   * ⚠️ Le statut renvoyé n'est jamais `REUSSI` : la confirmation vient du
   * serveur (polling via `obtenirPaiement`).
   */
  async initierPaiement(entree: InitierPaiementMembreEntree): Promise<Result<Paiement>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const mobileMoney = entree.mode === 'MOBILE_MONEY';
    if (mobileMoney) {
      if (!entree.operateur || !estOperateurActif(entree.operateur)) {
        return erreurMetier(
          CODES_ERREUR_MEMBRE.OPERATEUR_INDISPONIBLE,
          'Cet opérateur Mobile Money est momentanément indisponible.',
        );
      }
      if (!entree.numero_telephone || !entree.numero_telephone.startsWith('+261')) {
        return refusMock(
          CODES_MOCK.NUMERO_TELEPHONE_INVALIDE,
          'Indiquez un numéro Mobile Money au format +261…',
        );
      }
    }

    let montant = 0;
    let oeuvreId: UUID | null = null;
    let cotisationId: UUID | null = null;

    if (entree.type === 'DEPOT_OEUVRE') {
      const oeuvre = oeuvresMock.find(
        (element) => element.id === entree.oeuvre_id && element.membre_id === contexte.membre.id,
      );
      if (!oeuvre) {
        return erreurMetier(
          CODES_ERREUR_MEMBRE.OEUVRE_INTROUVABLE,
          'Cette œuvre est introuvable.',
        );
      }
      if (oeuvre.statut !== 'VALIDEE') {
        return erreurMetier(
          CODES_ERREUR_MEMBRE.OEUVRE_NON_VALIDEE,
          'Le paiement du dépôt n’est possible que pour une œuvre validée.',
        );
      }
      if (paiementReussiExistant({ oeuvre_id: oeuvre.id, cotisation_id: null })) {
        return erreurMetier(
          CODES_ERREUR_CANDIDAT.PAIEMENT_DEJA_REUSSI,
          'Le dépôt de cette œuvre a déjà été payé.',
        );
      }
      const tarif = tarifApplique('DEPOT_OEUVRE', oeuvre.categorie_id);
      if (!tarif) {
        return refusMock(
          CODES_MOCK.TARIF_INDISPONIBLE,
          'Le montant des frais de dépôt n’est pas disponible. Veuillez réessayer plus tard.',
        );
      }
      montant = tarif.montant;
      oeuvreId = oeuvre.id;
    } else if (entree.type === 'COTISATION') {
      const cotisation = cotisationsMock.find(
        (element) =>
          element.id === entree.cotisation_id && element.membre_id === contexte.membre.id,
      );
      if (!cotisation) {
        return erreurMetier(
          CODES_ERREUR_MEMBRE.COTISATION_INTROUVABLE,
          'Cette cotisation est introuvable.',
        );
      }
      if (cotisation.statut === 'PAYEE') {
        return erreurMetier(
          CODES_ERREUR_MEMBRE.COTISATION_DEJA_PAYEE,
          'Cette cotisation est déjà payée.',
        );
      }
      if (paiementReussiExistant({ oeuvre_id: null, cotisation_id: cotisation.id })) {
        return erreurMetier(
          CODES_ERREUR_CANDIDAT.PAIEMENT_DEJA_REUSSI,
          'Cette cotisation a déjà été payée.',
        );
      }
      montant = cotisation.montant;
      cotisationId = cotisation.id;
    } else {
      return refusMock(
        CODES_MOCK.MODE_PAIEMENT_INVALIDE,
        'Ce type de paiement n’est pas proposé dans l’espace membre.',
      );
    }

    const maintenant = maintenantISO();
    const paiementId = genererUUID();
    const interne: PaiementMembreInterne = {
      id: paiementId,
      type: entree.type,
      montant,
      devise: CODE_DEVISE_MGA,
      mode: entree.mode,
      operateur: mobileMoney ? (entree.operateur ?? null) : null,
      numero_telephone: mobileMoney ? (entree.numero_telephone ?? null) : null,
      reference_interne: nouvelleReferencePaiement('MEMBRE'),
      reference_externe: null,
      statut: mobileMoney ? 'INITIE' : 'EN_ATTENTE_PREUVE',
      motif_echec: null,
      demande_adhesion_id: null,
      oeuvre_id: oeuvreId,
      cotisation_id: cotisationId,
      candidat_id: null,
      membre_id: contexte.membre.id,
      date_initiation: maintenant,
      date_confirmation: null,
      created_at: maintenant,
      updated_at: maintenant,
      nombre_polls: 0,
    };
    paiementsMembreMock.set(paiementId, interne);

    return ok(paiementMembrePublic(interne));
  }

  /**
   * Polling du paiement : la machine à états « serveur » décide du statut.
   * Les effets (cotisation payée, œuvre `DEPOT_FINALISE`, notification) sont
   * appliqués à la transition vers `REUSSI`.
   */
  async obtenirPaiement(paiement_id: UUID): Promise<Result<Paiement>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const interne = paiementsMembreMock.get(paiement_id);
    if (!interne || interne.membre_id !== contexte.membre.id) {
      return refusMock(CODES_MOCK.PAIEMENT_INTROUVABLE, 'Ce paiement est introuvable.');
    }

    const statutAvant = interne.statut;
    avancerPaiement(interne);
    interne.updated_at = maintenantISO();

    if (statutAvant !== 'REUSSI' && interne.statut === 'REUSSI') {
      appliquerEffetsPaiementReussi(paiementMembrePublic(interne));
    }

    return ok(paiementMembrePublic(interne));
  }

  /* ----------------------------------------------------- Notifications (V) */

  /** Notifications du membre (+ annonces globales), les plus récentes d'abord. */
  async listerNotifications(entree?: ListerNotificationsEntree): Promise<Result<Notification[]>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    let notifications = notificationsDeUtilisateur(contexte.utilisateur.id);
    if (entree?.non_lues_uniquement) {
      notifications = notifications.filter((notification) => !notification.lue);
    }
    if (entree?.type) {
      const type = entree.type;
      notifications = notifications.filter((notification) => notification.type === type);
    }
    return ok(notifications);
  }

  /** Marque une notification du membre comme lue. */
  async marquerNotificationLue(notification_id: UUID): Promise<Result<Notification>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const notification = notificationsMock.find(
      (element) =>
        element.id === notification_id && element.utilisateur_id === contexte.utilisateur.id,
    );
    if (!notification) {
      return refusMock(CODES_MOCK.NOTIFICATION_INTROUVABLE, 'Cette notification est introuvable.');
    }

    notification.lue = true;
    return ok(notification);
  }

  /** Marque toutes les notifications du membre comme lues ; renvoie le nombre. */
  async marquerToutesNotificationsLues(): Promise<Result<number>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const nonLues = notificationsMock.filter(
      (element) => element.utilisateur_id === contexte.utilisateur.id && !element.lue,
    );
    nonLues.forEach((notification) => {
      notification.lue = true;
    });
    return ok(nonLues.length);
  }
}

/**
 * Vrai si un paiement déjà `REUSSI` couvre ce contexte (dépôt d'œuvre ou
 * cotisation) : le schéma interdit deux paiements réussis pour le même objet.
 */
function paiementReussiExistant(contexte: {
  oeuvre_id: UUID | null;
  cotisation_id: UUID | null;
}): boolean {
  return [...paiementsMembreMock.values()].some(
    (paiement) =>
      paiement.statut === 'REUSSI' &&
      ((contexte.oeuvre_id !== null && paiement.oeuvre_id === contexte.oeuvre_id) ||
        (contexte.cotisation_id !== null && paiement.cotisation_id === contexte.cotisation_id)),
  );
}
