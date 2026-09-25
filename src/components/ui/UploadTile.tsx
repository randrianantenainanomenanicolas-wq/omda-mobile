import { Text, View } from 'react-native';

import { Button } from './Button';
import { Icone, type NomIcone } from './Icone';
import { StatusPill, type StatutPill } from './StatusPill';

/** États d'un envoi de fichier. */
export type StatutUpload = 'vide' | 'enCours' | 'verification' | 'reussi' | 'erreur';

type DescriptionStatut = {
  pastille: StatutPill;
  libelle: string;
};

const STATUTS: Record<Exclude<StatutUpload, 'vide'>, DescriptionStatut> = {
  enCours: { pastille: 'pending', libelle: 'Envoi en cours' },
  verification: { pastille: 'pending', libelle: 'En attente de vérification' },
  reussi: { pastille: 'success', libelle: 'Envoi confirmé' },
  erreur: { pastille: 'error', libelle: 'Échec de l’envoi' },
};

type PropsUploadTile = {
  libelle: string;
  statut: StatutUpload;
  nomFichier?: string;
  /** Progression 0 → 100 (utilisée si `statut = "enCours"`). */
  progression?: number;
  /** Message complémentaire (ex. erreur réseau, instruction). */
  message?: string;
  icone?: NomIcone;
  obligatoire?: boolean;
  onSelectionner?: () => void;
  onReessayer?: () => void;
  /**
   * Remplace un fichier déjà choisi : l'appelant rouvre le sélecteur, revérifie
   * la taille (20 Mo) et relance l'envoi. L'ancien fichier est écrasé.
   */
  onRemplacer?: () => void;
  /** Supprime le fichier choisi : l'appelant demande confirmation puis remet la tuile à vide. */
  onSupprimer?: () => void;
};

/**
 * Tuile d'envoi de document : progression, statut, reprise sur erreur,
 * remplacement et suppression du fichier choisi.
 * - Limite métier de 20 Mo et coupures réseau gérées par l'appelant (service).
 * - ⚠️ `reussi` (vert) uniquement après confirmation du serveur.
 * - Pendant l'envoi (`enCours`), « Remplacer » et « Supprimer » sont désactivés :
 *   un fichier ne peut pas être modifié au milieu d'un téléversement.
 */
export function UploadTile({
  libelle,
  statut,
  nomFichier,
  progression = 0,
  message,
  icone = 'cloud-arrow-up',
  obligatoire = false,
  onSelectionner,
  onReessayer,
  onRemplacer,
  onSupprimer,
}: PropsUploadTile) {
  const enCours = statut === 'enCours';
  const valeurProgression = Math.max(0, Math.min(100, Math.round(progression)));
  const description = statut === 'vide' ? null : STATUTS[statut];
  /** Un fichier existe dès que la tuile n'est plus à l'état « vide ». */
  const fichierPresent = statut !== 'vide';

  return (
    <View className="w-full rounded-xl border border-omda-borderGray bg-omda-white p-4">
      <View className="flex-row items-start">
        <Icone nom={icone} taille={18} classeCouleur="text-omda-textGray" />
        <Text className="ml-2 flex-1 text-base font-semibold text-omda-black">
          {libelle}
          {obligatoire ? ' *' : ''}
        </Text>
      </View>

      {nomFichier ? <Text className="mt-1 text-sm text-omda-textGray">{nomFichier}</Text> : null}

      {description ? (
        <View className="mt-3">
          <StatusPill statut={description.pastille} libelle={description.libelle} />
        </View>
      ) : (
        <Text className="mt-2 text-sm text-omda-textGray">Aucun fichier sélectionné.</Text>
      )}

      {enCours ? (
        <View className="mt-3">
          <View
            className="h-2 w-full overflow-hidden rounded-full bg-omda-borderGray"
            accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: valeurProgression }}
          >
            <View className="h-2 rounded-full bg-status-pending" style={{ width: `${valeurProgression}%` }} />
          </View>
          <Text className="mt-1 text-sm text-omda-textGray">{`${valeurProgression} %`}</Text>
        </View>
      ) : null}

      {message ? <Text className="mt-2 text-sm text-omda-black">{message}</Text> : null}

      {statut === 'vide' && onSelectionner ? (
        <View className="mt-3">
          <Button libelle="Choisir un fichier" variante="secondary" icone="cloud-arrow-up" onPress={onSelectionner} />
        </View>
      ) : null}

      {statut === 'erreur' && onReessayer ? (
        <View className="mt-3">
          <Button libelle="Réessayer" variante="secondary" onPress={onReessayer} />
        </View>
      ) : null}

      {fichierPresent && (onRemplacer || onSupprimer) ? (
        <View className="mt-3 gap-2">
          {onRemplacer ? (
            <Button
              libelle="Remplacer"
              variante="secondary"
              icone="arrows-rotate"
              desactive={enCours}
              onPress={onRemplacer}
            />
          ) : null}

          {onSupprimer ? (
            <Button
              libelle="Supprimer"
              variante="destructive"
              icone="trash"
              desactive={enCours}
              onPress={onSupprimer}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}
