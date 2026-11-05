import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';

import type { BulletinDeclaration, DateISO, UUID } from '../models';
import type {
  OeuvreAdhesionEntree,
  PieceEntree,
} from '../services/contracts';

/** Clé de stockage local pour le brouillon d'adhésion. */
const CLE_STORAGE_ADHESION_DRAFT = 'omda_adhesion_draft_v1';

/**
 * Données d'identité du candidat dans le brouillon.
 * Tolère des champs vides pendant la saisie progressive.
 *
 * Champs alignés sur la fiche d'adhésion (règle 3, docs/FORMULAIRES.md §1) :
 * - identité civile : nom, prénom, date + lieu de naissance, profession ;
 * - pseudonyme (règle 4 : obligatoire, NON unique, conservable) et groupe
 *   (règle 3 : obligatoire, le pseudonyme peut le remplacer à l'affichage) ;
 * - CIN : numéro + lieu et date de délivrance ;
 * - coordonnées : téléphone, e-mail, adresse ;
 * - ancien chef-lieu de province : id de la liste de référence (règle 3,
 *   « juste après l'adresse »), jamais codé en dur dans l'écran ;
 * - personne à prévenir (nom + contact) ;
 * - compte bancaire : FACULTATIF, jamais bloquant ;
 * - le territoire OMDA n'est PAS une donnée du brouillon : il est fixé par la
 *   règle et affiché en lecture seule à partir de `TERRITOIRE_OMDA_FIXE` ;
 * - le « lieu de réception du droit » n'est PAS dans l'app (règle 3).
 */
export type IdentiteDraft = {
  nom: string;
  prenom: string;
  date_naissance: DateISO | '';
  lieu_naissance: string;
  pseudonyme: string;
  groupe: string;
  profession: string;
  cin: string;
  cin_lieu_delivrance: string;
  /** Format `AAAA-MM-JJ` sélectionné via DateField (mode date). */
  cin_date_delivrance: DateISO | '';
  telephone: string;
  email: string;
  adresse: string;
  ancien_chef_lieu_province_id: UUID | '';
  contact_urgence_nom: string;
  contact_urgence_telephone: string;
  /** FACULTATIF : jamais bloquant (règle 3). Donnée sensible : jamais journalisée. */
  compte_bancaire: string;
};

/**
 * Engagement sur l'honneur (règle 3) : les 4 valeurs sont stockées dans le
 * brouillon local et reprises dans le PDF récapitulatif. La ville « Antananarivo »
 * reste EN DUR dans le texte servi par le service : le champ `lieu` ci-dessous
 * n'est PAS réinjecté dans le texte, il n'est utilisé que pour le PDF et la base.
 */
export type EngagementDraft = {
  /** Case « Déclaration sur l'honneur » cochée (acceptation). */
  accepte: boolean;
  /** Mention « voavaky sy ankatoavina » SAISIE par l'auteur (règle 3). */
  mention_saisie: string;
  /** Lieu de l'engagement, saisi sur l'écran (distinct de la ville du texte). */
  lieu: string;
  /** Date du jour au moment de l'acceptation (`AAAA-MM-JJ`), LECTURE SEULE. */
  date_jour: DateISO | '';
};

/**
 * Données complètes du brouillon d'adhésion conservées en local.
 */
export type AdhesionDraft = {
  identite: IdentiteDraft;
  engagement: EngagementDraft;
  categorie_id: UUID | null;
  pieces: PieceEntree[];
  oeuvres: OeuvreAdhesionEntree[];
  /**
   * Bulletins de déclaration saisis dans l'app (ÉTAPE 29C), indexés par la clé
   * locale stable de l'œuvre (`cle_locale`). Source de vérité du formulaire,
   * conservée même si l'œuvre n'est pas encore complète (fichier manquant).
   */
  bulletins: Record<string, BulletinDeclaration>;
  /**
   * Empreintes locales des fichiers déjà retenus pour une autre pièce
   * (ÉTAPE 29C, règle 5) : clé descriptive (type de pièce, ou `cle#nature`
   * pour une œuvre/attestation), valeur = `empreinteFichier` du fichier choisi
   * AVANT compression. Sert au contrôle local du selfie (refus du même fichier
   * qu'une autre pièce). Le selfie n'y figure pas : il est contrôlé séparément.
   */
  empreintes_pieces: Record<string, string>;
  /**
   * Selfie de vérification d'identité (dernière pièce, règle 5). `null` tant
   * que le candidat n'a pas importé un selfie valide.
   */
  selfie: PieceEntree | null;
  /**
   * Signature du dossier capturée AU MOMENT du selfie. Si le candidat modifie
   * ensuite un formulaire ou une pièce, la signature recalculée diffère et le
   * selfie est jugé à refaire (bouton d'envoi verrouillé à nouveau).
   */
  empreinte_dossier_au_selfie: string | null;
  numero_dossier: string | null;
  code_suivi: string | null;
  derniere_mise_a_jour: string;
};

