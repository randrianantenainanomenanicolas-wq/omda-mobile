import type {
  AncienChefLieuProvince,
  Categorie,
  Documentation,
  MontantAriary,
  OperateurMobileMoney,
  Tarif,
  TypeOperationTarif,
  UUID,
} from '../../models';
import type { Result } from './result';

/**
 * Contrat des contenus PUBLICS (visiteur sans compte).
 *
 * Toutes les valeurs affichées (catégories, tarifs, opérateurs Mobile Money,
 * articles) proviennent d'ici : rien n'est codé en dur dans l'UI.
 * Implémentation par défaut : mocks ; branchement réel : Supabase (lecture)
 * ou API REST pour le simulateur.
 */
export interface PublicContentService {
  /** Articles de documentation publiés, triés par `ordre`. */
  listerDocumentation(): Promise<Result<Documentation[]>>;

  /** Détail d'un article par son `slug`. */
  obtenirArticle(slug: string): Promise<Result<Documentation>>;

  /** Catégories ACTIVES proposables à l'adhésion, triées par `ordre` (règle 1). */
  listerCategories(): Promise<Result<Categorie[]>>;

  /**
   * Anciens chef-lieux de province ACTIFS, triés par `ordre` (règle 3 : liste
   * de référence en base, jamais codée en dur dans l'écran).
   */
  listerAnciensChefLieux(): Promise<Result<AncienChefLieuProvince[]>>;

  /**
   * Texte d'engagement malgache servi par le service avec ses variables
   * remplies (règle 3). Le texte de référence reste dans
   * `docs/texte-engagement-malgache.md` ; les 3 blancs sont remplacés :
   * `nom_prenoms`, `categorie`, `date_du_jour` (JJ/MM/AAAA).
   */
  obtenirTexteEngagement(entree: TexteEngagementEntree): Promise<Result<TexteEngagement>>;

  /** Grille tarifaire courante (actifs uniquement, filtrable par opération). */
  listerTarifs(entree?: ListerTarifsEntree): Promise<Result<Tarif[]>>;

  /** Estimation dynamique du montant (écran Tarifs / simulateur). */
  estimerMontant(entree: EstimationMontantEntree): Promise<Result<EstimationMontant>>;

  /** Opérateurs Mobile Money ACTIFS (un opérateur désactivé est absent). */
  listerOperateursMobileMoney(): Promise<Result<OperateurMobileMoney[]>>;
}

export type ListerTarifsEntree = {
  type_operation?: TypeOperationTarif;
  categorie_id?: UUID | null;
};

export type EstimationMontantEntree = {
  type_operation: TypeOperationTarif;
  /** Obligatoire lorsque le tarif dépend de la catégorie. */
  categorie_id?: UUID | null;
};

/**
 * Entrée du texte d'engagement : les 3 valeurs qui viennent remplacer les
 * blancs du texte de référence.
 */
export type TexteEngagementEntree = {
  /** Nom + prénoms du candidat (remplace le blanc après « Izaho »). */
  nom_prenoms: string;
  /** Libellé de la catégorie choisie (remplace le blanc après « antokon'ny »). */
  categorie: string;
  /** Date du jour au format JJ/MM/AAAA (remplace le blanc après « anio faha »). */
  date_du_jour: string;
};

/**
 * Texte d'engagement renvoyé par le service, variables déjà substituées,
 * strictement identique au texte de référence sinon.
 */
export type TexteEngagement = {
  texte: string;
};

/**
 * Résultat du simulateur.
 * ⚠️ `estimation = true` : le montant définitif est confirmé par le serveur
 * au moment du paiement (mention obligatoire dans l'UI).
 */
export type EstimationMontant = {
  type_operation: TypeOperationTarif;
  categorie_id: UUID | null;
  montant: MontantAriary;
  devise: string;
  estimation: boolean;
  mention: string;
  /** Date de validité du tarif appliqué, si connue. */
  valide_jusqu_au: string | null;
};
