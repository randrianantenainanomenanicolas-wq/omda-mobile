import {
  CODE_DEVISE_MGA,
  type DateISO,
  type StatutDemande,
  type UUID,
} from '../../models';
import type {
  CandidateApi,
  ConfirmationEnvoiDemande,
  CreerDemandeEntree,
  DemandeBrouillon,
  EtapeSuivi,
  EtatPaiementCandidat,
  FichierTeleverse,
  InitierPaiementEntree,
  MettreAJourDemandeEntree,
  ModePaiementDisponible,
  MontantPaiementDu,
  OptionsPaiementCandidat,
  OptionsTeleversement,
  SoumettreDemandeEntree,
  SuiviDemande,
  SuiviDemandeEntree,
  TeleversementEntree,
} from '../contracts';
import { CODES_ERREUR_CANDIDAT, erreurMetier, ok, type Result } from '../contracts';
import { tarifApplique } from './donneesTestMock';
import {
  avancerPaiement,
  CODES_MOCK,
  codeSuiviValide,
  type DossierMock,
  dossierMock,
  dossiersMock,
  estOperateurActif,
  genererUUID,
  INSTRUCTION_PAIEMENT,
  isoDansNJours,
  maintenantISO,
  nouveauCodeSuivi,
  nouveauNumeroDossier,
  nouvelleReferencePaiement,
  operateursActifs,
  paiementCandidatParReference,
  type PaiementCandidatInterne,
  paiementsCandidatMock,
  preparerAppelMock,
  refusMock,
  simulerTeleversement,
} from './etatMock';

/** Âge minimal d'une demande d'adhésion (règle métier 7 : < 15 ans = refus). */
export const AGE_MINIMUM_ADHESION = 15;

/** Âge à partir duquel aucune autorisation parentale n'est exigée. */
export const AGE_MAJORITE = 18;

/** Délai indicatif affiché au candidat : informatif, jamais une promesse. */
export const DELAI_INDICATIF_HEURES = 72;

/** Âge révolu à la date du jour (calcul UTC, comparable à la contrainte SQL). */
function ageDepuis(date_naissance: DateISO): number {
  const naissance = new Date(`${date_naissance.trim()}T00:00:00.000Z`);
  if (Number.isNaN(naissance.getTime())) {
    return 0;
  }
  const aujourdHui = new Date();
  let age = aujourdHui.getUTCFullYear() - naissance.getUTCFullYear();
  const ecartMois = aujourdHui.getUTCMonth() - naissance.getUTCMonth();
  if (ecartMois < 0 || (ecartMois === 0 && aujourdHui.getUTCDate() < naissance.getUTCDate())) {
    age -= 1;
  }
  return age;
}

/**
 * `CandidateApi` simulé : parcours visiteur/candidat complet, sans backend.
 *
 * ─ Délais réseau et pannes pilotables (`configMock.ts`).
 * ─ Mobile Money MVola : `INITIE` → `EN_ATTENTE_CONFIRMATION` → `REUSSI`/`ECHEC_*`
 *   selon le NUMÉRO saisi (cf. `docs/DONNEES_TEST.md`).
 */
export class MockCandidateApi implements CandidateApi {
  /** Crée un dossier `BROUILLON` (moins de 15 ans ⇒ `AGE_INSUFFISANT`). */
  async creerDemande(entree: CreerDemandeEntree): Promise<Result<DemandeBrouillon>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    if (ageDepuis(entree.identite.date_naissance) < AGE_MINIMUM_ADHESION) {
      return erreurMetier(
        CODES_ERREUR_CANDIDAT.AGE_INSUFFISANT,
        'Une demande d’adhésion est possible à partir de 15 ans.',
      );
    }

    const numero_dossier = nouveauNumeroDossier();
    const code_suivi = nouveauCodeSuivi();
    const maintenant = maintenantISO();

    const dossier: DossierMock = {
      demande: {
        id: genererUUID(),
        numero_dossier,
        jeton_suivi_hash: `hash-${numero_dossier}`,
        candidat_id: genererUUID(),
        membre_id: null,
        categorie_id: entree.categorie_id,
        statut: 'BROUILLON',
        motif_rejet: null,
        date_soumission: null,
        date_decision: null,
        agent_id: null,
        created_at: maintenant,
        updated_at: maintenant,
      },
      code_suivi,
      identite: { ...entree.identite },
      pieces: [],
      oeuvres: [],
    };
    dossiersMock.set(numero_dossier, dossier);

