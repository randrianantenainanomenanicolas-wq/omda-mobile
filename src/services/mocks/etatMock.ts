import type {
  AttestationDiffusion,
  BucketStockage,
  Candidat,
  Cotisation,
  DemandeAdhesion,
  HorodatageISO,
  Membre,
  MembreCategorie,
  ModePaiement,
  Notification,
  Oeuvre,
  OperateurMobileMoney,
  OperateurPaiement,
  Paiement,
  StatutAdhesionCategorie,
  StatutPaiement,
  TailleOctets,
  TypeMime,
  UUID,
  Utilisateur,
} from '../../models';
import { CODE_DEVISE_MGA, TAILLE_MAX_FICHIER_OCTETS, TYPES_MIME_AUTORISES } from '../../models';
import type {
  EtatPaiementCandidat,
  FichierDepose,
  FichierTeleverse,
  IdentiteCandidatEntree,
  OeuvreAdhesionEntree,
  OptionsTeleversement,
  PieceEntree,
  SessionMembre,
  TeleversementEntree,
} from '../contracts';
import { CODES_ERREUR_CANDIDAT, erreurMetier, erreurReseau, erreurServeur, ok, type Result, type ResultErr } from '../contracts';
import { optionsMock } from './configMock';
import {
  COMPTES_TEST,
  DOSSIERS_TEST,
  IDS_TEST,
  OPERATEURS_TEST,
  statutFinalMobileMoney,
  tarifApplique,
} from './donneesTestMock';

/**
 * État partagé des mocks (mémoire du « serveur » simulé).
 *
 * Contient aussi les utilitaires communs aux 4 mocks :
 * - délais réseau et pannes (cf. `configMock.ts`) ;
 * - machine à états des paiements Mobile Money (MVola) ;
 * - liste dynamique des opérateurs Mobile Money (MVola) ;
 * - liens temporaires de consultation des documents stockés
 *   (`urlConsultationFichier`) ;
 * - état des comptes, dossiers, œuvres, cotisations et notifications.
 *
 * ⚠️ Aucune confirmation locale : un paiement n'atteint `REUSSI` que par la
 * machine à états « serveur » ci-dessous (webhook de l'opérateur simulé).
 */

/* ------------------------------------------------- Codes propres au mode mock */

/**
 * Codes utilisés UNIQUEMENT par les mocks (situations que le contrat d'API
 * candidat ne détaillait pas encore). À reprendre tels quels côté serveur lors
 * du branchement : voir `docs/DONNEES_TEST.md`.
 */
export const CODES_MOCK = {
  DEMANDE_NON_MODIFIABLE: 'DEMANDE_NON_MODIFIABLE',
  PAIEMENT_INTROUVABLE: 'PAIEMENT_INTROUVABLE',
  MODE_PAIEMENT_INVALIDE: 'MODE_PAIEMENT_INVALIDE',
  NOTIFICATION_INTROUVABLE: 'NOTIFICATION_INTROUVABLE',
  NUMERO_TELEPHONE_INVALIDE: 'NUMERO_TELEPHONE_INVALIDE',
  OEUVRE_NON_MODIFIABLE: 'OEUVRE_NON_MODIFIABLE',
  PAIEMENT_DEJA_REUSSI: 'PAIEMENT_DEJA_REUSSI',
  ARTICLE_INTROUVABLE: 'ARTICLE_INTROUVABLE',
  TARIF_INDISPONIBLE: 'TARIF_INDISPONIBLE',
  TELEVERSEMENT_ANNULE: 'TELEVERSEMENT_ANNULE',
} as const;

/* ---------------------------------------------------- Suivi de paiement */

/** Instructions affichées (« instruction » du contrat candidat). */
export const INSTRUCTION_PAIEMENT = {
  initie: 'Une demande de paiement a été envoyée à l’opérateur. Validez-la sur votre téléphone.',
  en_attente: 'En attente de la confirmation de l’opérateur…',
} as const;

/** Motifs d'échec (jamais vides pour `ECHEC_*` et `REJETE`). */
export const MOTIF_ECHEC_PAIEMENT: Record<string, string> = {
  ECHEC_SOLDE_INSUFFISANT: 'Le solde du compte Mobile Money est insuffisant.',
  ECHEC_AUTRE: 'L’opérateur n’a pas pu confirmer le paiement. Veuillez réessayer.',
  REJETE: 'Le paiement a été annulé. Aucun montant n’a été débité.',
};

/** Vue interne minimale d'un paiement suivie par la machine à états. */
export type PaiementSuivi = {
  mode: ModePaiement;
  statut: StatutPaiement;
  operateur: OperateurPaiement | null;
  numero_telephone: string | null;
  reference_externe: string | null;
  date_confirmation: HorodatageISO | null;
  motif_echec: string | null;
  /** Nombre d'interrogations déjà reçues (polling). */
  nombre_polls: number;
  /** Présent côté candidat (`EtatPaiementCandidat.instruction`). */
  instruction?: string | null;
};

/* ------------------------------------------------------------ Utilitaires */

/** Horodatage courant au format ISO 8601. */
export function maintenantISO(): HorodatageISO {
  return new Date().toISOString();
}

/** Horodatage décalé de `jours` jours (peut être négatif). */
export function isoDansNJours(jours: number): HorodatageISO {
  const date = new Date();
  date.setDate(date.getDate() + jours);
  return date.toISOString();
}

