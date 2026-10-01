/**
 * `PublicContentService` réel (Supabase, lecture seule) — SQUELETTE (étape 17).
 *
 * ⚠️ Aucune donnée n'est encore lue : chaque méthode renvoie un refus `serveur`
 * explicite. Correspondance prévue avec le schéma (`docs/SCHEMA_DB.md`) :
 * `documentation`, `categorie`, `tarif`, `operateur_mobile_money`.
 *
 * Le mode mock reste le défaut : cette classe n'est instanciée que si
 * `EXPO_PUBLIC_USE_MOCKS=false` (cf. `src/services/factory.ts`).
 */
import type { Categorie, Documentation, OperateurMobileMoney, Tarif } from '../../models';
import type {
  EstimationMontant,
  EstimationMontantEntree,
  ListerTarifsEntree,
  PublicContentService,
  Result,
} from '../contracts';
import { erreurNonBranche } from '../nonImplemente';

export class SupabasePublicContentService implements PublicContentService {
  /** Articles de documentation publiés, triés par `ordre`. */
  async listerDocumentation(): Promise<Result<Documentation[]>> {
    return erreurNonBranche();
  }

  /** Détail d'un article par son `slug`. */
  async obtenirArticle(slug: string): Promise<Result<Documentation>> {
    return erreurNonBranche();
  }

  /** Catégories ACTIVES proposables à l'adhésion. */
  async listerCategories(): Promise<Result<Categorie[]>> {
    return erreurNonBranche();
  }

  /** Grille tarifaire courante (actifs uniquement, filtrable par opération). */
  async listerTarifs(entree?: ListerTarifsEntree): Promise<Result<Tarif[]>> {
    return erreurNonBranche();
  }

  /** Estimation dynamique du montant (écran Tarifs / simulateur). */
  async estimerMontant(entree: EstimationMontantEntree): Promise<Result<EstimationMontant>> {
    return erreurNonBranche();
  }

  /** Opérateurs Mobile Money ACTIFS (un opérateur désactivé est absent). */
  async listerOperateursMobileMoney(): Promise<Result<OperateurMobileMoney[]>> {
    return erreurNonBranche();
  }
}