    return ok({
      demande_id: dossier.demande.id,
      numero_dossier,
      code_suivi,
      statut: dossier.demande.statut,
      created_at: maintenant,
    });
  }

  /**
   * Met à jour un brouillon (identité, catégorie).
   * Numéro inconnu ⇒ `DEMANDE_INTROUVABLE` ; code erroné ⇒ `CODE_SUIVI_INVALIDE` ;
   * dossier déjà envoyé ⇒ `DEMANDE_NON_MODIFIABLE`.
   */
  async mettreAJourDemande(
    numero_dossier: string,
    code_suivi: string,
    entree: MettreAJourDemandeEntree,
  ): Promise<Result<DemandeBrouillon>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }

    const dossier = dossierMock(numero_dossier);
    if (!dossier) {
      return refusMock(
        CODES_ERREUR_CANDIDAT.DEMANDE_INTROUVABLE,
        'Nous ne trouvons aucune demande avec ce numéro de dossier.',
      );
    }
    if (!codeSuiviValide(dossier, code_suivi)) {
      return refusMock(
        CODES_ERREUR_CANDIDAT.CODE_SUIVI_INVALIDE,
        'Le code de suivi ne correspond pas à ce numéro de dossier.',
      );
    }
    if (dossier.demande.statut !== 'BROUILLON') {
      return refusMock(
        CODES_MOCK.DEMANDE_NON_MODIFIABLE,
        'Votre demande a déjà été envoyée : elle ne peut plus être modifiée depuis cet écran.',
      );
    }

    if (entree.identite) {
      const dateNaissance = entree.identite.date_naissance ?? dossier.identite.date_naissance;
      if (ageDepuis(dateNaissance) < AGE_MINIMUM_ADHESION) {
        return erreurMetier(
          CODES_ERREUR_CANDIDAT.AGE_INSUFFISANT,
          'Une demande d’adhésion est possible à partir de 15 ans.',
        );
      }
      dossier.identite = { ...dossier.identite, ...entree.identite };
    }
    if (entree.categorie_id) {
      dossier.demande.categorie_id = entree.categorie_id;
    }
    dossier.demande.updated_at = maintenantISO();

    return ok({
      demande_id: dossier.demande.id,
      numero_dossier: dossier.demande.numero_dossier,
      code_suivi: dossier.code_suivi,
      statut: dossier.demande.statut,
      created_at: dossier.demande.created_at,
    });
  }

  /**
   * Envoie le dossier complet. ⚠️ Aucun paiement n'est déclenché ni demandé à
   * cette étape (règle métier 1).
   * Contrôles : 2 œuvres minimum, 1 attestation par œuvre, autorisation
   * parentale obligatoire de 15 à 17 ans.
   */
  async soumettreDemande(entree: SoumettreDemandeEntree): Promise<Result<ConfirmationEnvoiDemande>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }

    const dossier = dossierMock(entree.numero_dossier);
    if (!dossier) {
      return refusMock(
        CODES_ERREUR_CANDIDAT.DEMANDE_INTROUVABLE,
        'Nous ne trouvons aucune demande avec ce numéro de dossier.',
      );
    }
    if (!codeSuiviValide(dossier, entree.code_suivi)) {
      return refusMock(
        CODES_ERREUR_CANDIDAT.CODE_SUIVI_INVALIDE,
        'Le code de suivi ne correspond pas à ce numéro de dossier.',
      );
    }
    if (dossier.demande.statut !== 'BROUILLON') {
      return refusMock(
        CODES_MOCK.DEMANDE_NON_MODIFIABLE,
        'Cette demande a déjà été envoyée : vous pouvez suivre son état.',
      );
    }

    const attestationManquante = entree.oeuvres.some((oeuvre) => oeuvre.attestations.length === 0);
    if (entree.oeuvres.length < 2 || attestationManquante) {
      return erreurMetier(
        CODES_ERREUR_CANDIDAT.DOSSIER_INCOMPLET,
        'Votre dossier est incomplet : 2 œuvres et 1 attestation de diffusion par œuvre sont exigées.',
      );
    }

    const age = ageDepuis(dossier.identite.date_naissance);
    const autorisationParentale = entree.pieces.some(
      (piece) => piece.type === 'AUTORISATION_PARENTALE',
    );
    if (age >= AGE_MINIMUM_ADHESION && age < AGE_MAJORITE && !autorisationParentale) {
      return erreurMetier(
        CODES_ERREUR_CANDIDAT.AUTORISATION_PARENTALE_REQUISE,
        'Une autorisation parentale est exigée pour les personnes de 15 à 17 ans.',
      );
    }

    const dateSoumission = maintenantISO();
    dossier.pieces = entree.pieces.map((piece) => ({ ...piece }));
    dossier.oeuvres = entree.oeuvres.map((oeuvre) => ({
      ...oeuvre,
      attestations: [...oeuvre.attestations],
    }));
    dossier.demande.categorie_id = entree.categorie_id;
    dossier.demande.statut = 'ENVOYEE';
    dossier.demande.date_soumission = dateSoumission;
    dossier.demande.updated_at = dateSoumission;

    return ok({
      numero_dossier: dossier.demande.numero_dossier,
      code_suivi: dossier.code_suivi,
      statut: dossier.demande.statut,
      date_soumission: dateSoumission,
      delai_indicatif_heures: DELAI_INDICATIF_HEURES,
    });
  }

  /** Téléverse un fichier : délai, progression, 20 Mo max, MIME selon le bucket. */
  async televerserFichier(
    entree: TeleversementEntree,
    options?: OptionsTeleversement,
  ): Promise<Result<FichierTeleverse>> {
    return simulerTeleversement(entree, options);
  }

  /** Suivi public : statut, timeline, motif de rejet, montant dû si validée. */
  async suivreDemande(entree: SuiviDemandeEntree): Promise<Result<SuiviDemande>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }

    const dossier = dossierMock(entree.numero_dossier);
    if (!dossier) {
      return refusMock(
        CODES_ERREUR_CANDIDAT.DEMANDE_INTROUVABLE,
        'Nous ne trouvons aucune demande avec ce numéro de dossier.',
      );
    }
    if (!codeSuiviValide(dossier, entree.code_suivi)) {
      return refusMock(
        CODES_ERREUR_CANDIDAT.CODE_SUIVI_INVALIDE,
        'Le code de suivi ne correspond pas à ce numéro de dossier.',
      );
    }

    return ok(suiviDepuisDossier(dossier));
  }

  /**
   * Options de paiement : `paiement_du` (montant serveur) + modes réellement
   * disponibles. Un opérateur désactivé est ABSENT de la liste.
   */
  async obtenirOptionsPaiement(entree: SuiviDemandeEntree): Promise<Result<OptionsPaiementCandidat>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }

    const dossier = dossierMock(entree.numero_dossier);
    if (!dossier) {
      return refusMock(
        CODES_ERREUR_CANDIDAT.DEMANDE_INTROUVABLE,
        'Nous ne trouvons aucune demande avec ce numéro de dossier.',
      );
    }
    if (!codeSuiviValide(dossier, entree.code_suivi)) {
      return refusMock(
        CODES_ERREUR_CANDIDAT.CODE_SUIVI_INVALIDE,
        'Le code de suivi ne correspond pas à ce numéro de dossier.',
      );
    }
    if (dossier.demande.statut !== 'VALIDEE') {
      return erreurMetier(
        CODES_ERREUR_CANDIDAT.DEMANDE_NON_VALIDEE,
        'Votre demande n’est pas encore validée : le paiement n’est pas disponible pour le moment.',
      );
    }

    const montant = montantDu(dossier);
    if (!montant) {
      return refusMock(
        CODES_MOCK.TARIF_INDISPONIBLE,
        'Le montant des frais d’adhésion n’est pas disponible. Veuillez réessayer plus tard.',
      );
    }

    return ok({ paiement_du: montant, modes: modesDisponibles() });
  }

  /**
   * Initie un paiement Mobile Money (idempotent côté serveur via `Idempotency-Key`).
   * ⚠️ La réponse n'est PAS un succès : le paiement démarre à `INITIE`, la
   * confirmation venant du serveur (polling).
   */
  async initierPaiement(entree: InitierPaiementEntree): Promise<Result<EtatPaiementCandidat>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }

    const dossier = dossierMock(entree.numero_dossier);
    if (!dossier) {
      return refusMock(
        CODES_ERREUR_CANDIDAT.DEMANDE_INTROUVABLE,
        'Nous ne trouvons aucune demande avec ce numéro de dossier.',
      );
    }
    if (!codeSuiviValide(dossier, entree.code_suivi)) {
      return refusMock(
        CODES_ERREUR_CANDIDAT.CODE_SUIVI_INVALIDE,
        'Le code de suivi ne correspond pas à ce numéro de dossier.',
      );
    }
    if (dossier.demande.statut !== 'VALIDEE') {
      return erreurMetier(
        CODES_ERREUR_CANDIDAT.DEMANDE_NON_VALIDEE,
        'Votre demande n’est pas encore validée : le paiement n’est pas disponible pour le moment.',
      );
    }

    const paiementExistant = [...paiementsCandidatMock.values()].find(
      (paiement) =>
        paiement.numero_dossier === dossier.demande.numero_dossier && paiement.statut === 'REUSSI',
    );
    if (paiementExistant) {
      return erreurMetier(
        CODES_ERREUR_CANDIDAT.PAIEMENT_DEJA_REUSSI,
        'Le paiement de ces frais a déjà été confirmé.',
      );
    }

    // Seul mode de l'application : Mobile Money (MVola).
    if (entree.mode !== 'MOBILE_MONEY') {
      return refusMock(
        CODES_MOCK.MODE_PAIEMENT_INVALIDE,
        'Seul le paiement par Mobile Money (MVola) est proposé.',
      );
    }
    if (!entree.operateur || !estOperateurActif(entree.operateur)) {
      return erreurMetier(
        CODES_ERREUR_CANDIDAT.OPERATEUR_INDISPONIBLE,
        'Cet opérateur Mobile Money est momentanément indisponible.',
      );
    }
    if (!entree.numero_telephone || !entree.numero_telephone.startsWith('+261')) {
      return refusMock(
        CODES_MOCK.NUMERO_TELEPHONE_INVALIDE,
        'Indiquez un numéro Mobile Money au format +261…',
      );
    }

    const montant = montantDu(dossier);
    if (!montant) {
      return refusMock(
        CODES_MOCK.TARIF_INDISPONIBLE,
        'Le montant des frais d’adhésion n’est pas disponible. Veuillez réessayer plus tard.',
      );
    }

    const paiementId = genererUUID();
    const interne: PaiementCandidatInterne = {
      paiement_id: paiementId,
      reference_interne: nouvelleReferencePaiement('CANDIDAT'),
      reference_externe: null,
      type: 'ADHESION',
      montant: montant.montant,
      devise: montant.devise,
      mode: entree.mode,
      operateur: entree.operateur ?? null,
      numero_telephone: entree.numero_telephone ?? null,
      statut: 'INITIE',
      motif_echec: null,
      date_initiation: maintenantISO(),
      date_confirmation: null,
      instruction: INSTRUCTION_PAIEMENT.initie,
      nombre_polls: 0,
      numero_dossier: dossier.demande.numero_dossier,
    };
    paiementsCandidatMock.set(paiementId, interne);

    return ok(etatCandidatPublic(interne));
  }

  /**
   * Polling du statut : c'est le « serveur » qui fait avancer la machine à
   * états. `REUSSI` n'apparaît qu'après confirmation de l'opérateur Mobile
   * Money (MVola).
   */
  async obtenirEtatPaiement(reference_interne: string): Promise<Result<EtatPaiementCandidat>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }

    const paiement = paiementCandidatParReference(reference_interne);
    if (!paiement) {
      return refusMock(
        CODES_MOCK.PAIEMENT_INTROUVABLE,
        'Ce paiement est introuvable. Relancez le paiement depuis le suivi de votre demande.',
      );
    }

    avancerPaiement(paiement);
    return ok(etatCandidatPublic(paiement));
  }
}