/** UUID v4 pseudo-aléatoire (suffisant pour les mocks). */
export function genererUUID(): UUID {
  const hexa = '0123456789abcdef';
  let sortie = '';
  for (let index = 0; index < 36; index += 1) {
    if (index === 8 || index === 13 || index === 18 || index === 23) {
      sortie += '-';
    } else if (index === 14) {
      sortie += '4';
    } else if (index === 19) {
      sortie += hexa[8 + Math.floor(Math.random() * 4)];
    } else {
      sortie += hexa[Math.floor(Math.random() * 16)];
    }
  }
  return sortie;
}

/** Délai réseau simulé tiré dans la plage configurée (mode debug). */
export function delaiSimuleMs(): number {
  const minimum = optionsMock.delai_min_ms;
  const maximum = optionsMock.delai_max_ms;
  return minimum + Math.round(Math.random() * Math.max(0, maximum - minimum));
}

/** Attente asynchrone (progression des téléversements, polling). */
export function attendre(ms: number): Promise<void> {
  return new Promise((resoudre) => setTimeout(resoudre, ms));
}

/** Panne à injecter, selon les réglages du mode debug (`null` = appel normal). */
export function panneSimulee(): ResultErr | null {
  if (optionsMock.erreur_serveur_forcee || Math.random() < optionsMock.probabilite_erreur_serveur) {
    return erreurServeur({ statut_http: 503, reference: 'mock-503' });
  }
  if (optionsMock.erreur_reseau_forcee || Math.random() < optionsMock.probabilite_erreur_reseau) {
    return erreurReseau('Mode debug : panne réseau simulée.');
  }
  return null;
}

/**
 * Prépare un appel simulé : applique le délai réseau puis renvoie la panne à
 * injecter le cas échéant. Les mocks DOIVENT l'appeler avant toute réponse.
 */
export async function preparerAppelMock(): Promise<ResultErr | null> {
  await attendre(delaiSimuleMs());
  return panneSimulee();
}

/** Erreur métier typée « mock » (codes documentés dans `docs/DONNEES_TEST.md`). */
export function refusMock(code: string, message: string): ResultErr {
  return erreurMetier(code, message);
}

/* ------------------------------------------------ Listes dynamiques (actif) */

/** Copie mutable des opérateurs Mobile Money (l'actif peut changer côté « serveur »). */
export const operateursMock: OperateurMobileMoney[] = OPERATEURS_TEST.map((operateur) => ({
  ...operateur,
}));

/** Opérateurs ACTIFS uniquement, triés par `ordre` (règle métier 14). */
export function operateursActifs(): OperateurMobileMoney[] {
  return operateursMock.filter((operateur) => operateur.actif).sort((a, b) => a.ordre - b.ordre);
}

/** Vrai si l'opérateur existe ET est actif. */
export function estOperateurActif(code: OperateurPaiement): boolean {
  return operateursMock.some((operateur) => operateur.code === code && operateur.actif);
}

/** Active/désactive un opérateur côté « serveur » (test de la liste dynamique). */
export function definirOperateurActif(code: OperateurPaiement, actif: boolean): void {
  const operateur = operateursMock.find((element) => element.code === code);
  if (operateur) {
    operateur.actif = actif;
    operateur.updated_at = maintenantISO();
  }
}

/* ------------------------------------------------------- Session (membre) */

export type EcouteurSession = (session: SessionMembre | null) => void;

/** Session courante + abonnés (`AuthService.ecouterSession`) + échecs de connexion. */
export const sessionMock: {
  courante: SessionMembre | null;
  ecouteurs: Set<EcouteurSession>;
  tentatives: Map<string, number>;
} = {
  courante: null,
  ecouteurs: new Set<EcouteurSession>(),
  tentatives: new Map<string, number>(),
};

/** Notifie les abonnés (connexion, déconnexion, changement de mot de passe). */
export function notifierSession(): void {
  sessionMock.ecouteurs.forEach((ecouteur) => ecouteur(sessionMock.courante));
}

/** Remplace la session courante et notifie les abonnés. */
export function definirSession(session: SessionMembre | null): void {
  sessionMock.courante = session;
  notifierSession();
}

/** Réinitialise le compteur d'échecs de connexion d'un e-mail. */
export function reinitialiserEchecsConnexion(email: string): void {
  sessionMock.tentatives.delete(email.trim().toLowerCase());
}

/** Enregistre un échec et renvoie le nombre d'échecs consécutifs. */
export function enregistrerEchecConnexion(email: string): number {
  const cle = email.trim().toLowerCase();
  const total = (sessionMock.tentatives.get(cle) ?? 0) + 1;
  sessionMock.tentatives.set(cle, total);
  return total;
}

/** Nombre d'échecs consécutifs enregistrés pour un e-mail. */
export function nombreEchecsConnexion(email: string): number {
  return sessionMock.tentatives.get(email.trim().toLowerCase()) ?? 0;
}

/* ------------------------------------------- Comptes, profils, appartenance */

const DATE_COMPTE = '2026-01-10T05:00:00.000Z';

export const utilisateursMock: Utilisateur[] = [];
export const candidatsMock: Candidat[] = [];
export const membresMock: Membre[] = [];
export const membreCategoriesMock: MembreCategorie[] = [];

/** Mots de passe en clair : fixtures de test uniquement (jamais en production). */
export const motsDePasseMock = new Map<string, string>();

/** Identifiant déterministe pour les fixtures de comptes (`f0…01`, `f1…01`, …). */
function identifiantCompte(prefixe: string, index: number): UUID {
  return `${prefixe}000000-0000-4000-8000-0000000000${String(index + 1).padStart(2, '0')}`;
}

