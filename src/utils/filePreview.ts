import * as FileSystem from 'expo-file-system/legacy';
import * as IntentLauncher from 'expo-intent-launcher';
import * as Sharing from 'expo-sharing';
import * as WebBrowser from 'expo-web-browser';
import { Linking, Platform } from 'react-native';

import { CODES_ERREUR_MEMBRE, erreurMetier, ok, type Result, type ResultErr } from '../services/contracts';

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
 *
 * Deux points d'entrée : `openFile` (ouverture directe) et
 * `openWithSystemPicker` — le SÉLECTEUR SYSTÈME « Ouvrir avec… » utilisé par la
 * fiche, qui confie le document à une application au choix de l'utilisateur
 * (`expo-sharing` n'y est qu'un déclencheur technique, jamais une action
 * « Partager » visible dans l'interface).
 *
 * Chaque échec est renvoyé sous forme de refus métier EXPLOITABLE par l'écran
 * (`messageErreurOuverture` donne alors le libellé exact à afficher) :
 * - `FILE_NOT_FOUND` / `FICHIER_INTROUVABLE` → « Fichier introuvable. » ;
 * - `AUCUNE_APPLICATION` → « Aucune application n’est disponible pour ouvrir
 *   ce fichier. » ;
 * - `PREVIEW_INDISPONIBLE` → « Aperçu indisponible : le fichier n’est pas
 *   accessible pour le moment. » (chemin brut, distant non téléchargeable) ;
 * - tout autre code (`SHARING_UNAVAILABLE`, `OPEN_WITH_FAILED`, …) → repli
 *   générique « Ouverture impossible. Réessayez. ».
 */

/** Code d'erreur métier générique : format ou circonstance non pris en charge. */
export const CODE_ERREUR_PREVIEW = 'PREVIEW_INDISPONIBLE';

/** Code d'erreur métier : aucune application du téléphone ne sait ouvrir ce fichier. */
export const CODE_ERREUR_AUCUNE_APPLICATION = 'AUCUNE_APPLICATION';

/** Code d'erreur métier (`openWithSystemPicker`) : téléchargement du document distant impossible. */
export const CODE_ERREUR_TELECHARGEMENT = 'DOWNLOAD_FAILED';

/** Code d'erreur métier (`openWithSystemPicker`) : fichier absent de l'appareil. */
export const CODE_ERREUR_FICHIER_ABSENT = 'FILE_NOT_FOUND';

/** Code d'erreur métier (`openWithSystemPicker`) : l'application choisie n'a pas pu ouvrir le document. */
export const CODE_ERREUR_OUVERTURE_AVEC = 'OPEN_WITH_FAILED';

/** Code d'erreur métier (`openWithSystemPicker`) : sélecteur « Ouvrir avec… » indisponible. */
export const CODE_ERREUR_SELECTEUR = 'SHARING_UNAVAILABLE';

/** Message quand le fichier demandé n'existe pas (ou que son lien temporaire a expiré). */
const MESSAGE_FICHIER_INTROUVABLE = 'Fichier introuvable.';

/** Message quand aucune application associée n'est disponible sur l'appareil. */
const MESSAGE_AUCUNE_APPLICATION = 'Aucune application n’est disponible pour ouvrir ce fichier.';

/** Message quand le fichier n'est pas accessible (chemin brut, distant non téléchargeable). */
const MESSAGE_PREVIEW_INDISPONIBLE =
  'Aperçu indisponible : le fichier n’est pas accessible pour le moment.';

/** Message générique de repli lorsque la cause précise est inconnue. */
const MESSAGE_OUVERTURE_IMPOSSIBLE = 'Ouverture impossible. Réessayez.';

/**
 * Message affichable pour un refus d'ouverture — mapping exact attendu par
 * l'écran : la cause connue (code métier) est TOUJOURS prioritaire sur le
 * message générique.
 */
export function messageErreurOuverture(code: string | undefined): string {
  if (code === CODES_ERREUR_MEMBRE.FICHIER_INTROUVABLE || code === CODE_ERREUR_FICHIER_ABSENT) {
    return MESSAGE_FICHIER_INTROUVABLE;
  }
  if (code === CODE_ERREUR_AUCUNE_APPLICATION) {
    return MESSAGE_AUCUNE_APPLICATION;
  }
  if (code === CODE_ERREUR_PREVIEW) {
    return MESSAGE_PREVIEW_INDISPONIBLE;
  }
  return MESSAGE_OUVERTURE_IMPOSSIBLE;
}

/** Indices (en minuscules) d'un fichier absent ou d'un lien expiré dans une erreur système. */
const INDICES_FICHIER_INTROUVABLE = [
  'enoent',
  'no such file',
  'does not exist',
  'non-existent',
  'nonexistent',
  'file not found',
  'file_not_found',
  'fichier introuvable',
];

/** Indices (en minuscules) d'une absence d'application capable d'ouvrir le fichier. */
const INDICES_AUCUNE_APPLICATION = [
  'activitynotfound',
  'no activity found',
  'activity not found',
  'unable to find',
  'cannot open url',
  'no application',
  'no handler',
  'no browser',
  'browser not found',
];

/**
 * Classe une erreur système (intention Android, `Linking`, navigateur, feuille
 * iOS) en refus métier à message précis — aucune exception ne remonte à l'écran.
 */
function classerErreurOuverture(erreur: unknown): ResultErr {
  const message = erreur instanceof Error ? erreur.message : String(erreur ?? '');
  const porteurDeCode = erreur as { code?: unknown } | null;
  const codeSysteme = typeof porteurDeCode?.code === 'string' ? porteurDeCode.code : '';
  const details = `${codeSysteme} ${message}`.toLowerCase();

  if (INDICES_FICHIER_INTROUVABLE.some((indice) => details.includes(indice))) {
    return erreurMetier(CODES_ERREUR_MEMBRE.FICHIER_INTROUVABLE, MESSAGE_FICHIER_INTROUVABLE);
  }
  if (INDICES_AUCUNE_APPLICATION.some((indice) => details.includes(indice))) {
    return erreurMetier(CODE_ERREUR_AUCUNE_APPLICATION, MESSAGE_AUCUNE_APPLICATION);
  }
  return erreurMetier(CODE_ERREUR_PREVIEW, MESSAGE_OUVERTURE_IMPOSSIBLE);
}

/** `Intent.FLAG_GRANT_READ_URI_PERMISSION` : autorise l'application cible à lire le fichier. */
const DRAPEAU_LECTURE_URI = 1;

/**
 * Action Android `android.intent.action.VIEW` : équivalent exact de
 * `IntentLauncher.ActivityAction.VIEW` (dans `expo-intent-launcher` SDK 57 seules
 * les constantes `android.settings.*` sont déclarées et il n'existe aucun export
 * `Flags` — `startActivityAsync` accepte la chaîne et `flags` prend l'entier
 * `Intent.FLAG_GRANT_READ_URI_PERMISSION`, ici `1`).
 */
const ACTION_ANDROID_VIEW = 'android.intent.action.VIEW';

/** Types MIME simples déduits de l’extension (valeur de repli : type générique). */
const MIME_PAR_EXTENSION: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  mp3: 'audio/mpeg',
  wav: 'audio/wav',
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
 * Ouvre un document dans l'application adaptée du téléphone.
 *
 * - lien `http(s)` → navigateur intégré (`expo-web-browser`) ;
 * - fichier local `file://` → Android : intention `VIEW` sur l'URI `content://`
 *   (`getContentUriAsync` + drapeau de lecture) ; iOS : `Linking` puis repli
 *   technique « Ouvrir avec… » (`expo-sharing`, sans aucun bouton de partage) ;
 * - URI `content://` → intention `VIEW` directe sur Android ;
 * - échec → refus métier à message précis : fichier introuvable / aucune
 *   application / repli générique (`messageErreurOuverture`).
 */
export async function openFile({ uri, fileName }: OptionsOuvertureFichier): Promise<Result<void>> {
  const lien = uri.trim();
  if (lien.length === 0) {
    return erreurMetier(CODES_ERREUR_MEMBRE.FICHIER_INTROUVABLE, MESSAGE_FICHIER_INTROUVABLE);
  }

  const mimeType = mimeTypeDepuisNom(fileName?.trim() || lien);

  try {
    if (/^https?:\/\//i.test(lien)) {
      await WebBrowser.openBrowserAsync(lien);
      return ok(undefined);
    }

    if (lien.startsWith('file://')) {
      if (Platform.OS === 'android') {
        /**
         * Android n'ouvre pas une URI `file://` : elle doit d'abord être convertie
         * en URI `content://` par le fournisseur de fichiers de l'application.
         */
        const uriContenu = await FileSystem.getContentUriAsync(lien);
        await IntentLauncher.startActivityAsync(ACTION_ANDROID_VIEW, {
          data: uriContenu,
          flags: DRAPEAU_LECTURE_URI,
          type: mimeType,
        });
        return ok(undefined);
      }

      try {
        await Linking.openURL(lien);
        return ok(undefined);
      } catch (erreurLiaison) {
        /** Aucune application associée : la feuille système permet de choisir « Ouvrir avec… ». */
        if (await Sharing.isAvailableAsync()) {
          await Sharing.shareAsync(lien, { mimeType, dialogTitle: 'Ouvrir le document' });
          return ok(undefined);
        }
        return classerErreurOuverture(erreurLiaison);
      }
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
  } catch (erreur) {
    return classerErreurOuverture(erreur);
  }
}

/** Options du sélecteur système « Ouvrir avec… ». */
export type OptionsOuvertureAvec = {
  /** Lien temporaire fourni par le service (`obtenirUrlFichier`). */
  uri: string;
  /** Nom du document : sert de nom local après téléchargement et pour déduire le type MIME. */
  fileName?: string;
  /** Type MIME explicite ; déduit du nom (ou de l'URI) quand il est absent. */
  mimeType?: string;
};

/** Extensions déduites des types MIME supportés (repli d'un nom sans extension). */
const EXTENSION_PAR_MIME: Record<string, string> = {
  'application/pdf': 'pdf',
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
};

/**
 * Nom local sûr AVEC extension pour le dossier « omda-preview/ » : extension du
 * `fileName` fourni si présent, sinon déduite de l'URL, sinon du type MIME
 * (pdf / png / jpg / mp3…) ; caractères interdits remplacés pour rester
 * compatible avec tous les systèmes de fichiers.
 */
function nomLocalFichier(fileName: string | undefined, uri: string, mimeType?: string): string {
  const extension =
    extensionFichier(fileName?.trim() || '') ||
    extensionFichier(uri) ||
    EXTENSION_PAR_MIME[(mimeType ?? '').trim().toLowerCase()] ||
    '';
  const suffixe = extension ? `.${extension}` : '';
  const base = fileName?.trim() || 'document';
  const sansExtension =
    suffixe && base.toLowerCase().endsWith(suffixe)
      ? base.slice(0, base.length - suffixe.length)
      : base;
  const propre =
    sansExtension
      .replace(/[^a-zA-Z0-9._-]+/g, '-')
      .replace(/^-+/, '')
      .replace(/-+$/, '') || 'document';
  return suffixe ? `${propre}${suffixe}` : propre;
}

/**
 * Ouvre un document avec le SÉLECTEUR SYSTÈME « Ouvrir avec… » — résolution en
 * fichier LOCAL obligatoire avant tout appel système (aucun chemin brut n'est
 * ouvert) :
 *
 * - logs DEBUG (`console.log`) : uri, fileName, mimeType, plateforme puis
 *   existence / taille du fichier — pour diagnostiquer sur appareil ;
 * - URI vide → refus métier `FILE_NOT_FOUND` ;
 * - chemin de stockage brut (ni `file://`, ni `http(s)://`) → refus métier
 *   `PREVIEW_INDISPONIBLE` (message clair, aucun essai sur un path brut) ;
 * - web → ouverture de l'URL dans un nouvel onglet (`window.open`) ;
 * - `http(s)://` → dossier `omda-preview/` créé dans le cache
 *   (`makeDirectoryAsync` + `intermediates`), téléchargement (`downloadAsync`),
 *   contrôle du code HTTP puis de l'existence et de la taille (> 0) localement ;
 * - `file://` → contrôle d'existence et de taille (> 0) ;
 * - Android → `file://` converti en `content://` (`getContentUriAsync`) puis
 *   intention VIEW avec `GRANT_READ_URI_PERMISSION` et type MIME ; absence
 *   d'application → `AUCUNE_APPLICATION` ;
 * - iOS → `Sharing.isAvailableAsync()` faux → `SHARING_UNAVAILABLE`, sinon
 *   feuille « Ouvrir avec… » (annulation par l'utilisateur = succès) ;
 * - aucune exception ne remonte à l'écran (contrat `Result`).
 */
export async function openWithSystemPicker({
  uri,
  fileName,
  mimeType,
}: OptionsOuvertureAvec): Promise<Result<void>> {
  const lien = uri.trim();
  const typeMime = mimeType?.trim() || mimeTypeDepuisNom(fileName?.trim() || lien);

  console.log(
    '[OMDA debug] openWithSystemPicker — uri:',
    lien || '(vide)',
    '| fileName:',
    fileName?.trim() || '(absent)',
    '| mimeType:',
    typeMime,
    '| platform:',
    Platform.OS,
  );

  /** A) URI vide → refus métier. */
  if (lien.length === 0) {
    return erreurMetier(CODE_ERREUR_FICHIER_ABSENT, MESSAGE_FICHIER_INTROUVABLE);
  }

  /** B) chemin de stockage brut : JAMAIS ouvert tel quel. */
  const estLocal = lien.startsWith('file://');
  const estDistant = /^https?:\/\//i.test(lien);
  if (!estLocal && !estDistant) {
    console.log('[OMDA debug] chemin brut refusé (attendu file:// ou http(s)://) :', lien);
    return erreurMetier(CODE_ERREUR_PREVIEW, MESSAGE_PREVIEW_INDISPONIBLE);
  }

  /** Plateforme web : l'URL est ouverte directement dans un nouvel onglet. */
  if (Platform.OS === 'web') {
    console.log('[OMDA debug] ouverture web (nouvel onglet) :', lien);
    window.open(lien, '_blank');
    return ok(undefined);
  }

  let uriLocale = lien;

  /** C) Lien distant → téléchargement dans <cache>/omda-preview/ (nom AVEC extension). */
  if (estDistant) {
    const repertoireCache = FileSystem.cacheDirectory;
    if (!repertoireCache) {
      return erreurMetier(CODE_ERREUR_PREVIEW, MESSAGE_PREVIEW_INDISPONIBLE);
    }
    const dossierPreview = `${repertoireCache}omda-preview/`;
    const cible = `${dossierPreview}${nomLocalFichier(fileName, lien, typeMime)}`;
    try {
      await FileSystem.makeDirectoryAsync(dossierPreview, { intermediates: true });
      await FileSystem.deleteAsync(cible, { idempotent: true });
      const telechargement = await FileSystem.downloadAsync(lien, cible);
      const information = await FileSystem.getInfoAsync(cible);
      const taille = information.exists && 'size' in information ? information.size : 0;
      console.log(
        '[OMDA debug] téléchargement — status HTTP:',
        telechargement.status,
        '| exists:',
        information.exists,
        '| size:',
        taille,
        '| cible:',
        cible,
      );
      if (
        telechargement.status < 200 ||
        telechargement.status >= 300 ||
        !information.exists ||
        information.isDirectory ||
        taille <= 0
      ) {
        return erreurMetier(CODE_ERREUR_PREVIEW, MESSAGE_PREVIEW_INDISPONIBLE);
      }
    } catch {
      console.log('[OMDA debug] téléchargement en échec :', lien);
      return erreurMetier(CODE_ERREUR_PREVIEW, MESSAGE_PREVIEW_INDISPONIBLE);
    }
    uriLocale = cible;
  } else {
    /** D) Fichier local : existence + taille > 0. */
    try {
      const information = await FileSystem.getInfoAsync(uriLocale);
      const taille = information.exists && 'size' in information ? information.size : 0;
      console.log('[OMDA debug] fichier local — exists:', information.exists, '| size:', taille);
      if (!information.exists || information.isDirectory || taille <= 0) {
        return erreurMetier(CODE_ERREUR_FICHIER_ABSENT, MESSAGE_FICHIER_INTROUVABLE);
      }
    } catch {
      return erreurMetier(CODE_ERREUR_FICHIER_ABSENT, MESSAGE_FICHIER_INTROUVABLE);
    }
  }

  /** Android : file:// → content:// puis intention VIEW. */
  if (Platform.OS === 'android') {
    try {
      const uriContenu = await FileSystem.getContentUriAsync(uriLocale);
      await IntentLauncher.startActivityAsync(ACTION_ANDROID_VIEW, {
        data: uriContenu,
        flags: DRAPEAU_LECTURE_URI,
        type: typeMime || '*/*',
      });
      console.log('[OMDA debug] intention VIEW lancée — content://', uriContenu);
      return ok(undefined);
    } catch (erreur) {
      const details = (erreur instanceof Error ? erreur.message : String(erreur ?? '')).toLowerCase();
      console.log('[OMDA debug] intention VIEW en échec :', details);
      if (INDICES_FICHIER_INTROUVABLE.some((indice) => details.includes(indice))) {
        return erreurMetier(CODE_ERREUR_FICHIER_ABSENT, MESSAGE_FICHIER_INTROUVABLE);
      }
      if (INDICES_AUCUNE_APPLICATION.some((indice) => details.includes(indice))) {
        return erreurMetier(CODE_ERREUR_AUCUNE_APPLICATION, MESSAGE_AUCUNE_APPLICATION);
      }
      return erreurMetier(CODE_ERREUR_OUVERTURE_AVEC, MESSAGE_OUVERTURE_IMPOSSIBLE);
    }
  }

  /** iOS : feuille « Ouvrir avec… » (annulation utilisateur = succès, jamais d'erreur). */
  try {
    if (!(await Sharing.isAvailableAsync())) {
      return erreurMetier(CODE_ERREUR_SELECTEUR, MESSAGE_OUVERTURE_IMPOSSIBLE);
    }
    await Sharing.shareAsync(uriLocale, {
      dialogTitle: 'Ouvrir avec…',
      mimeType: typeMime,
    });
    return ok(undefined);
  } catch (erreur) {
    const details = (erreur instanceof Error ? erreur.message : String(erreur ?? '')).toLowerCase();
    console.log('[OMDA debug] feuille « Ouvrir avec… » en échec :', details);
    if (INDICES_AUCUNE_APPLICATION.some((indice) => details.includes(indice))) {
      return erreurMetier(CODE_ERREUR_AUCUNE_APPLICATION, MESSAGE_AUCUNE_APPLICATION);
    }
    return erreurMetier(CODE_ERREUR_OUVERTURE_AVEC, MESSAGE_OUVERTURE_IMPOSSIBLE);
  }
}