/* --------------------------------------------------- Helpers de projection */

/** Vue publique d'un paiement candidat (sans les champs internes du mock). */
function etatCandidatPublic(interne: PaiementCandidatInterne): EtatPaiementCandidat {
  return {
    paiement_id: interne.paiement_id,
    reference_interne: interne.reference_interne,
    reference_externe: interne.reference_externe,
    type: interne.type,
    montant: interne.montant,
    devise: interne.devise,
    mode: interne.mode,
    operateur: interne.operateur,
    statut: interne.statut,
    motif_echec: interne.motif_echec,
    date_initiation: interne.date_initiation,
    date_confirmation: interne.date_confirmation,
    instruction: interne.instruction ?? null,
  };
}

/** Montant dû (tarif `ADHESION` de la catégorie, sinon tarif général). */
function montantDu(dossier: DossierMock): MontantPaiementDu | null {
  const tarif = tarifApplique('ADHESION', dossier.demande.categorie_id);
  if (!tarif) {
    return null;
  }
  return { type: 'ADHESION', montant: tarif.montant, devise: tarif.devise };
}

/** Modes réellement disponibles : Mobile Money (MVola) si un opérateur est actif. */
function modesDisponibles(): ModePaiementDisponible[] {
  const operateurs = operateursActifs();
  const modes: ModePaiementDisponible[] = [];

  if (operateurs.length > 0) {
    modes.push({
      mode: 'MOBILE_MONEY',
      libelle: 'Paiement Mobile Money (MVola)',
      operateurs,
    });
  }
  return modes;
}