COMPTES_TEST.forEach((compte, index) => {
  const utilisateurId = identifiantCompte('f0', index);
  const candidatId = identifiantCompte('f1', index);
  const membreId = identifiantCompte('f2', index);
  const telephone = compte.telephone ?? '+261340000000';

  utilisateursMock.push({
    id: utilisateurId,
    email: compte.email,
    telephone,
    role: compte.role,
    statut: compte.statut,
    doit_changer_mot_de_passe: compte.doit_changer_mot_de_passe,
    derniere_connexion_at: null,
    created_at: DATE_COMPTE,
    updated_at: DATE_COMPTE,
  });

  candidatsMock.push({
    id: candidatId,
    nom: compte.nom,
    prenom: compte.prenom,
    cin: compte.cin,
    date_naissance: compte.date_naissance,
    telephone,
    email: compte.email,
    adresse: compte.adresse,
    utilisateur_id: utilisateurId,
    created_at: DATE_COMPTE,
    updated_at: DATE_COMPTE,
  });

  membresMock.push({
    id: membreId,
    utilisateur_id: utilisateurId,
    candidat_id: candidatId,
    numero_adherent: compte.numero_adherent ?? 'OMDA-2026-A-000000',
    statut: compte.statut,
    created_at: DATE_COMPTE,
    updated_at: DATE_COMPTE,
  });

  membreCategoriesMock.push({
    id: identifiantCompte('f3', index),
    membre_id: membreId,
    categorie_id: IDS_TEST.categorie_artiste_auteur,
    demande_adhesion_id: null,
    statut: 'ACTIVE',
    date_activation: DATE_COMPTE,
  });

  motsDePasseMock.set(compte.email.toLowerCase(), compte.mot_de_passe);
});

/** Utilisateur de test par e-mail (insensible à la casse). */
export function utilisateurParEmail(email: string): Utilisateur | null {
  const recherche = email.trim().toLowerCase();
  return utilisateursMock.find((element) => element.email.toLowerCase() === recherche) ?? null;
}

/** Profil candidat rattaché à un utilisateur. */
export function candidatParUtilisateur(utilisateurId: UUID): Candidat | null {
  return candidatsMock.find((element) => element.utilisateur_id === utilisateurId) ?? null;
}

/** Profil membre rattaché à un utilisateur. */
export function membreParUtilisateur(utilisateurId: UUID): Membre | null {
  return membresMock.find((element) => element.utilisateur_id === utilisateurId) ?? null;
}

/** Appartenances (`membre_categorie`) d'un membre. */
export function categoriesDuMembre(membreId: UUID): MembreCategorie[] {
  return membreCategoriesMock.filter((element) => element.membre_id === membreId);
}

/**
 * Ajoute une appartenance membre ↔ catégorie (« serveur » simulé), comme le
 * ferait le back-office à la réception d'une demande de catégorie supplémentaire
 * (règle métier 9) : unicité `UNIQUE (membre_id, categorie_id)` respectée par
 * l'appelant.
 *
 * La demande reste au statut `EN_ATTENTE` jusqu'à la décision d'un agent OMDA ;
 * `date_activation` porte alors la date d'envoi de la demande (champ non null
 * dans le schéma) et sera remplacée par l'horodatage d'activation.
 * Persistance en mémoire : comme le reste de l'état membre des mocks, la
 * demande survit aux navigations pendant toute la session.
 */
export function ajouterAppartenanceCategorie(entree: {
  membre_id: UUID;
  categorie_id: UUID;
  statut: StatutAdhesionCategorie;
}): MembreCategorie {
  const appartenance: MembreCategorie = {
    id: prochainIdentifiantCategorieMembre(),
    membre_id: entree.membre_id,
    categorie_id: entree.categorie_id,
    demande_adhesion_id: null,
    statut: entree.statut,
    date_activation: maintenantISO(),
  };
  membreCategoriesMock.push(appartenance);
  return appartenance;
}

/**
 * Fait évoluer le statut d'une appartenance (`membre_categorie`) :
 * - réouverture d'une demande annulée ou refusée (`EN_ATTENTE`) ;
 * - annulation par le membre (`ANNULEE`).
 *
 * ⚠️ `ACTIVE` n'est jamais appliqué par l'application : l'activation d'une
 * demande reste la décision d'un agent OMDA (hors périmètre mobile).
 */
export function changerStatutAppartenanceCategorie(
  appartenanceId: UUID,
  statut: StatutAdhesionCategorie,
): MembreCategorie | null {
  const appartenance = membreCategoriesMock.find((element) => element.id === appartenanceId);
  if (!appartenance) {
    return null;
  }
  appartenance.statut = statut;
  appartenance.date_activation = maintenantISO();
  return appartenance;
}

/**
 * Œuvre jointe à une demande de catégorie supplémentaire (règle métier 9) —
 * enregistrée côté « serveur » simulé : titre, fichier de l'œuvre et son
 * attestation de diffusion, tous deux déjà téléversés dans le bucket `oeuvres`.
 */
export type OeuvreDemandeCategorieMock = {
  titre: string;
  fichier: FichierDepose;
  /** Une attestation de diffusion par œuvre (comme à l'adhésion). */
  attestation: FichierDepose;
  created_at: HorodatageISO;
};

