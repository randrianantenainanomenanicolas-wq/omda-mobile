import type {
  AttestationDiffusion,
  Categorie,
  Cotisation,
  Membre,
  MembreCategorie,
  Notification,
  Oeuvre,
  Paiement,
  TypeMime,
  UUID,
  Utilisateur,
} from '../../models';
import {
  CODE_DEVISE_MGA,
  STATUTS_OEUVRE_MODIFIABLES,
  TAILLE_MAX_FICHIER_OCTETS,
  TYPES_MIME_ATTESTATION,
  TYPES_MIME_AUTORISES,
} from '../../models';
import type {
  CategoriesMembre,
  CreerOeuvreEntree,
  DemandeCategorieOeuvresEntree,
  FichierTeleverse,
  InitierPaiementMembreEntree,
  ListerCotisationsEntree,
  ListerNotificationsEntree,
  ListerOeuvresEntree,
  MemberRepository,
  MettreAJourOeuvreEntree,
  MiseAJourProfilEntree,
  OptionsTeleversement,
  OeuvreDemandeCategorieEntree,
  ProfilMembre,
  SoumettreOeuvreEntree,
  TableauDeBordEntree,
  TableauDeBordMembre,
  TeleversementEntree,
  UrlFichierConsulte,
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
  attestationsOeuvre,
  avancerPaiement,
  candidatParUtilisateur,
  categoriesDuMembre,
  changerStatutAppartenanceCategorie,
  CODES_MOCK,
  cotisationsDuMembre,
  cotisationsMock,
  definirOeuvresDemandeCategorie,
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
  remplacerAttestationOeuvre,
  simulerTeleversement,
  urlConsultationFichier,
  utilisateurCourant,
} from './etatMock';

/** Contexte de la session membre (utilisateur + profil adhérent). */
type ContexteMembre = { utilisateur: Utilisateur; membre: Membre };

/**
 * Nombre minimum d'œuvres exigé pour une demande de catégorie supplémentaire
 * (règle métier 9 étendue : « ≥ 2 œuvres, 1 attestation par œuvre »).
 */
const NOMBRE_MINIMUM_OEUVRES_CATEGORIE = 2;

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

/**
 * Œuvre du MEMBRE connecté, ou `null` : les œuvres d'un autre membre sont
 * invisibles (même refus que pour une œuvre inexistante).
 */
function oeuvreDuMembre(contexte: ContexteMembre, oeuvreId: UUID): Oeuvre | null {
  return (
    oeuvresMock.find(
      (element) => element.id === oeuvreId && element.membre_id === contexte.membre.id,
    ) ?? null
  );
}

