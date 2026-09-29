import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import { erreurMetier, ok, type Result } from '../services/contracts';

/**
 * Ouverture d'un document stocké (PDF, image, audio…) dans l'application adaptée
 * du téléphone : « aperçu » utilisable par tous les écrans (fiche d'œuvre,
 * attestations, futurs justificatifs).
 *
 * Toutes les API utilisées sont compatibles Expo Go :
 * - `expo-web-browser` pour un lien distant (plus fiable que `Linking`) ;
 * - `expo-file-system` (point d'entrée `legacy`, seul endroit où `getContentUriAsync`
 *   existe réellement en SDK 57) + `expo-intent-launcher` pour un fichier local
 *   sur Android (Android n'ouvre pas une URI `file://`) ;
 * - `Linking`, puis `expo-sharing` en REPLI sur iOS lorsque aucune application
 *   n'est déclarée pour ce type de fichier (« Ouvrir avec… »).
 *
 * ⚠️ `expo-sharing` n'est jamais exposé comme action « Partager » de l'interface :
 * il ne sert qu'à ouvrir le document faute d'application associée.
 *
 * Aucun lien n'est fabriqué ici : `uri` vient TOUJOURS du service
 * (`MemberRepository.obtenirUrlFichier`), jamais d'un chemin de stockage.
 */

/** Code d'erreur métier renvoyé lorsqu'un document ne peut pas être ouvert. */
export const CODE_ERREUR_PREVIEW = 'PREVIEW_INDISPONIBLE';

/** Message affiché par l'écran appelant quand aucune application ne peut ouvrir le document. */
const MESSAGE_PREVIEW_INDISPONIBLE =
  'Ce document n’a pas pu être ouvert sur votre téléphone. Vérifiez qu’une application peut lire ce format, installez-en une si besoin puis réessayez.';

/** Message affiché lorsque aucun lien exploitable n'a été fourni. */
const MESSAGE_URI_ABSENTE =
  'Ce document n’est pas disponible pour le moment. Rechargez la fiche puis réessayez.';

/** `Intent.FLAG_GRANT_READ_URI_PERMISSION` : autorise l'application cible à lire le fichier. */
const DRAPEAU_LECTURE_URI = 1;

/** Action Android standard d'ouverture d'un document. */
const ACTION_ANDROID_VIEW = 'android.intent.action.VIEW';

/** Types MIME simples déduits de l’extension (valeur de repli : type générique). */
const MIME_PAR_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  mp3: 'audio/mpeg',
};

/** Options d'ouverture d'un document. */
export type OptionsOuvertureFichier = {
  /** Lien temporaire fourni par le service (`obtenirUrlFichier`). */
  uri: string;
  /** Nom du document : son extension sert à déduire le type MIME. */
  fileName?: string;
};

/** Séparateur de fragment d'URL, écrit via `String.fromCharCode(35)` (U+0023) pour ne jamais tracer le caractère brut dans le code. */
const FRAGMENT_URL = String.fromCharCode(35);

/** Extension du fichier (minuscules, sans le point) ; chaîne vide si indéterminable. */
export function extensionFichier(nomFichierOuUri: string): string {
  const sansFragment = nomFichierOuUri.split(FRAGMENT_URL)[0] ?? '';
  const sansParametres = sansFragment.split('?')[0] ?? '';
  const dernierSegment = sansParametres.split('/').pop() ?? '';
  const positionPoint = dernierSegment.lastIndexOf('.');

  if (positionPoint <= 0 || positionPoint === dernierSegment.length - 1) {
    return '';
  }

  return dernierSegment.slice(positionPoint + 1).toLowerCase();
}

/** Type MIME simple déduit de l’extension (type générique si l’extension est inconnue). */
export function mimeTypeDepuisNom(nomFichierOuUri: string): string {
  return MIME_PAR_EXTENSION[extensionFichier(nomFichierOuUri)] ?? '*/*';
}

/**
 * Ouvre un fichier local (`file://`) : intention système sur Android, `Linking`
 * puis repli « Ouvrir avec… » (`expo-sharing`) sur iOS.
 */
async function ouvrirFichierLocal(uri: string, mimeType: string): Promise<Result<void>> {
  if (Platform.OS === 'android') {
    /**
     * Android n'ouvre pas une URI `file://` : elle doit d'abord être convertie en
     * URI `content://` par le fournisseur de fichiers de l'application.
     */
    const uriContenu = await FileSystem.getContentUriAsync(uri);
    await IntentLauncher.startActivityAsync(ACTION_ANDROID_VIEW, {
      data: uriContenu,
      flags: DRAPEAU_LECTURE_URI,
      type: mimeType,
    });
    return ok(undefined);
  }

  try {
    await Linking.openURL(uri);
    return ok(undefined);
  } catch {
    /** Aucune application associée : la feuille système permet de choisir « Ouvrir avec… ». */
    if (await Sharing.isAvailableAsync()) {
      await Sharing.shareAsync(uri, { mimeType, dialogTitle: 'Ouvrir le document' });
      return ok(undefined);
    }
    return erreurMetier(CODE_ERREUR_PREVIEW, MESSAGE_PREVIEW_INDISPONIBLE);
  }
}

/**
 * Ouvre un document dans l'application adaptée du téléphone.
 *
 * - lien `http(s)` → navigateur intégré (`expo-web-browser`) ;
 * - fichier local `file://` → Android : intention `VIEW` sur l'URI `content://` ;
 *   iOS : `Linking` puis « Ouvrir avec… » ;
 * - tout autre schéma exploitable (`content://`, custom) → tentative système ;
 * - échec complet → refus métier `PREVIEW_INDISPONIBLE` (message affichable).
 */
export async function openFile({ uri, fileName }: OptionsOuvertureFichier): Promise<Result<void>> {
  const lien = uri.trim();
  if (lien.length === 0) {
    return erreurMetier(CODE_ERREUR_PREVIEW, MESSAGE_URI_ABSENTE);
  }

  const mimeType = mimeTypeDepuisNom(fileName?.trim() || lien);

  try {
    if (/^https?:\/\//i.test(lien)) {
      await WebBrowser.openBrowserAsync(lien);
      return ok(undefined);
    }

    if (lien.startsWith('file://')) {
      return await ouvrirFichierLocal(lien, mimeType);
    }

    if (lien.startsWith('content://') && Platform.OS === 'android') {
      await IntentLauncher.startActivityAsync(ACTION_ANDROID_VIEW, {
        data: lien,
        flags: DRAPEAU_LECTURE_URI,
        type: mimeType,
      });
      return ok(undefined);
    }

    await Linking.openURL(lien);
    return ok(undefined);
  } catch {
    return erreurMetier(CODE_ERREUR_PREVIEW, MESSAGE_PREVIEW_INDISPONIBLE);
  }
}
