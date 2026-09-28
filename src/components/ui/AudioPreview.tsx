import { useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { useCallback, useEffect } from 'react';
import { Text, View } from 'react-native';

import { formaterDuree } from '../../utils';
import { Button } from './Button';
import { Icone } from './Icone';

/** Fréquence de rafraîchissement de la progression d'écoute (millisecondes). */
const INTERVALLE_MAJ_MS = 250;

type PropsAudioPreview = {
  /** Nom lisible du document (lu par les lecteurs d'écran). */
  libelle: string;
  /** Lien temporaire de lecture fourni par le service (`obtenirUrlFichier`). */
  url: string;
};

/**
 * Lecteur audio intégré d'une œuvre (`expo-audio`).
 *
 * - la source est TOUJOURS l'URL fournie par le service : l'écran ne construit
 *   jamais de lien à partir d'un chemin de stockage (bucket privé) ;
 * - trois états utiles : piste en préparation, lecture en cours, erreur de
 *   lecture avec « Réessayer » (le lecteur recharge la source) ;
 * - `useAudioPlayer` libère le lecteur au démontage de l'écran : aucun son ne
 *   continue en arrière-plan ; l'effet ci-dessous coupe la lecture par sécurité ;
 * - aucune couleur hex : uniquement des tokens (`omda-*`). La barre de
 *   progression est verte car c'est la couleur de MARQUE (`omda-green`), elle
 *   n'annonce aucune confirmation de succès ;
 * - pas de déplacement dans la piste (pas de « seek ») : le lecteur reste
 *   volontairement simple, l'ouverture externe couvre les besoins avancés.
 */
export function AudioPreview({ libelle, url }: PropsAudioPreview) {
  const player = useAudioPlayer(url, { updateInterval: INTERVALLE_MAJ_MS });
  const statut = useAudioPlayerStatus(player);

  /** Sécurité : coupe le son si l'écran est quitté pendant l'écoute. */
  useEffect(() => {
    return () => {
      try {
        player.pause();
      } catch {
        // Lecteur déjà libéré par `useAudioPlayer` : il n'y a plus rien à couper.
      }
    };
  }, [player]);

  const enPreparation = !statut.isLoaded;
  const duree = statut.duration;
  const progression = duree > 0 ? Math.min(100, Math.round((statut.currentTime / duree) * 100)) : 0;

  const basculerLecture = useCallback(() => {
    if (statut.playing) {
      player.pause();
      return;
    }
    /** Une piste terminée repart du début : `play()` seul resterait à la fin. */
    if (statut.didJustFinish) {
      void player.seekTo(0);
    }
    player.play();
  }, [player, statut.didJustFinish, statut.playing]);

  /** Relance le chargement de la source après un échec de lecture. */
  const rechargerPiste = useCallback(() => {
    player.replace(url);
  }, [player, url]);

  if (statut.error) {
    return (
      <View className="mt-3 w-full rounded-xl border border-status-error bg-omda-white p-4">
        <View className="flex-row items-start">
          <Icone nom="circle-xmark" taille={18} classeCouleur="text-status-error" />
          <View className="ml-3 flex-1">
            <Text className="text-base font-semibold text-status-error">Écoute impossible</Text>
            <Text className="mt-1 text-base text-omda-black">
              La piste audio n’a pas pu être lue. Vérifiez votre connexion Internet puis réessayez.
            </Text>
          </View>
        </View>
        <View className="mt-3">
          <Button
            libelle="Réessayer l’écoute"
            variante="secondary"
            icone="rotate-right"
            onPress={rechargerPiste}
          />
        </View>
      </View>
    );
  }

  return (
    <View className="mt-3 w-full rounded-xl border border-omda-borderGray bg-omda-warmGray p-4">
      <View className="flex-row items-center">
        <Icone nom="volume-high" taille={16} classeCouleur="text-omda-textGray" />
        <Text className="ml-2 flex-1 text-sm text-omda-textGray">
          {enPreparation ? 'Préparation de la piste audio…' : `Écoute dans l’application — ${libelle}`}
        </Text>
      </View>

      <View
        className="mt-3 h-2 w-full overflow-hidden rounded-full bg-omda-borderGray"
        accessibilityRole="progressbar"
        accessibilityLabel={`Progression de l’écoute de ${libelle}`}
        accessibilityValue={{ min: 0, max: 100, now: progression }}
      >
        <View className="h-2 rounded-full bg-omda-green" style={{ width: `${progression}%` }} />
      </View>

      <View className="mt-2 flex-row items-center justify-between">
        <Text className="text-sm text-omda-textGray">{formaterDuree(statut.currentTime)}</Text>
        <Text className="text-sm text-omda-textGray">
          {enPreparation ? 'Durée inconnue' : formaterDuree(duree)}
        </Text>
      </View>

      <View className="mt-3 gap-3">
        <Button
          libelle={statut.playing ? 'Mettre en pause' : 'Écouter'}
          variante={statut.playing ? 'secondary' : 'primary'}
          icone={statut.playing ? 'pause' : 'play'}
          pleineLargeur
          desactive={enPreparation}
          chargement={enPreparation}
          onPress={basculerLecture}
        />
        {statut.currentTime > 0 && !enPreparation ? (
          <Button
            libelle="Revenir au début"
            variante="secondary"
            icone="clock-rotate-left"
            pleineLargeur
            onPress={() => void player.seekTo(0)}
          />
        ) : null}
      </View>
    </View>
  );
}