export const IDENTITE_VIDE: IdentiteDraft = {
  nom: '',
  prenom: '',
  date_naissance: '',
  lieu_naissance: '',
  pseudonyme: '',
  groupe: '',
  profession: '',
  cin: '',
  cin_lieu_delivrance: '',
  cin_date_delivrance: '',
  telephone: '+261',
  email: '',
  adresse: '',
  ancien_chef_lieu_province_id: '',
  contact_urgence_nom: '',
  contact_urgence_telephone: '',
  compte_bancaire: '',
};

export const ENGAGEMENT_VIDE: EngagementDraft = {
  accepte: false,
  mention_saisie: '',
  lieu: '',
  date_jour: '',
};

export const BROUILLON_INITIAL: AdhesionDraft = {
  identite: IDENTITE_VIDE,
  engagement: ENGAGEMENT_VIDE,
  categorie_id: null,
  pieces: [],
  oeuvres: [],
  bulletins: {},
  empreintes_pieces: {},
  selfie: null,
  empreinte_dossier_au_selfie: null,
  numero_dossier: null,
  code_suivi: null,
  derniere_mise_a_jour: new Date().toISOString(),
};

/**
 * Calcule l'âge révolu à la date courante à partir d'une date de naissance (AAAA-MM-JJ).
 * Renvoie `null` si la date est incomplète ou invalide.
 */
export function calculerAge(date_naissance: string): number | null {
  const propre = date_naissance.trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(propre)) {
    return null;
  }
  const dateObj = new Date(`${propre}T00:00:00.000Z`);
  if (Number.isNaN(dateObj.getTime())) {
    return null;
  }
  const aujourdHui = new Date();
  let age = aujourdHui.getUTCFullYear() - dateObj.getUTCFullYear();
  const ecartMois = aujourdHui.getUTCMonth() - dateObj.getUTCMonth();
  if (ecartMois < 0 || (ecartMois === 0 && aujourdHui.getUTCDate() < dateObj.getUTCDate())) {
    age -= 1;
  }
  return age;
}

export type AdhesionDraftContextType = {
  brouillon: AdhesionDraft;
  estCharge: boolean;
  mettreAJourIdentite: (partial: Partial<IdentiteDraft>) => Promise<void>;
  mettreAJourEngagement: (partial: Partial<EngagementDraft>) => Promise<void>;
  definirCategorie: (categorieId: UUID) => Promise<void>;
  mettreAJourPieces: (pieces: PieceEntree[]) => Promise<void>;
  mettreAJourOeuvres: (oeuvres: OeuvreAdhesionEntree[]) => Promise<void>;
  /** Enregistre le bulletin d'une œuvre (clé locale stable). */
  definirBulletin: (cle: string, bulletin: BulletinDeclaration) => Promise<void>;
  /** Retire le bulletin d'une œuvre (retrait de la ligne). */
  effacerBulletin: (cle: string) => Promise<void>;
  /**
   * Enregistre les empreintes locales des fichiers retenus pour chaque pièce
   * (contrôle anti-doublon du selfie, règle 5). Carte entièrement remplacée.
   */
  definirEmpreintesPieces: (empreintes: Record<string, string>) => Promise<void>;
  definirIdentifiantsDossier: (numeroDossier: string, codeSuivi: string) => Promise<void>;
  /** Enregistre un selfie valide + la signature du dossier au moment de la prise. */
  definirSelfie: (selfie: PieceEntree, signature: string) => Promise<void>;
  /** Retire le selfie (reprise après invalidation ou suppression). */
  effacerSelfie: () => Promise<void>;
  reinitialiserBrouillon: () => Promise<void>;
  age: number | null;
  estMineur15A17: boolean;
  estMoinsDe15Ans: boolean;
  identiteEstValide: boolean;
};

const AdhesionDraftContext = createContext<AdhesionDraftContextType | undefined>(undefined);