/**
 * Œuvres jointes aux demandes de catégorie, indexées par `membre_categorie.id`.
 *
 * ⚠️ Mock : aucune ligne `oeuvre` n'est créée — l'activation de la catégorie
 * (et donc le rattachement définitif des œuvres) appartient à un agent OMDA.
 * Persistance en mémoire, comme le reste de l'état membre.
 */
export const oeuvresDemandeCategorieMock = new Map<UUID, OeuvreDemandeCategorieMock[]>();

/** Enregistre (ou vide, avec un tableau vide) les œuvres jointes à une demande. */
export function definirOeuvresDemandeCategorie(
  appartenanceId: UUID,
  oeuvres: OeuvreDemandeCategorieMock[],
): void {
  oeuvresDemandeCategorieMock.set(appartenanceId, oeuvres);
}

/** Utilisateur de la session courante (`null` si personne n'est connecté). */
export function utilisateurCourant(): Utilisateur | null {
  return sessionMock.courante ? sessionMock.courante.utilisateur : null;
}

/** Membre de la session courante (`null` si non connecté ou adhésion non finalisée). */
export function membreCourant(): Membre | null {
  return sessionMock.courante ? sessionMock.courante.membre : null;
}

/* ------------------------------------------------------ Dossiers (candidat) */

/** Dossier interne : demande + code de suivi en clair + contenu transmis. */
export type DossierMock = {
  demande: DemandeAdhesion;
  code_suivi: string;
  identite: IdentiteCandidatEntree;
  pieces: PieceEntree[];
  oeuvres: OeuvreAdhesionEntree[];
};

/** Dossiers préexistants (fixtures) et dossiers créés pendant la session. */
export const dossiersMock = new Map<string, DossierMock>();

/** Paiement candidat interne : état + contexte (champs internes au mock). */
export type PaiementCandidatInterne = EtatPaiementCandidat & {
  nombre_polls: number;
  numero_dossier: string;
  /** Numéro Mobile Money utilisé (champ interne au mock, absent du contrat). */
  numero_telephone: string | null;
};

/** Paiement membre interne (`Paiement` du schéma + compteur de polling). */
export type PaiementMembreInterne = Paiement & { nombre_polls: number };

export const paiementsCandidatMock = new Map<UUID, PaiementCandidatInterne>();
export const paiementsMembreMock = new Map<UUID, PaiementMembreInterne>();

/** Compteurs : les nouvelles références poursuivent celles des fixtures. */
export const compteursMock = {
  dossier: DOSSIERS_TEST.length,
  paiement_candidat: 701,
  paiement_membre: 801,
  oeuvre: 0,
  notification: 0,
  categorie_membre: 0,
  attestation: 0,
};

/** Numéro attribué au prochain dossier créé (`OMDA-2026-000008`, …). */
export function nouveauNumeroDossier(): string {
  compteursMock.dossier += 1;
  return `OMDA-2026-${String(compteursMock.dossier).padStart(6, '0')}`;
}

/** Référence interne du prochain paiement (`PAI-2026-000702`, …). */
export function nouvelleReferencePaiement(contexte: 'CANDIDAT' | 'MEMBRE'): string {
  const compteur = contexte === 'CANDIDAT' ? 'paiement_candidat' : 'paiement_membre';
  compteursMock[compteur] += 1;
  return `PAI-2026-${String(compteursMock[compteur]).padStart(6, '0')}`;
}

const ALPHABET_CODE_SUIVI = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

/** Code de suivi lisible, du type `K7X4-9B2Q` (communiqué une seule fois). */
export function nouveauCodeSuivi(): string {
  const bloc = () =>
    Array.from(
      { length: 4 },
      () => ALPHABET_CODE_SUIVI[Math.floor(Math.random() * ALPHABET_CODE_SUIVI.length)],
    ).join('');
  return `${bloc()}-${bloc()}`;
}

DOSSIERS_TEST.forEach((dossier) => {
  const demande: DemandeAdhesion = {
    id: genererUUID(),
    numero_dossier: dossier.numero_dossier,
    jeton_suivi_hash: `hash-${dossier.numero_dossier}`,
    candidat_id: genererUUID(),
    membre_id: null,
    categorie_id: dossier.categorie_id,
    statut: dossier.statut,
    motif_rejet: dossier.motif_rejet,
    date_soumission: dossier.date_soumission,
    date_decision: dossier.date_decision,
    agent_id: null,
    created_at: dossier.date_soumission ?? DATE_COMPTE,
    updated_at: dossier.date_decision ?? dossier.date_soumission ?? DATE_COMPTE,
  };

  dossiersMock.set(dossier.numero_dossier, {
    demande,
    code_suivi: dossier.code_suivi,
    identite: { ...dossier.identite },
    pieces: [],
    oeuvres: [],
  });

  if (dossier.paiement_reussi) {
    const tarif = tarifApplique('ADHESION', dossier.categorie_id);
    const paiementId = genererUUID();
    paiementsCandidatMock.set(paiementId, {
      paiement_id: paiementId,
      reference_interne: dossier.paiement_reussi.reference_interne,
      reference_externe: 'MM-2026-000001',
      type: 'ADHESION',
      montant: tarif ? tarif.montant : 0,
      devise: CODE_DEVISE_MGA,
      mode: 'MOBILE_MONEY',
      operateur: 'MVOLA',
      statut: 'REUSSI',
      motif_echec: null,
      date_initiation: dossier.date_soumission ?? DATE_COMPTE,
      date_confirmation: dossier.paiement_reussi.date_confirmation,
      instruction: null,
      nombre_polls: 0,
      numero_dossier: dossier.numero_dossier,
      numero_telephone: '+261340000001',
    });
  }
});