/** Timeline de suivi calculée par le « serveur » (réalisée / à venir). */
function etapesSuivi(dossier: DossierMock): EtapeSuivi[] {
  const statut = dossier.demande.statut;
  const dateSoumission = dossier.demande.date_soumission;
  const dateDecision = dossier.demande.date_decision;

  const realiseesParStatut: Record<StatutDemande, StatutDemande[]> = {
    BROUILLON: [],
    ENVOYEE: ['ENVOYEE'],
    EN_COURS_DE_VERIFICATION: ['ENVOYEE', 'EN_COURS_DE_VERIFICATION'],
    VALIDEE: ['ENVOYEE', 'EN_COURS_DE_VERIFICATION', 'VALIDEE'],
    REJETEE: ['ENVOYEE', 'EN_COURS_DE_VERIFICATION', 'REJETEE'],
    ADHESION_TERMINEE: ['ENVOYEE', 'EN_COURS_DE_VERIFICATION', 'VALIDEE', 'ADHESION_TERMINEE'],
  };
  const realisees = realiseesParStatut[statut];

  const modele: { statut: StatutDemande; libelle: string }[] = [
    { statut: 'ENVOYEE', libelle: 'Demande reçue' },
    { statut: 'EN_COURS_DE_VERIFICATION', libelle: 'Vérification du dossier' },
    { statut: 'VALIDEE', libelle: 'Dossier validé' },
    { statut: 'ADHESION_TERMINEE', libelle: 'Adhésion finalisée' },
  ];

  const etapes: EtapeSuivi[] = modele
    .filter((etape) => etape.statut !== 'VALIDEE' || statut !== 'REJETEE')
    .map((etape) => {
      const realisee = realisees.includes(etape.statut);
      const dateEtape =
        etape.statut === 'VALIDEE' || etape.statut === 'ADHESION_TERMINEE'
          ? dateDecision
          : dateSoumission;
      return {
        statut: etape.statut,
        libelle: etape.libelle,
        realisee,
        date: realisee ? dateEtape : null,
      };
    });

  if (statut === 'REJETEE') {
    etapes.splice(2, 0, {
      statut: 'REJETEE',
      libelle: 'Dossier rejeté : motif communiqué au candidat',
      realisee: true,
      date: dateDecision,
    });
  }

  return etapes;
}

/** Objet de suivi complet (statut, timeline, motif de rejet, montant dû). */
function suiviDepuisDossier(dossier: DossierMock): SuiviDemande {
  const statut = dossier.demande.statut;
  return {
    numero_dossier: dossier.demande.numero_dossier,
    statut,
    derniere_mise_a_jour: dossier.demande.updated_at,
    etapes: etapesSuivi(dossier),
    motif_rejet:
      statut === 'REJETEE' ? (dossier.demande.motif_rejet ?? 'Motif non communiqué.') : null,
    paiement_du: statut === 'VALIDEE' ? montantDu(dossier) : null,
  };
}
