import type {
  AncienChefLieuProvince,
  Categorie,
  Documentation,
  OperateurMobileMoney,
  Tarif,
} from '../../models';
import type {
  EstimationMontant,
  EstimationMontantEntree,
  ListerTarifsEntree,
  PublicContentService,
  TexteEngagementEntree,
} from '../contracts';
import { ok, type Result } from '../contracts';
import {
  ANCIENS_CHEF_LIEUX_TEST,
  CATEGORIES_TEST,
  DOCUMENTATION_TEST,
  MENTION_ESTIMATION,
  TARIFS_TEST,
  tarifApplique,
} from './donneesTestMock';
import { CODES_MOCK, operateursActifs, preparerAppelMock, refusMock } from './etatMock';
import { rendreTexteEngagement } from './texteEngagement';

/**
 * `PublicContentService` simulé (contenus publics du visiteur).
 *
 * Comme la vraie API : délais réseau, pannes activables en mode debug, et
 * listes **dynamiques** — un élément désactivé (`actif = false`) est ABSENT
 * du résultat, jamais affiché puis grisé.
 */
export class MockPublicContentService implements PublicContentService {
  /** Articles publiés, triés par `ordre` (l'article non publié est absent). */
  async listerDocumentation(): Promise<Result<Documentation[]>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const articles = DOCUMENTATION_TEST.filter((article) => article.publie).sort(
      (a, b) => a.ordre - b.ordre,
    );
    return ok(articles);
  }

  /** Détail d'un article publié ; code `ARTICLE_INTROUVABLE` sinon. */
  async obtenirArticle(slug: string): Promise<Result<Documentation>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const recherche = slug.trim().toLowerCase();
    const article = DOCUMENTATION_TEST.find(
      (element) => element.slug.toLowerCase() === recherche && element.publie,
    );
    if (!article) {
      return refusMock(
        CODES_MOCK.ARTICLE_INTROUVABLE,
        'Cet article n’est pas disponible. Revenez à la liste de la documentation.',
      );
    }
    return ok(article);
  }

  /**
   * Catégories ACTIVES proposables à l'adhésion, triées dans l'ordre métier
   * imposé par `ordre` (règle 1 : Musique → Littéraire → Dramatique →
   * Audiovisuel → Figuratif), JAMAIS alphabétiquement.
   */
  async listerCategories(): Promise<Result<Categorie[]>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const categories = CATEGORIES_TEST.filter((categorie) => categorie.actif).sort(
      (a, b) => a.ordre - b.ordre,
    );
    return ok(categories);
  }

  /**
   * Anciens chef-lieux de province ACTIFS (règle 3 : liste de référence en
   * base, jamais codée dans l'écran), triés par `ordre`.
   */
  async listerAnciensChefLieux(): Promise<Result<AncienChefLieuProvince[]>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const lieux = ANCIENS_CHEF_LIEUX_TEST.filter((item) => item.actif).sort(
      (a, b) => a.ordre - b.ordre,
    );
    return ok(lieux);
  }

  /**
   * Texte d'engagement malgache servi PAR LE SERVICE avec ses 3 variables
   * remplies (règle 3 + demande explicite de l'étape 29) : le reste du texte
   * est recopié tel quel depuis `docs/texte-engagement-malgache.md`, sans
   * reformulation. Les 3 blancs remplacés sont :
   * - « Izaho …… » → `nom_prenoms` ;
   * - « antokon'ny ……… » → `categorie` ;
   * - « anio faha…………………… » → `date_du_jour` (JJ/MM/AAAA, au moment de
   *   l'acceptation).
   * La ville « Antananarivo » reste en dur dans le texte source : le « lieu
   * de l'engagement » saisi sur l'écran est stocké séparément pour le PDF.
   */
  async obtenirTexteEngagement(
    entree: TexteEngagementEntree,
  ): Promise<Result<{ texte: string }>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    return ok({ texte: rendreTexteEngagement(entree) });
  }

  /** Grille tarifaire active, filtrable par opération et par catégorie. */
  async listerTarifs(entree?: ListerTarifsEntree): Promise<Result<Tarif[]>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const tarifs = TARIFS_TEST.filter((tarif) => {
      if (!tarif.actif) {
        return false;
      }
      if (entree?.type_operation && tarif.type_operation !== entree.type_operation) {
        return false;
      }
      if (entree?.categorie_id !== undefined && tarif.categorie_id !== entree.categorie_id) {
        return false;
      }
      return true;
    });
    return ok(tarifs);
  }

  /**
   * Estimation dynamique : montant issu de la grille tarifaire, jamais calculé
   * ni codé en dur. `estimation = true` + mention obligatoire (écran D).
   */
  async estimerMontant(entree: EstimationMontantEntree): Promise<Result<EstimationMontant>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    const categorieId = entree.categorie_id ?? null;
    const tarif = tarifApplique(entree.type_operation, categorieId);
    if (!tarif) {
      return refusMock(
        CODES_MOCK.TARIF_INDISPONIBLE,
        'Aucun tarif n’est disponible pour cette opération. Veuillez réessayer plus tard.',
      );
    }
    return ok({
      type_operation: entree.type_operation,
      categorie_id: categorieId,
      montant: tarif.montant,
      devise: tarif.devise,
      estimation: true,
      mention: MENTION_ESTIMATION,
      valide_jusqu_au: tarif.date_fin,
    });
  }

  /** Opérateurs Mobile Money actifs, triés par `ordre` (règle métier 14). */
  async listerOperateursMobileMoney(): Promise<Result<OperateurMobileMoney[]>> {
    const panne = await preparerAppelMock();
    if (panne) {
      return panne;
    }
    return ok(operateursActifs());
  }
}