/** Refus métier standard d'une œuvre inconnue ou n'appartenant pas au membre. */
function refusOeuvreIntrouvable(): ResultErr {
  return erreurMetier(CODES_ERREUR_MEMBRE.OEUVRE_INTROUVABLE, 'Cette œuvre est introuvable.');
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
 * Refus communs à toute demande de catégorie supplémentaire (variante simple ou
 * avec œuvres) : catégorie inconnue ou désactivée, déjà `ACTIVE`/`INACTIVE` au
 * profil, ou demande déjà `EN_ATTENTE`.
 *
 * Une appartenance `ANNULEE` ou `REJETEE` reste réouvrable : le membre peut
 * redéposer une demande pour la même catégorie. Retourne `null` lorsque la
 * demande peut être déposée.
 */
function refusDemandeCategorie(membreId: UUID, categorie_id: UUID): ResultErr | null {
  const categorie = CATEGORIES_TEST.find(
    (element) => element.id === categorie_id && element.actif,
  );
  if (!categorie) {
    return erreurMetier(
      CODES_ERREUR_MEMBRE.CATEGORIE_INDISPONIBLE,
      'Cette catégorie n’est pas proposée actuellement.',
    );
  }

  const existante = categoriesDuMembre(membreId).find(
    (appartenance) => appartenance.categorie_id === categorie_id,
  );
  if (!existante) {
    return null;
  }
  if (existante.statut === 'EN_ATTENTE') {
    return erreurMetier(
      CODES_ERREUR_MEMBRE.CATEGORIE_DEJA_DEMANDEE,
      'Une demande est déjà en attente pour cette catégorie.',
    );
  }
  if (existante.statut !== 'ANNULEE' && existante.statut !== 'REJETEE') {
    return erreurMetier(
      CODES_ERREUR_MEMBRE.CATEGORIE_DEJA_ENREGISTREE,
      'Cette catégorie figure déjà dans votre profil.',
    );
  }
  return null;
}

/** Un type MIME appartient-il au bucket `oeuvres` (fichier de l'œuvre) ? */
function mimeAutoriseOeuvre(mime: TypeMime): boolean {
  return (TYPES_MIME_AUTORISES.oeuvres as readonly string[]).includes(mime);
}

/** Règle métier 8 : une attestation de diffusion est un document (pas d'audio). */
function mimeAutoriseAttestation(mime: TypeMime): boolean {
  return (TYPES_MIME_ATTESTATION as readonly string[]).includes(mime);
}

/**
 * Exigences de la règle métier 9 étendue : AU MOINS 2 œuvres, chacune avec un
 * titre, un fichier téléversé et son attestation de diffusion (règle métier 8).
 * Revalide côté « serveur » ce que l'écran contrôle déjà (taille 20 Mo, MIME).
 */
function refusOeuvresDemande(oeuvres: OeuvreDemandeCategorieEntree[]): ResultErr | null {
  if (oeuvres.length < NOMBRE_MINIMUM_OEUVRES_CATEGORIE) {
    return erreurMetier(
      CODES_ERREUR_MEMBRE.OEUVRE_MINIMUM_REQUIS,
      'Joignez au moins 2 œuvres à votre demande de catégorie.',
    );
  }

  for (const oeuvre of oeuvres) {
    const titre = oeuvre.titre.trim();
    if (!titre) {
      return erreurMetier(CODES_ERREUR_MEMBRE.OEUVRE_INCOMPLETE, 'Chaque œuvre doit être titrée.');
    }
    if (!oeuvre.fichier.chemin_stockage) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.OEUVRE_INCOMPLETE,
        `Le fichier de l’œuvre « ${titre} » est manquant.`,
      );
    }
    if (!oeuvre.attestation.chemin_stockage) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.ATTESTATION_MANQUANTE,
        `Joignez une attestation de diffusion à l’œuvre « ${titre} ».`,
      );
    }

    for (const fichier of [oeuvre.fichier, oeuvre.attestation]) {
      if (fichier.taille_octets > TAILLE_MAX_FICHIER_OCTETS) {
        return erreurMetier(
          CODES_ERREUR_MEMBRE.FICHIER_TROP_VOLUMINEUX,
          'Un fichier dépasse la taille maximale de 20 Mo.',
        );
      }
    }

    /** Fichier de l'œuvre : MP3, WAV, PDF, JPEG ou PNG. */
    if (!mimeAutoriseOeuvre(oeuvre.fichier.mime_type)) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.TYPE_FICHIER_NON_AUTORISE,
        'Le fichier de l’œuvre n’a pas un format accepté (MP3, WAV, PDF, JPEG ou PNG).',
      );
    }

    /** Attestation de diffusion : un DOCUMENT uniquement (PDF, JPEG ou PNG). */
    if (!mimeAutoriseAttestation(oeuvre.attestation.mime_type)) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.TYPE_FICHIER_NON_AUTORISE,
        'L’attestation de diffusion n’accepte que les formats PDF, JPEG et PNG.',
      );
    }
  }
  return null;
}

/**
 * Crée l'appartenance `EN_ATTENTE` d'une demande (ou rouvre l'existence
 * `ANNULEE` / `REJETEE` après vérification par `refusDemandeCategorie`).
 */
