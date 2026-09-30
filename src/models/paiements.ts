import type {
  CodeDevise,
  HorodatageISO,
  MontantAriary,
  UUID,
} from './common';
import type {
  ModePaiement,
  OperateurPaiement,
  StatutCotisation,
  StatutPaiement,
  TypePaiement,
} from './enums';

/**
 * Cotisation annuelle — table `cotisation` (`UNIQUE (membre_id, annee)`).
 * Un bouton « Payer » n'est affiché que si `statut = 'NON_PAYEE'`.
 */
export type Cotisation = {
  id: UUID;
  membre_id: UUID;
  annee: number;
  montant: MontantAriary;
  statut: StatutCotisation;
  date_paiement: HorodatageISO | null;
  created_at: HorodatageISO;
};

/**
 * Paiement — table `paiement`.
 *
 * Chaque paiement est rattaché à UN contexte selon son type
 * (`paiement_contexte_chk`) : adhésion, dépôt d'œuvre ou cotisation.
 *
 * ⚠️ Règle critique : l'application ne déclare un paiement réussi QUE si le
 * serveur confirme `statut = 'REUSSI'`. Les autres états restent « en attente »
 * ou « échec » (motif dans `motif_echec`).
 */
export type Paiement = {
  id: UUID;
  type: TypePaiement;
  montant: MontantAriary;
  devise: CodeDevise;
  mode: ModePaiement;
  operateur: OperateurPaiement | null;
  numero_telephone: string | null;
  reference_interne: string;
  reference_externe: string | null;
  statut: StatutPaiement;
  motif_echec: string | null;
  demande_adhesion_id: UUID | null;
  oeuvre_id: UUID | null;
  cotisation_id: UUID | null;
  candidat_id: UUID | null;
  membre_id: UUID | null;
  date_initiation: HorodatageISO;
  date_confirmation: HorodatageISO | null;
  created_at: HorodatageISO;
  updated_at: HorodatageISO;
};

/** Journal technique d'un paiement — table `journal_paiement`. */
export type JournalPaiement = {
  id: UUID;
  paiement_id: UUID;
  evenement: string;
  payload: Record<string, unknown> | null;
  created_at: HorodatageISO;
};