/** Dossier interne correspondant à un numéro (insensible à la casse). */
export function dossierMock(numero_dossier: string): DossierMock | null {
  const recherche = numero_dossier.trim().toUpperCase();
  for (const [numero, dossier] of dossiersMock.entries()) {
    if (numero.toUpperCase() === recherche) {
      return dossier;
    }
  }
  return null;
}

/** Vrai si le code de suivi correspond au dossier (comparaison sans casse). */
export function codeSuiviValide(dossier: DossierMock, code_suivi: string): boolean {
  return dossier.code_suivi.trim().toUpperCase() === code_suivi.trim().toUpperCase();
}

/** Paiement candidat retrouvé par sa référence interne (clé de polling). */
export function paiementCandidatParReference(reference: string): PaiementCandidatInterne | null {
  const recherche = reference.trim().toUpperCase();
  for (const paiement of paiementsCandidatMock.values()) {
    if (paiement.reference_interne.toUpperCase() === recherche) {
      return paiement;
    }
  }
  return null;
}

/* --------------------------------------------- Machine à états des paiements */

/** Statuts terminaux : plus aucune évolution possible (confirmation ou échec). */
const STATUTS_FINAUX: StatutPaiement[] = [
  'REUSSI',
  'REJETE',
  'ECHEC_AUTRE',
  'ECHEC_SOLDE_INSUFFISANT',
];

/** Renseigne `instruction` uniquement si l'objet exposé possède ce champ. */
function definirInstruction(paiement: PaiementSuivi, valeur: string | null): void {
  if (Object.prototype.hasOwnProperty.call(paiement, 'instruction')) {
    paiement.instruction = valeur;
  }
}

/**
 * Fait avancer un paiement exactement comme le ferait le serveur : webhook de
 * l'opérateur Mobile Money (MVola). Appelée à chaque interrogation par
 * polling : l'app n'invente jamais un statut.
 */
export function avancerPaiement(paiement: PaiementSuivi): void {
  if (STATUTS_FINAUX.includes(paiement.statut)) {
    return;
  }

  // Mobile Money (MVola) : INITIE → EN_ATTENTE_CONFIRMATION → REUSSI / ECHEC_* / REJETE
  paiement.nombre_polls += 1;
  if (paiement.nombre_polls < optionsMock.polls_avant_statut_final) {
    paiement.statut = 'EN_ATTENTE_CONFIRMATION';
    definirInstruction(paiement, INSTRUCTION_PAIEMENT.en_attente);
    return;
  }

  const statutFinal = statutFinalMobileMoney(paiement.numero_telephone);
  paiement.statut = statutFinal;
  if (statutFinal === 'REUSSI') {
    paiement.date_confirmation = maintenantISO();
    paiement.reference_externe =
      paiement.reference_externe ?? `MM-${(paiement.numero_telephone ?? '000000').slice(-6)}`;
    paiement.motif_echec = null;
  } else {
    paiement.date_confirmation = null;
    paiement.motif_echec = MOTIF_ECHEC_PAIEMENT[statutFinal] ?? 'Le paiement n’a pas abouti.';
  }
  definirInstruction(paiement, null);
}

/** Vue « publique » d'un paiement membre (retire les champs internes du mock). */
export function paiementMembrePublic(interne: PaiementMembreInterne): Paiement {
  return {
    id: interne.id,
    type: interne.type,
    montant: interne.montant,
    devise: interne.devise,
    mode: interne.mode,
    operateur: interne.operateur,
    numero_telephone: interne.numero_telephone,
    reference_interne: interne.reference_interne,
    reference_externe: interne.reference_externe,
    statut: interne.statut,
    motif_echec: interne.motif_echec,
    demande_adhesion_id: interne.demande_adhesion_id,
    oeuvre_id: interne.oeuvre_id,
    cotisation_id: interne.cotisation_id,
    candidat_id: interne.candidat_id,
    membre_id: interne.membre_id,
    date_initiation: interne.date_initiation,
    date_confirmation: interne.date_confirmation,
    created_at: interne.created_at,
    updated_at: interne.updated_at,
  };
}

/* --------------------------------------------------- Téléversement simulé */

/**
 * Simulation de `televerserFichier` : délai, progression (0 → 100), annulation,
 * puis contrôles de taille (20 Mo) et de type MIME selon le bucket.
 */
export async function simulerTeleversement(
  entree: TeleversementEntree,
  options?: OptionsTeleversement,
): Promise<Result<FichierTeleverse>> {
  const panne = await preparerAppelMock();
  if (panne) {
    return panne;
  }

  const mimesAutorises = TYPES_MIME_AUTORISES[entree.bucket] as readonly string[];
  if (!mimesAutorises.includes(entree.mime_type)) {
    return erreurMetier(
      CODES_ERREUR_CANDIDAT.TYPE_FICHIER_NON_AUTORISE,
      'Ce format de fichier n’est pas accepté pour ce dépôt (JPEG, PNG ou PDF).',
    );
  }
  if (entree.taille_octets > TAILLE_MAX_FICHIER_OCTETS) {
    return erreurMetier(
      CODES_ERREUR_CANDIDAT.FICHIER_TROP_VOLUMINEUX,
      'Le fichier dépasse la taille maximale de 20 Mo.',
    );
  }

  const etapes = [15, 40, 65, 85, 100];
  for (const pourcentage of etapes) {
    if (options?.signal?.aborted) {
      return refusMock(
        CODES_MOCK.TELEVERSEMENT_ANNULE,
        'L’envoi a été annulé. Vous pouvez réessayer.',
      );
    }
    await attendre(120);
    options?.onProgression?.(pourcentage);
  }

  /**
   * Le mock retient l'URI locale du fichier choisi : c'est elle que le service
   * renverra pour ÉCOUTER l'œuvre dans l'application (la fiche n'ouvre aucun
   * document avec une autre application).
   */
  urisLocalesFichiers.set(entree.chemin_stockage, entree.fichier_uri);

  return ok({
    chemin_stockage: entree.chemin_stockage,
    mime_type: entree.mime_type,
    taille_octets: entree.taille_octets,
  });
}

