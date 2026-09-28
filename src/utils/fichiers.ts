import * as Sharing from 'expo-sharing';
import { Linking } from 'react-native';

import { TYPES_MIME_AUTORISES } from '../models';

/**
 * Actions génériques sur un document DÉJÀ STOCKÉ (œuvre, attestation de
 * diffusion) : écoute dans l'application, ouverture dans une application du
 * téléphone, partage.
 *
 * ⚠️ Ces utilitaires ne fabriquent jamais de lien : ils reçoivent l'URL
 * temporaire fournie par le service (`MemberRepository.obtenirUrlFichier`). Un
 * chemin de stockage est un chemin de bucket privé, il n'est pas ouvrable tel
 * quel.
 */

/** Types MIME audio du bucket `oeuvres` (dérivés du schéma, jamais recopiés). */
const TYPES_MIME_AUDIO: readonly string[] = TYPES_MIME_AUTORISES.oeuvres.filter((mime) =>
  mime.startsWith('audio/'),
);

/** Message unique lorsqu'aucun lien exploitable n'a été fourni. */
const MESSAGE_DOCUMENT_INDISPONIBLE =
  'Ce document n’est pas disponible pour le moment. Rechargez la fiche puis réessayez.';

/** Une œuvre est-elle un fichier audio (donc écoutable dans l'application) ? */
export function estFichierAudio(mimeType: string | null | undefined): boolean {
  if (!mimeType) {
    return false;
  }
  return TYPES_MIME_AUDIO.includes(mimeType);
}

/** Taille lisible par l'utilisateur (Mo, une décimale), format des écrans de dépôt. */
export function formaterTailleFichier(octets: number): string {
  return `${(octets / 1048576).toFixed(1)} Mo`;
}

/** Chronomètre d'écoute au format `m:ss` (ou `h:mm:ss` au-delà d'une heure). */
export function formaterDuree(secondes: number): string {
  if (!Number.isFinite(secondes) || secondes <= 0) {
    return '0:00';
  }

  const total = Math.floor(secondes);
  const heures = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const secondesTexte = String(total % 60).padStart(2, '0');

  if (heures > 0) {
    return `${heures}:${String(minutes).padStart(2, '0')}:${secondesTexte}`;
  }

  return `${minutes}:${secondesTexte}`;
}

/** Issue d'une action sur un document (ouverture ou partage). */
export type RetourActionFichier = {
  statut: 'reussi' | 'erreur';
  message: string;
};

type OptionsActionFichier = {
  /** Nom lisible du document (titre de la feuille de partage). */
  titre?: string;
  /** Type MIME du document (utilisé par Android). */
  mimeType?: string | null;
};

/**
 * Partager un document : feuille de partage du système (`expo-sharing`).
 * Le document doit être un fichier local (URI `file://` / `content://`) ; une
 * URL distante n'est pas partageable telle quelle.
 */
export async function partagerFichier(
  url: string,
  options?: OptionsActionFichier,
): Promise<RetourActionFichier> {
  const lien = url.trim();
  if (lien.length === 0) {
    return { statut: 'erreur', message: MESSAGE_DOCUMENT_INDISPONIBLE };
  }

  try {
    if (!(await Sharing.isAvailableAsync())) {
      return {
        statut: 'erreur',
        message: 'Le partage n’est pas disponible sur cet appareil.',
      };
    }

    await Sharing.shareAsync(lien, {
      dialogTitle: options?.titre ? `Partager « ${options.titre} »` : 'Partager le document',
      ...(options?.mimeType ? { mimeType: options.mimeType } : {}),
    });

    return {
      statut: 'reussi',
      message: 'Le document a été proposé aux applications de votre téléphone.',
    };
  } catch {
    return {
      statut: 'erreur',
      message: 'Le partage a échoué. Vérifiez votre connexion puis réessayez.',
    };
  }
}

/**
 * Ouvrir un document dans l'application adaptée du téléphone (`Linking`).
 * Si aucune application ne sait l'ouvrir, la feuille de partage est proposée en
 * repli : le document reste accessible au lieu d'échouer silencieusement.
 */
export async function ouvrirFichier(
  url: string,
  options?: OptionsActionFichier,
): Promise<RetourActionFichier> {
  const lien = url.trim();
  if (lien.length === 0) {
    return { statut: 'erreur', message: MESSAGE_DOCUMENT_INDISPONIBLE };
  }

  try {
    const supporte = await Linking.canOpenURL(lien);
    if (!supporte) {
      return partagerFichier(lien, options);
    }

    await Linking.openURL(lien);
    return { statut: 'reussi', message: 'Le document a été ouvert sur votre téléphone.' };
  } catch {
    return partagerFichier(lien, options);
  }
}