export function AdhesionDraftProvider({ children }: { children: ReactNode }) {
  const [brouillon, setBrouillon] = useState<AdhesionDraft>(BROUILLON_INITIAL);
  const [estCharge, setEstCharge] = useState(false);

  useEffect(() => {
    let actif = true;
    async function chargerDepuisStockage() {
      try {
        const contenu = await AsyncStorage.getItem(CLE_STORAGE_ADHESION_DRAFT);
        if (contenu && actif) {
          const parse = JSON.parse(contenu) as Partial<AdhesionDraft>;
          setBrouillon((precedent) => ({
            ...precedent,
            ...parse,
            identite: {
              ...precedent.identite,
              ...(parse.identite ?? {}),
            },
            engagement: {
              ...precedent.engagement,
              ...(parse.engagement ?? {}),
            },
            // Rétro-compat (29C) : d'anciens brouillons n'ont pas ces champs.
            bulletins: parse.bulletins ?? precedent.bulletins,
            empreintes_pieces: parse.empreintes_pieces ?? precedent.empreintes_pieces,
            selfie: parse.selfie ?? precedent.selfie,
            empreinte_dossier_au_selfie:
              parse.empreinte_dossier_au_selfie ?? precedent.empreinte_dossier_au_selfie,
          }));
        }
      } catch (erreur) {
        console.warn('[AdhesionDraft] Erreur de lecture locale :', erreur);
      } finally {
        if (actif) {
          setEstCharge(true);
        }
      }
    }
    void chargerDepuisStockage();
    return () => {
      actif = false;
    };
  }, []);

  const persister = useCallback(async (nouveau: AdhesionDraft) => {
    try {
      await AsyncStorage.setItem(CLE_STORAGE_ADHESION_DRAFT, JSON.stringify(nouveau));
    } catch (erreur) {
      console.warn('[AdhesionDraft] Erreur de sauvegarde locale :', erreur);
    }
  }, []);

  const mettreAJourIdentite = useCallback(
    async (partial: Partial<IdentiteDraft>) => {
      setBrouillon((precedent) => {
        const maj: AdhesionDraft = {
          ...precedent,
          identite: {
            ...precedent.identite,
            ...partial,
          },
          derniere_mise_a_jour: new Date().toISOString(),
        };
        void persister(maj);
        return maj;
      });
    },
    [persister],
  );

  const mettreAJourEngagement = useCallback(
    async (partial: Partial<EngagementDraft>) => {
      setBrouillon((precedent) => {
        const maj: AdhesionDraft = {
          ...precedent,
          engagement: {
            ...precedent.engagement,
            ...partial,
          },
          derniere_mise_a_jour: new Date().toISOString(),
        };
        void persister(maj);
        return maj;
      });
    },
    [persister],
  );

  const definirCategorie = useCallback(
    async (categorieId: UUID) => {
      setBrouillon((precedent) => {
        const maj: AdhesionDraft = {
          ...precedent,
          categorie_id: categorieId,
          derniere_mise_a_jour: new Date().toISOString(),
        };
        void persister(maj);
        return maj;
      });
    },
    [persister],
  );

  const mettreAJourPieces = useCallback(
    async (pieces: PieceEntree[]) => {
      setBrouillon((precedent) => {
        const maj: AdhesionDraft = {
          ...precedent,
          pieces,
          derniere_mise_a_jour: new Date().toISOString(),
        };
        void persister(maj);
        return maj;
      });
    },
    [persister],
  );

  const mettreAJourOeuvres = useCallback(
    async (oeuvres: OeuvreAdhesionEntree[]) => {
      setBrouillon((precedent) => {
        const maj: AdhesionDraft = {
          ...precedent,
          oeuvres,
          derniere_mise_a_jour: new Date().toISOString(),
        };
        void persister(maj);
        return maj;
      });
    },
    [persister],
  );

  const definirEmpreintesPieces = useCallback(
    async (empreintes: Record<string, string>) => {
      setBrouillon((precedent) => {
        // Comparaison JSON : aucune écriture inutile si la carte est identique.
        if (JSON.stringify(precedent.empreintes_pieces) === JSON.stringify(empreintes)) {
          return precedent;
        }
        const maj: AdhesionDraft = {
          ...precedent,
          empreintes_pieces: empreintes,
          derniere_mise_a_jour: new Date().toISOString(),
        };
        void persister(maj);
        return maj;
      });
    },
    [persister],
  );

  const definirIdentifiantsDossier = useCallback(
    async (numeroDossier: string, codeSuivi: string) => {
      setBrouillon((precedent) => {
        const maj: AdhesionDraft = {
          ...precedent,
          numero_dossier: numeroDossier,
          code_suivi: codeSuivi,
          derniere_mise_a_jour: new Date().toISOString(),
        };
        void persister(maj);
        return maj;
      });
    },
    [persister],
  );

  const definirBulletin = useCallback(
    async (cle: string, bulletin: BulletinDeclaration) => {
      setBrouillon((precedent) => {
        const maj: AdhesionDraft = {
          ...precedent,
          bulletins: { ...precedent.bulletins, [cle]: bulletin },
          derniere_mise_a_jour: new Date().toISOString(),
        };
        void persister(maj);
        return maj;
      });
    },
    [persister],
  );

  const effacerBulletin = useCallback(
    async (cle: string) => {
      setBrouillon((precedent) => {
        const restants = { ...precedent.bulletins };
        delete restants[cle];
        const maj: AdhesionDraft = {
          ...precedent,
          bulletins: restants,
          derniere_mise_a_jour: new Date().toISOString(),
        };
        void persister(maj);
        return maj;
      });
    },
    [persister],
  );

  const definirSelfie = useCallback(
    async (selfie: PieceEntree, signature: string) => {
      setBrouillon((precedent) => {
        const maj: AdhesionDraft = {
          ...precedent,
          selfie,
          empreinte_dossier_au_selfie: signature,
          derniere_mise_a_jour: new Date().toISOString(),
        };
        void persister(maj);
        return maj;
      });
    },
    [persister],
  );

  const effacerSelfie = useCallback(async () => {
    setBrouillon((precedent) => {
      const maj: AdhesionDraft = {
        ...precedent,
        selfie: null,
        empreinte_dossier_au_selfie: null,
        derniere_mise_a_jour: new Date().toISOString(),
      };
      void persister(maj);
      return maj;
    });
  }, [persister]);

  const reinitialiserBrouillon = useCallback(async () => {
    const nouveau: AdhesionDraft = {
      ...BROUILLON_INITIAL,
      derniere_mise_a_jour: new Date().toISOString(),
    };
    setBrouillon(nouveau);
    try {
      await AsyncStorage.removeItem(CLE_STORAGE_ADHESION_DRAFT);
    } catch (erreur) {
      console.warn('[AdhesionDraft] Erreur de réinitialisation :', erreur);
    }
  }, []);

  const age = useMemo(() => {
    if (!brouillon.identite.date_naissance) {
      return null;
    }
    return calculerAge(brouillon.identite.date_naissance);
  }, [brouillon.identite.date_naissance]);

  const estMoinsDe15Ans = age !== null && age < 15;
  const estMineur15A17 = age !== null && age >= 15 && age < 18;

  const identiteEstValide = useMemo(() => {
    const i = brouillon.identite;
    if (!i.nom.trim() || !i.prenom.trim()) return false;
    if (!i.pseudonyme.trim()) return false;
    if (!i.groupe.trim()) return false;
    if (!i.cin.trim() || !/^\d{12}$/.test(i.cin.trim())) return false;
    if (!i.cin_lieu_delivrance.trim()) return false;
    if (!i.cin_date_delivrance) return false;
    if (!i.telephone.trim() || !i.telephone.startsWith('+261') || i.telephone.length < 13) return false;
    if (!i.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email.trim())) return false;
    if (!i.adresse.trim()) return false;
    if (!i.lieu_naissance.trim()) return false;
    if (!i.profession.trim()) return false;
    if (!i.contact_urgence_nom.trim()) return false;
    if (!i.contact_urgence_telephone.trim()) return false;
    if (age === null || age < 15) return false;
    return true;
  }, [age, brouillon.identite]);

  const valeur = useMemo<AdhesionDraftContextType>(
    () => ({
      brouillon,
      estCharge,
      mettreAJourIdentite,
      mettreAJourEngagement,
      definirCategorie,
      mettreAJourPieces,
      mettreAJourOeuvres,
      definirBulletin,
      effacerBulletin,
      definirEmpreintesPieces,
      definirIdentifiantsDossier,
      definirSelfie,
      effacerSelfie,
      reinitialiserBrouillon,
      age,
      estMineur15A17,
      estMoinsDe15Ans,
      identiteEstValide,
    }),
    [
      age,
      brouillon,
      definirCategorie,
      definirIdentifiantsDossier,
      estCharge,
      estMineur15A17,
      estMoinsDe15Ans,
      identiteEstValide,
      definirSelfie,
      effacerSelfie,
      definirBulletin,
      effacerBulletin,
      definirEmpreintesPieces,
      mettreAJourIdentite,
      mettreAJourEngagement,
      mettreAJourOeuvres,
      mettreAJourPieces,
      reinitialiserBrouillon,
    ],
  );

  return (
    <AdhesionDraftContext.Provider value={valeur}>
      {children}
    </AdhesionDraftContext.Provider>
  );
}

export function useAdhesionDraft(): AdhesionDraftContextType {
  const contexte = useContext(AdhesionDraftContext);
  if (!contexte) {
    throw new Error('useAdhesionDraft doit être utilisé dans un AdhesionDraftProvider');
  }
  return contexte;
}