/* --------------------------------- Consultation des documents stockés */

/**
 * URI locale des fichiers téléversés PENDANT la session (chemin de stockage →
 * URI `file://` / `content://` du téléphone).
 *
 * Le mock n'a pas de vrai Storage : il retient le fichier réellement choisi par
 * l'utilisateur afin que l'écoute audio fonctionne en démonstration. Au
 * branchement réel (Supabase Storage), `obtenirUrlFichier` renverra une URL
 * signée et ce registre n'aura plus d'utilité.
 */
export const urisLocalesFichiers = new Map<string, string>();

/** Convention d'URL des documents des jeux de test (bucket simulé). */
export const BASE_URL_STOCKAGE_MOCK = 'https://mock.omda.mg/storage';

/**
 * Lien temporaire de consultation d'un document stocké.
 *
 * - chemin déjà absolu (`file://`, `content://`, `https://`) → renvoyé tel quel ;
 * - fichier téléversé dans la session → URI locale d'origine (il est donc
 *   réellement audible en démonstration) ;
 * - document des jeux de test → URL signée factice sur le bucket simulé, même
 *   convention que les URL de téléversement de `MockCandidateApi`.
 *
 * Renvoie `null` si le chemin est vide : le service le traduit en refus métier.
 */
export function urlConsultationFichier(cheminStockage: string): string | null {
  const chemin = cheminStockage.trim();
  if (chemin.length === 0) {
    return null;
  }
  if (/^[a-z][a-z0-9+.-]*:\/\//i.test(chemin)) {
    return chemin;
  }

  const uriLocale = urisLocalesFichiers.get(chemin);
  if (uriLocale) {
    return uriLocale;
  }

  return `${BASE_URL_STOCKAGE_MOCK}/${chemin}?token=${genererUUID()}`;
}

/* --------------------------------------------- Données de l'espace membre */

export const oeuvresMock: Oeuvre[] = [];
/** Attestations de diffusion des œuvres de membres (table `attestation_diffusion`). */
export const attestationsOeuvresMock: AttestationDiffusion[] = [];
export const cotisationsMock: Cotisation[] = [];
export const notificationsMock: Notification[] = [];

/** Index du compte de test doté du jeu de données complet (le reste est vide). */
const indexCompteComplet = COMPTES_TEST.findIndex(
  (compte) => compte.jeu_de_donnees === 'complet',
);

/** Membre / utilisateur du compte complet (fixtures). */
const membreIdComplet = identifiantCompte('f2', Math.max(0, indexCompteComplet));
const utilisateurIdComplet = identifiantCompte('f0', Math.max(0, indexCompteComplet));

/** Identifiant incrémental déterministe (`e0…0001`, `e1…0001`, …). */
function identifiantIncremental(prefixe: string, valeur: number): UUID {
  return `${prefixe}000000-0000-4000-8000-${String(valeur).padStart(12, '0')}`;
}

/** Identifiant de la prochaine œuvre créée dans l'espace membre. */
export function prochainIdentifiantOeuvre(): UUID {
  compteursMock.oeuvre += 1;
  return identifiantIncremental('e0', compteursMock.oeuvre);
}

/** Identifiant de la prochaine notification créée par le « serveur ». */
export function prochainIdentifiantNotification(): UUID {
  compteursMock.notification += 1;
  return identifiantIncremental('e1', compteursMock.notification);
}

/** Identifiant de la prochaine appartenance (`membre_categorie`) créée. */
export function prochainIdentifiantCategorieMembre(): UUID {
  compteursMock.categorie_membre += 1;
  return identifiantIncremental('e2', compteursMock.categorie_membre);
}

/** Identifiant de la prochaine attestation de diffusion créée (`e3…`). */
export function prochainIdentifiantAttestation(): UUID {
  compteursMock.attestation += 1;
  return identifiantIncremental('e3', compteursMock.attestation);
}

/**
 * Crée les œuvres et cotisations du compte « complet » :
 * - 1 œuvre `VALIDEE` (dépôt payant possible), 1 `EN_COURS_DE_VALIDATION`,
 *   1 `REJETEE` avec motif ;
 * - une attestation de diffusion par œuvre (règle métier 8) ;
 * - cotisation de l'année NON_PAYEE, cotisation précédente PAYEE.
 */
