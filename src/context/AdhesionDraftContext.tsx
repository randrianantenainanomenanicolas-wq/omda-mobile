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

import type { DateISO, UUID } from '../models';
import type {
  OeuvreAdhesionEntree,
  PieceEntree,
} from '../services/contracts';

/** Clé de stockage local pour le brouillon d'adhésion. */
const CLE_STORAGE_ADHESION_DRAFT = 'omda_adhesion_draft_v1';

/**
 * Données d'identité du candidat dans le brouillon.
 * Tolère des champs vides pendant la saisie progressive.
 */
export type IdentiteDraft = {
  nom: string;
  prenom: string;
  date_naissance: DateISO | '';
  cin: string;
  telephone: string;
  email: string;
  adresse: string;
};

/**
 * Données complètes du brouillon d'adhésion conservées en local.
 */
export type AdhesionDraft = {
  identite: IdentiteDraft;
  categorie_id: UUID | null;
  pieces: PieceEntree[];
  oeuvres: OeuvreAdhesionEntree[];
  numero_dossier: string | null;
  code_suivi: string | null;
  derniere_mise_a_jour: string;
};

export const IDENTITE_VIDE: IdentiteDraft = {
  nom: '',
  prenom: '',
  date_naissance: '',
  cin: '',
  telephone: '+261',
  email: '',
  adresse: '',
};

export const BROUILLON_INITIAL: AdhesionDraft = {
  identite: IDENTITE_VIDE,
  categorie_id: null,
  pieces: [],
  oeuvres: [],
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
  definirCategorie: (categorieId: UUID) => Promise<void>;
  mettreAJourPieces: (pieces: PieceEntree[]) => Promise<void>;
  mettreAJourOeuvres: (oeuvres: OeuvreAdhesionEntree[]) => Promise<void>;
  definirIdentifiantsDossier: (numeroDossier: string, codeSuivi: string) => Promise<void>;
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
    if (!i.cin.trim() || !/^\d{12}$/.test(i.cin.trim())) return false;
    if (!i.telephone.trim() || !i.telephone.startsWith('+261') || i.telephone.length < 13) return false;
    if (!i.email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(i.email.trim())) return false;
    if (!i.adresse.trim()) return false;
    if (age === null || age < 15) return false;
    return true;
  }, [age, brouillon.identite]);

  const valeur = useMemo<AdhesionDraftContextType>(
    () => ({
      brouillon,
      estCharge,
      mettreAJourIdentite,
      definirCategorie,
      mettreAJourPieces,
      mettreAJourOeuvres,
      definirIdentifiantsDossier,
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
      mettreAJourIdentite,
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

