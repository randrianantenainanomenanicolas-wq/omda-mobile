import DateTimePicker, { type DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { useMemo, useState } from 'react';
import { Modal, Platform, Pressable, ScrollView, Text, View } from 'react-native';

import {
  analyserAAAA_MM_JJ,
  anneeCouranteLocale,
  aujourdhuiLocal,
  formaterJJ_MM_AAAA,
  versAAAA_MM_JJ,
} from '../../utils/dates';
import { Button } from './Button';
import { Icone } from './Icone';

export type ModeDateField = 'date' | 'annee';

export type PropsDateField = {
  mode: ModeDateField;
  libelle: string;
  /** Mode `date` : `AAAA-MM-JJ` (vide autorisé si `obligatoire = false`). Mode `annee` : `AAAA` (idem). */
  valeur: string;
  /** Renvoie la valeur au format de stockage (AAAA-MM-JJ ou AAAA), ou '' si effacée. */
  onChangeValeur: (valeur: string) => void;
  /** Texte affiché lorsque le champ est vide. */
  placeholder?: string;
  aide?: string;
  erreur?: string;
  obligatoire?: boolean;
  desactive?: boolean;
  /** Afficher une action « Effacer » sous le champ (champ facultatif). */
  effacable?: boolean;

  /** Mode `date` : borne basse du sélecteur natif (`minimumDate`). */
  dateMin?: Date;
  /** Mode `date` : borne haute du sélecteur natif (`maximumDate`). */
  dateMax?: Date;
  /**
   * Mode `date` : date d'ouverture du sélecteur lorsque le champ est vide
   * (exemple « il y a 18 ans » pour une date de naissance). Ne préremplit PAS
   * le champ : `valeur` reste inchangée tant que l'utilisateur ne valide pas.
   */
  dateInitiale?: Date;

  /** Mode `annee` : première année de la liste (défaut 1900). */
  anneeMin?: number;
  /** Mode `annee` : dernière année de la liste (défaut année courante). */
  anneeMax?: number;
};

/**
 * Champ de sélection de date ou d'année.
 *
 * - Remplace toute saisie manuelle : le champ n'est plus un `TextInput`, mais
 *   une zone tactile de 48 px qui ouvre un sélecteur.
 * - Mode `date` : sélecteur natif Android (`DateTimePicker` en dialog) ou
 *   modale iOS avec `spinner` localisée `fr-FR` et boutons « Annuler » /
 *   « Valider ». La valeur n'est pushée au parent qu'à la validation.
 * - Mode `annee` : sélecteur maison (modale + liste défilante de la plus
 *   récente à la plus ancienne, année courante mise en évidence) car le
 *   sélecteur natif ne propose pas d'année seule.
 * - Format de stockage inchangé : `AAAA-MM-JJ` en mode date, `AAAA` en mode
 *   année, ce qui préserve la compatibilité avec les brouillons et services
 *   existants.
 *
 * 4 états visuels alignés sur `TextField` : normal, focus ouvert (bordure
 * verte), erreur (bordure `status-error`), désactivé (fond `warmGray`).
 */
export function DateField({
  mode,
  libelle,
  valeur,
  onChangeValeur,
  placeholder = 'Choisir une date',
  aide,
  erreur,
  obligatoire = false,
  desactive = false,
  effacable = false,
  dateMin,
  dateMax,
  dateInitiale,
  anneeMin,
  anneeMax,
}: PropsDateField) {
  const [ouvert, setOuvert] = useState(false);
  const enErreur = Boolean(erreur);

  const analyse = useMemo(
    () => (mode === 'date' ? analyserAAAA_MM_JJ(valeur) : null),
    [mode, valeur],
  );

  const valeurAffichee = useMemo(() => {
    if (mode === 'date') {
      return analyse ? formaterJJ_MM_AAAA(analyse) : '';
    }
    return valeur.trim();
  }, [analyse, mode, valeur]);

  const borneAnneeMin = anneeMin ?? 1900;
  const borneAnneeMax = anneeMax ?? anneeCouranteLocale();

  const positionOuverture = useMemo<Date>(() => {
    if (mode === 'date') {
      if (analyse) return analyse;
      const candidate = dateInitiale ?? aujourdhuiLocal();
      let valeurDate = candidate;
      if (dateMin && valeurDate < dateMin) valeurDate = dateMin;
      if (dateMax && valeurDate > dateMax) valeurDate = dateMax;
      return valeurDate;
    }
    const brute = Number.parseInt(valeur.trim(), 10);
    const anneeValidee = Number.isFinite(brute)
      ? clamp(brute, borneAnneeMin, borneAnneeMax)
      : clamp(anneeCouranteLocale(), borneAnneeMin, borneAnneeMax);
    return new Date(anneeValidee, 0, 1, 0, 0, 0, 0);
  }, [analyse, borneAnneeMax, borneAnneeMin, dateInitiale, dateMax, dateMin, mode, valeur]);

  // Valeur temporaire de la modale iOS (spinner) : rien n'est pushé au parent
  // tant que « Valider » n'est pas pressé.
  const [tempDate, setTempDate] = useState<Date>(positionOuverture);

  const ouvrir = () => {
    if (desactive) return;
    setTempDate(positionOuverture);
    setOuvert(true);
  };
  const fermer = () => setOuvert(false);

  const classeBordure = enErreur
    ? 'border-status-error'
    : ouvert
      ? 'border-omda-green'
      : 'border-omda-borderGray';

  const libelleAccessibilite = valeurAffichee
    ? `${libelle} : ${valeurAffichee}`
    : libelle;

  return (
    <View className="w-full">
      <Text className="mb-1 text-base font-semibold text-omda-black">
        {libelle}
        {obligatoire ? ' *' : ''}
      </Text>

      <Pressable
        accessibilityRole="button"
        accessibilityLabel={libelleAccessibilite}
        accessibilityHint={enErreur ? erreur : aide}
        accessibilityState={{ disabled: desactive, expanded: ouvert }}
        disabled={desactive}
        onPress={ouvrir}
        className="w-full"
      >
        {({ pressed }) => (
          <View
            className={`min-h-12 w-full flex-row items-center rounded-xl border px-4 py-3 ${classeBordure} ${
              desactive ? 'bg-omda-warmGray' : pressed ? 'bg-omda-warmGray' : 'bg-omda-white'
            }`}
          >
            <Icone nom="calendar" taille={16} classeCouleur="text-omda-textGray" />
            <Text
              className={`ml-3 flex-1 text-base ${
                valeurAffichee ? 'text-omda-black' : 'text-omda-textGray'
              }`}
              numberOfLines={1}
            >
              {valeurAffichee || placeholder}
            </Text>
            <Icone nom="chevron-down" taille={16} classeCouleur="text-omda-textGray" />
          </View>
        )}
      </Pressable>

      {effacable && valeurAffichee && !desactive ? (
        <View className="mt-2 flex-row justify-end">
          <Button
            libelle="Effacer"
            variante="secondary"
            icone="xmark"
            onPress={() => onChangeValeur('')}
          />
        </View>
      ) : null}

      {aide && !enErreur ? <Text className="mt-1 text-sm text-omda-textGray">{aide}</Text> : null}

      {enErreur ? (
        <View className="mt-1 flex-row items-start">
          <Icone nom="circle-xmark" taille={14} classeCouleur="text-status-error" />
          <Text className="ml-2 flex-1 text-sm text-status-error">{erreur}</Text>
        </View>
      ) : null}

      {mode === 'date' && ouvert && Platform.OS === 'android' ? (
        <DateTimePicker
          value={positionOuverture}
          mode="date"
          minimumDate={dateMin}
          maximumDate={dateMax}
          onChange={(event: DateTimePickerEvent, date?: Date) => {
            // Android : le dialogue gère lui-même Annuler / Valider ; « set »
            // signifie que l'utilisateur a validé.
            if (event.type === 'set' && date) {
              onChangeValeur(versAAAA_MM_JJ(date));
            }
            fermer();
          }}
        />
      ) : null}

      {mode === 'date' && ouvert && Platform.OS !== 'android' ? (
        <Modal visible transparent animationType="fade" onRequestClose={fermer}>
          <View className="flex-1 items-center justify-center px-6">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer le sélecteur de date"
              onPress={fermer}
              className="absolute inset-0 bg-omda-black opacity-60"
            />
            <View className="w-full max-w-md rounded-2xl bg-omda-white p-5">
              <Text className="text-lg font-bold text-omda-black">{libelle}</Text>

              <DateTimePicker
                value={tempDate}
                mode="date"
                display={Platform.OS === 'ios' ? 'spinner' : 'default'}
                locale="fr-FR"
                minimumDate={dateMin}
                maximumDate={dateMax}
                onChange={(_event, date) => {
                  if (date) setTempDate(date);
                }}
              />

              <View className="mt-4 flex-row justify-end gap-3">
                <Button libelle="Annuler" variante="secondary" onPress={fermer} />
                <Button
                  libelle="Valider"
                  onPress={() => {
                    onChangeValeur(versAAAA_MM_JJ(tempDate));
                    fermer();
                  }}
                />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}

      {mode === 'annee' && ouvert ? (
        <Modal visible transparent animationType="slide" onRequestClose={fermer}>
          <View className="flex-1 justify-end">
            <Pressable
              accessibilityRole="button"
              accessibilityLabel="Fermer la liste des années"
              onPress={fermer}
              className="absolute inset-0 bg-omda-black opacity-60"
            />

            <View className="max-h-[80%] rounded-t-2xl bg-omda-white px-5 pb-6 pt-4">
              <Text className="text-lg font-bold text-omda-black">{libelle}</Text>

              <ScrollView className="mt-2">
                {genererAnnees(borneAnneeMax, borneAnneeMin).map((annee) => {
                  const selectionnee = valeurAffichee === String(annee);
                  const courante = annee === anneeCouranteLocale();
                  return (
                    <Pressable
                      key={annee}
                      accessibilityRole="button"
                      accessibilityLabel={`Année ${annee}${courante ? ' (année courante)' : ''}`}
                      accessibilityState={{ selected: selectionnee }}
                      onPress={() => {
                        onChangeValeur(String(annee));
                        fermer();
                      }}
                      className="w-full"
                    >
                      {({ pressed }) => (
                        <View
                          className={`min-h-12 flex-row items-center justify-between border-b border-omda-borderGray py-3 ${
                            selectionnee || pressed ? 'bg-omda-warmGray' : ''
                          }`}
                        >
                          <Text
                            className={`text-base text-omda-black ${
                              selectionnee ? 'font-semibold' : ''
                            } ${courante ? 'italic' : ''}`}
                          >
                            {annee}
                            {courante ? ' — année courante' : ''}
                          </Text>
                          {selectionnee ? (
                            <Icone nom="check" taille={16} classeCouleur="text-omda-black" />
                          ) : null}
                        </View>
                      )}
                    </Pressable>
                  );
                })}
              </ScrollView>

              <View className="mt-4">
                <Button libelle="Annuler" variante="secondary" pleineLargeur onPress={fermer} />
              </View>
            </View>
          </View>
        </Modal>
      ) : null}
    </View>
  );
}

function clamp(valeur: number, min: number, max: number): number {
  if (valeur < min) return min;
  if (valeur > max) return max;
  return valeur;
}

function genererAnnees(max: number, min: number): number[] {
  const liste: number[] = [];
  for (let annee = max; annee >= min; annee -= 1) {
    liste.push(annee);
  }
  return liste;
}