function ouvrirDemandeCategorie(
  contexte: ContexteMembre,
  categorie_id: UUID,
): MembreCategorie {
  const existante = categoriesDuMembre(contexte.membre.id).find(
    (appartenance) => appartenance.categorie_id === categorie_id,
  );
  if (existante) {
    return changerStatutAppartenanceCategorie(existante.id, 'EN_ATTENTE') ?? existante;
  }
  return ajouterAppartenanceCategorie({
    membre_id: contexte.membre.id,
    categorie_id,
    statut: 'EN_ATTENTE',
  });
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
   * Demande de catégorie supplémentaire (règle métier 9) — variante SANS
   * œuvres, conservée pour compatibilité (tests, anciens appels). La catégorie
   * doit être active au référentiel et ne pas déjà figurer au profil (ni
   * `ACTIVE` ni `EN_ATTENTE`) ; l'appartenance est créée au statut `EN_ATTENTE`
   * et seul un agent OMDA décidera de son activation (aucune validation locale).
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

    const refus = refusDemandeCategorie(contexte.membre.id, categorie_id);
    if (refus) {
      return refus;
    }

    return ok(ouvrirDemandeCategorie(contexte, categorie_id));
  }

  /**
   * Demande de catégorie supplémentaire AVEC pièces jointes (règle métier 9
   * étendue, écrans `demander-categorie` puis `demander-categorie-oeuvres`) :
   * au moins 2 œuvres, chacune avec un titre, un fichier et une attestation de
   * diffusion (règle métier 8).
   *
   * Valide dans l'ordre : catégorie (codes `CATEGORIE_*`), nombre d'œuvres
   * (`OEUVRE_MINIMUM_REQUIS`), complétude de chaque œuvre (`OEUVRE_INCOMPLETE` /
   * `ATTESTATION_MANQUANTE`) puis taille (20 Mo) et format (`FICHIER_TROP_VOLUMINEUX`
   * / `TYPE_FICHIER_NON_AUTORISE`). L'appartenance est créée ou rouverte au
   * statut `EN_ATTENTE` et les œuvres jointes sont enregistrées dans l'état du
   * mock ; aucune ligne `oeuvre` n'est créée et aucun statut `ACTIVE` n'est
   * appliqué localement.
   */
  async demanderCategorieSupplementaireAvecOeuvres(
    entree: DemandeCategorieOeuvresEntree,
  ): Promise<Result<MembreCategorie>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const refusCategorie = refusDemandeCategorie(contexte.membre.id, entree.categorie_id);
    if (refusCategorie) {
      return refusCategorie;
    }

    const refusOeuvres = refusOeuvresDemande(entree.oeuvres);
    if (refusOeuvres) {
      return refusOeuvres;
    }

    const appartenance = ouvrirDemandeCategorie(contexte, entree.categorie_id);
    definirOeuvresDemandeCategorie(
      appartenance.id,
      entree.oeuvres.map((oeuvre) => ({
        titre: oeuvre.titre.trim(),
        fichier: oeuvre.fichier,
        attestation: oeuvre.attestation,
        created_at: maintenantISO(),
      })),
    );

    return ok(appartenance);
  }

  /**
   * Annulation d'une demande `EN_ATTENTE` par le membre (règle métier 9) :
   * l'appartenance passe au statut `ANNULEE` (l'enregistrement est conservé,
   * jamais supprimé) et les œuvres jointes sont retirées de la demande.
   * Seules les demandes `EN_ATTENTE` sont annulables ; une catégorie `ACTIVE` ou
   * `INACTIVE` relève de l'agent OMDA (code `DEMANDE_NON_ANNUABLE`). Une demande
   * annulée reste réouvrable depuis « Demander une catégorie supplémentaire ».
   */
  async annulerDemandeCategorie(membre_categorie_id: UUID): Promise<Result<MembreCategorie>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const appartenance = categoriesDuMembre(contexte.membre.id).find(
      (element) => element.id === membre_categorie_id,
    );
    if (!appartenance) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.DEMANDE_CATEGORIE_INTROUVABLE,
        'Cette demande de catégorie est introuvable.',
      );
    }
    if (appartenance.statut !== 'EN_ATTENTE') {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.DEMANDE_NON_ANNUABLE,
        'Seule une demande encore en attente peut être annulée.',
      );
    }

    const annulee = changerStatutAppartenanceCategorie(appartenance.id, 'ANNULEE');
    if (!annulee) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.DEMANDE_CATEGORIE_INTROUVABLE,
        'Cette demande de catégorie est introuvable.',
      );
    }
    definirOeuvresDemandeCategorie(appartenance.id, []);

    return ok(annulee);
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

    const oeuvre = oeuvreDuMembre(contexte, oeuvre_id);
    if (!oeuvre) {
      return refusOeuvreIntrouvable();
    }
    return ok(oeuvre);
  }

  /**
   * Attestations de diffusion d'une œuvre (règle métier 8 : au moins une).
   * Elles ne sont jamais supprimées : l'écran « Modifier l'œuvre » ne propose
   * que le remplacement tant que le statut est modifiable.
   */
  async listerAttestationsOeuvre(oeuvre_id: UUID): Promise<Result<AttestationDiffusion[]>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const oeuvre = oeuvreDuMembre(contexte, oeuvre_id);
    if (!oeuvre) {
      return refusOeuvreIntrouvable();
    }
    return ok(attestationsOeuvre(oeuvre.id));
  }

  /**
   * Lien temporaire de consultation d'un document (œuvre ou attestation) :
   * écoute audio dans l'application.
   *
   * Aucun contrôle d'appartenance n'est possible sur un chemin de stockage : le
   * futur service réel ne signera un lien QUE si le fichier appartient au membre
   * (politiques du Storage) — comme ici, aucune donnée d'un autre membre ne peut
   * être atteinte puisque le chemin vient toujours de `listerOeuvres`,
   * `obtenirOeuvre` ou `listerAttestationsOeuvre`.
   */
  async obtenirUrlFichier(chemin_stockage: string): Promise<Result<UrlFichierConsulte>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const contexte = contexteMembre();
    if (!contexte) {
      return sessionRequise();
    }

    const url = urlConsultationFichier(chemin_stockage);
    if (!url) {
      return erreurMetier(
        CODES_ERREUR_MEMBRE.FICHIER_INTROUVABLE,
        'Ce document n’est pas disponible. Rechargez la fiche puis réessayez.',
      );
    }

    return ok({ url, chemin_stockage: chemin_stockage.trim() });
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

  /**
   * Corrige une œuvre encore modifiable (`STATUTS_OEUVRE_MODIFIABLES`) : tant
   * que l'OMDA n'a pas statué — `BROUILLON`, `ENVOYEE`, `EN_COURS_DE_VALIDATION`
   * — le membre peut corriger le titre, la catégorie, la description, l'année et
   * REMPLACER le fichier de l'œuvre ou son attestation de diffusion.
   *
   * ⚠️ Un document n'est jamais supprimé : seul le remplacement est offert
   * (règle métier 8). Le statut et la date de soumission ne bougent pas et une
   * correction ne déclenche aucun paiement.
   */
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

    const oeuvre = oeuvreDuMembre(contexte, oeuvre_id);
    if (!oeuvre) {
      return refusOeuvreIntrouvable();
    }
    if (!STATUTS_OEUVRE_MODIFIABLES.includes(oeuvre.statut)) {
      return refusMock(
        CODES_MOCK.OEUVRE_NON_MODIFIABLE,
        'Cette œuvre a déjà été traitée par l’OMDA : elle n’est plus modifiable depuis cet écran.',
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
    /** Remplacement du fichier de l'œuvre (l'ancien n'est plus référencé). */
    if (entree.fichier !== undefined) {
      oeuvre.chemin_fichier = entree.fichier.chemin_stockage;
      oeuvre.mime_type = entree.fichier.mime_type;
      oeuvre.taille_octets = entree.fichier.taille_octets;
    }
    /** Remplacement de l'attestation de diffusion (jamais de suppression). */
    if (entree.attestation !== undefined) {
      remplacerAttestationOeuvre(oeuvre.id, entree.attestation);
    }

    oeuvre.updated_at = maintenantISO();
    return ok(oeuvre);
  }

  /**
   * Envoie l'œuvre (`ENVOYEE`) avec son fichier et au moins une attestation de
   * diffusion, qui est ENREGISTRÉE (elle restera remplaçable tant que l'œuvre
   * est modifiable, jamais supprimable).
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

    const oeuvre = oeuvreDuMembre(contexte, entree.oeuvre_id);
    if (!oeuvre) {
      return refusOeuvreIntrouvable();
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

    /** Attestation de diffusion enregistrée avec l'œuvre (règle métier 8). */
    const [attestation] = entree.attestations;
    const dateSoumission = maintenantISO();
    oeuvre.chemin_fichier = entree.fichier.chemin_stockage;
    oeuvre.mime_type = entree.fichier.mime_type;
    oeuvre.taille_octets = entree.fichier.taille_octets;
    oeuvre.statut = 'ENVOYEE';
    oeuvre.date_soumission = dateSoumission;
    oeuvre.updated_at = dateSoumission;
    remplacerAttestationOeuvre(oeuvre.id, attestation);
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

    // Seul mode de l'application : Mobile Money (MVola).
    if (entree.mode !== 'MOBILE_MONEY') {
      return refusMock(
        CODES_MOCK.MODE_PAIEMENT_INVALIDE,
        'Seul le paiement par Mobile Money (MVola) est proposé dans l’espace membre.',
      );
    }
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
      operateur: entree.operateur ?? null,
      numero_telephone: entree.numero_telephone ?? null,
      reference_interne: nouvelleReferencePaiement('MEMBRE'),
      reference_externe: null,
      statut: 'INITIE',
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