function initialiserOeuvresEtCotisationsMock(): void {
  if (indexCompteComplet < 0) {
    return;
  }
  const tarifCotisation = tarifApplique('COTISATION', null);
  const montantCotisation = tarifCotisation ? tarifCotisation.montant : 0;

  oeuvresMock.push(
    {
      id: IDS_TEST.oeuvre_validee,
      membre_id: membreIdComplet,
      demande_adhesion_id: null,
      categorie_id: IDS_TEST.categorie_ecrivain,
      titre: 'La varangue',
      description: 'Recueil de nouvelles.',
      annee: 2024,
      statut: 'VALIDEE',
      motif_rejet: null,
      chemin_fichier: 'oeuvres/OMDA-2026-A-000123/la-varangue.pdf',
      mime_type: 'application/pdf',
      taille_octets: 1204332,
      date_soumission: '2026-08-12T06:00:00.000Z',
      date_decision: '2026-08-15T06:00:00.000Z',
      agent_id: null,
      created_at: '2026-08-10T06:00:00.000Z',
      updated_at: '2026-08-15T06:00:00.000Z',
    },
    {
      id: IDS_TEST.oeuvre_en_validation,
      membre_id: membreIdComplet,
      demande_adhesion_id: null,
      categorie_id: IDS_TEST.categorie_musicien,
      titre: 'Le chant des rizières',
      description: 'Composition pour valiha et guitare.',
      annee: 2026,
      statut: 'EN_COURS_DE_VALIDATION',
      motif_rejet: null,
      chemin_fichier: 'oeuvres/OMDA-2026-A-000123/chant-rizieres.mp3',
      mime_type: 'audio/mpeg',
      taille_octets: 3245120,
      date_soumission: '2026-09-18T06:00:00.000Z',
      date_decision: null,
      agent_id: null,
      created_at: '2026-09-17T06:00:00.000Z',
      updated_at: '2026-09-18T06:00:00.000Z',
    },
    {
      id: IDS_TEST.oeuvre_rejetee,
      membre_id: membreIdComplet,
      demande_adhesion_id: null,
      categorie_id: IDS_TEST.categorie_ecrivain,
      titre: 'Récit sans titre',
      description: null,
      annee: 2025,
      statut: 'REJETEE',
      motif_rejet: 'Le fichier déposé est vide. Merci de renvoyer un document lisible.',
      chemin_fichier: 'oeuvres/OMDA-2026-A-000123/recit.pdf',
      mime_type: 'application/pdf',
      taille_octets: 183022,
      date_soumission: '2026-07-02T06:00:00.000Z',
      date_decision: '2026-07-05T06:00:00.000Z',
      agent_id: null,
      created_at: '2026-07-01T06:00:00.000Z',
      updated_at: '2026-07-05T06:00:00.000Z',
    },
  );

  /** Une attestation de diffusion par œuvre (règle métier 8). */
  attestationsOeuvresMock.push(
    {
      id: prochainIdentifiantAttestation(),
      oeuvre_id: IDS_TEST.oeuvre_validee,
      chemin_stockage: 'oeuvres/OMDA-2026-A-000123/attestation-varangue.pdf',
      mime_type: 'application/pdf',
      taille_octets: 212480,
      created_at: '2026-08-12T06:00:00.000Z',
    },
    {
      id: prochainIdentifiantAttestation(),
      oeuvre_id: IDS_TEST.oeuvre_en_validation,
      chemin_stockage: 'oeuvres/OMDA-2026-A-000123/attestation-chant-rizieres.pdf',
      mime_type: 'application/pdf',
      taille_octets: 175104,
      created_at: '2026-09-18T06:00:00.000Z',
    },
    {
      id: prochainIdentifiantAttestation(),
      oeuvre_id: IDS_TEST.oeuvre_rejetee,
      chemin_stockage: 'oeuvres/OMDA-2026-A-000123/attestation-recit.pdf',
      mime_type: 'application/pdf',
      taille_octets: 40960,
      created_at: '2026-07-02T06:00:00.000Z',
    },
  );

  cotisationsMock.push(
    {
      id: IDS_TEST.cotisation_2026,
      membre_id: membreIdComplet,
      annee: 2026,
      montant: montantCotisation,
      statut: 'NON_PAYEE',
      date_paiement: null,
      created_at: DATE_COMPTE,
    },
    {
      id: IDS_TEST.cotisation_2025,
      membre_id: membreIdComplet,
      annee: 2025,
      montant: montantCotisation,
      statut: 'PAYEE',
      date_paiement: '2025-03-14T07:20:00.000Z',
      created_at: '2025-01-02T06:00:00.000Z',
    },
  );
}

/** Crée les notifications du compte « complet » (2 non lues, 1 lue, 1 globale). */
function initialiserNotificationsMock(): void {
  if (indexCompteComplet < 0) {
    return;
  }

  notificationsMock.push(
    {
      id: prochainIdentifiantNotification(),
      utilisateur_id: utilisateurIdComplet,
      candidat_id: null,
      type: 'PAIEMENT_DISPONIBLE',
      titre: 'Paiement disponible',
      message: 'Une œuvre validée peut être déposée après paiement des frais de dépôt.',
      lue: false,
      globale: false,
      metadata: { oeuvre_id: IDS_TEST.oeuvre_validee },
      date_envoi: '2026-08-15T07:00:00.000Z',
    },
    {
      id: prochainIdentifiantNotification(),
      utilisateur_id: utilisateurIdComplet,
      candidat_id: null,
      type: 'OEUVRE_VALIDEE',
      titre: 'Œuvre validée',
      message: '« La varangue » a été validée par l’OMDA.',
      lue: false,
      globale: false,
      metadata: { oeuvre_id: IDS_TEST.oeuvre_validee },
      date_envoi: '2026-08-15T06:30:00.000Z',
    },
    {
      id: prochainIdentifiantNotification(),
      utilisateur_id: utilisateurIdComplet,
      candidat_id: null,
      type: 'OEUVRE_REJETEE',
      titre: 'Œuvre rejetée',
      message: '« Récit sans titre » : le fichier déposé est vide.',
      lue: true,
      globale: false,
      metadata: { oeuvre_id: IDS_TEST.oeuvre_rejetee },
      date_envoi: '2026-07-05T06:10:00.000Z',
    },
    {
      id: prochainIdentifiantNotification(),
      utilisateur_id: null,
      candidat_id: null,
      type: 'GLOBALE',
      titre: 'Assemblée générale',
      message: 'L’assemblée générale annuelle de l’OMDA se tiendra en décembre.',
      lue: true,
      globale: true,
      metadata: null,
      date_envoi: '2026-09-01T05:00:00.000Z',
    },
  );
}

initialiserOeuvresEtCotisationsMock();
initialiserNotificationsMock();

/** Œuvres d'un membre (les plus récentes d'abord ; vide si aucune). */
export function oeuvresDuMembre(membreId: UUID): Oeuvre[] {
  return oeuvresMock
    .filter((element) => element.membre_id === membreId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at));
}

/** Attestations de diffusion d'une œuvre (les plus anciennes d'abord). */
export function attestationsOeuvre(oeuvreId: UUID): AttestationDiffusion[] {
  return attestationsOeuvresMock
    .filter((element) => element.oeuvre_id === oeuvreId)
    .sort((a, b) => a.created_at.localeCompare(b.created_at));
}

/**
 * Remplace l'attestation de diffusion d'une œuvre : l'ancienne est OUBLIÉE.
 * Règle métier 8 : une œuvre garde toujours une attestation — l'application
 * mobile ne propose que le REMPLACEMENT (jamais la suppression).
 */
export function remplacerAttestationOeuvre(
  oeuvreId: UUID,
  fichier: FichierDepose,
): AttestationDiffusion {
  const existante = attestationsOeuvresMock.find((element) => element.oeuvre_id === oeuvreId);
  const rang = existante ? attestationsOeuvresMock.indexOf(existante) : -1;

  const attestation: AttestationDiffusion = {
    id: existante ? existante.id : prochainIdentifiantAttestation(),
    oeuvre_id: oeuvreId,
    chemin_stockage: fichier.chemin_stockage,
    mime_type: fichier.mime_type,
    taille_octets: fichier.taille_octets,
    created_at: maintenantISO(),
  };

  if (rang >= 0) {
    attestationsOeuvresMock[rang] = attestation;
  } else {
    attestationsOeuvresMock.push(attestation);
  }
  return attestation;
}

/** Cotisations d'un membre (année décroissante ; vide si aucune). */
export function cotisationsDuMembre(membreId: UUID): Cotisation[] {
  return cotisationsMock
    .filter((element) => element.membre_id === membreId)
    .sort((a, b) => b.annee - a.annee);
}

/** Notifications d'un utilisateur + annonces globales (récentes d'abord). */
export function notificationsDeUtilisateur(utilisateurId: UUID): Notification[] {
  return notificationsMock
    .filter(
      (element) =>
        element.utilisateur_id === utilisateurId ||
        (element.globale && element.utilisateur_id === null),
    )
    .sort((a, b) => b.date_envoi.localeCompare(a.date_envoi));
}

/** Ajoute une notification (le « serveur » en crée aux étapes importantes). */
export function ajouterNotification(entree: {
  utilisateur_id: UUID;
  type: Notification['type'];
  titre: string;
  message: string;
}): Notification {
  const notification: Notification = {
    id: prochainIdentifiantNotification(),
    utilisateur_id: entree.utilisateur_id,
    candidat_id: null,
    type: entree.type,
    titre: entree.titre,
    message: entree.message,
    lue: false,
    globale: false,
    metadata: null,
    date_envoi: maintenantISO(),
  };
  notificationsMock.push(notification);
  return notification;
}

/**
 * Effets « serveur » d'un paiement confirmé : cotisation marquée payée, œuvre
 * passée en `DEPOT_FINALISE`, notification `PAIEMENT_REUSSI`.
 * À n'appeler QUE sur la transition vers `REUSSI`.
 */
export function appliquerEffetsPaiementReussi(paiement: Paiement): void {
  if (paiement.type === 'COTISATION' && paiement.cotisation_id) {
    const cotisation = cotisationsMock.find((element) => element.id === paiement.cotisation_id);
    if (cotisation && cotisation.statut !== 'PAYEE') {
      cotisation.statut = 'PAYEE';
      cotisation.date_paiement = paiement.date_confirmation ?? maintenantISO();
    }
  }

  if (paiement.type === 'DEPOT_OEUVRE' && paiement.oeuvre_id) {
    const oeuvre = oeuvresMock.find((element) => element.id === paiement.oeuvre_id);
    if (oeuvre && oeuvre.statut === 'VALIDEE') {
      oeuvre.statut = 'DEPOT_FINALISE';
      oeuvre.updated_at = maintenantISO();
    }
  }

  if (paiement.membre_id) {
    const membre = membresMock.find((element) => element.id === paiement.membre_id);
    if (membre) {
      ajouterNotification({
        utilisateur_id: membre.utilisateur_id,
        type: 'PAIEMENT_REUSSI',
        titre: 'Paiement confirmé',
        message: `Votre paiement de ${paiement.montant} Ar a été confirmé par l’opérateur.`,
      });
    }
  }
}
