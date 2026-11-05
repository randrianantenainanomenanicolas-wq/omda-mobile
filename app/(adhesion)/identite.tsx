import { router } from 'expo-router';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';

import {
  Button,
  DateField,
  InfoBanner,
  ScreenContainer,
  SelectField,
  StepProgress,
  TextField,
  type OptionSelect,
} from '../../src/components/ui';
import { useAdhesionDraft } from '../../src/context/AdhesionDraftContext';
import { TERRITOIRE_OMDA_FIXE, type AncienChefLieuProvince } from '../../src/models';
import { mockPublicContentService } from '../../src/services/mocks';
import { aujourdhuiLocal } from '../../src/utils/dates';

/**
 * Basse date acceptée pour une naissance : 1er janvier 1900 (locale, jamais UTC).
 * Toute valeur antérieure est hors bornes OMDA.
 */
const DATE_MIN_NAISSANCE = new Date(1900, 0, 1, 0, 0, 0, 0);

/**
 * Date d'ouverture du sélecteur lorsque le champ est vide : il y a 18 ans,
 * jour pour jour (composants locaux). Elle ne préremplit PAS le champ —
 * `date_naissance` reste `''` tant que l'utilisateur ne valide pas.
 */
function dateInitialeNaissance(): Date {
  const aujourdhui = aujourdhuiLocal();
  return new Date(
    aujourdhui.getFullYear() - 18,
    aujourdhui.getMonth(),
    aujourdhui.getDate(),
    0,
    0,
    0,
    0,
  );
}

/**
 * Étape 1 — Identité (écran H du cahier des charges, fiche d'adhésion
 * `docs/FORMULAIRES.md` §1).
 *
 * Sans menu (navigation linéaire). Tous les champs de la fiche native sont
 * représentés ; les formats de stockage restent `AAAA-MM-JJ` (dates) et
 * chaîne libre (textes). Le brouillon local est rétro-compatible : les
 * nouveaux champs apparaissent vides sur les brouillons déjà enregistrés.
 *
 * Champs alignés sur la fiche d'adhésion :
 * - identité civile : nom, prénom, date + lieu de naissance, profession ;
 * - pseudonyme (règle 4 : obligatoire, NON unique) + groupe (règle 3 :
 *   obligatoire, le pseudonyme peut le remplacer à l'affichage) ;
 * - CIN : numéro 12 chiffres + lieu de délivrance + date de délivrance ;
 * - coordonnées : téléphone +261, e-mail, adresse ;
 * - ancien chef-lieu de province : liste de référence servie par le service,
 *   « juste après l'adresse » ;
 * - personne à prévenir (nom + contact) ;
 * - compte bancaire FACULTATIF (jamais bloquant, règle 3) ;
 * - territoire OMDA : valeur fixe affichée en lecture seule (règle 3) ;
 * - le « lieu de réception du droit » n'existe PAS dans l'app (règle 3).
 *
 * Règle 4 étape 28D : tous les champs date utilisent `DateField`.
 *
 * Sauvegarde continue dans le store persistant `AdhesionDraft`.
 */
export default function IdentiteScreen() {
  const {
    brouillon,
    mettreAJourIdentite,
    age,
    estMoinsDe15Ans,
    estMineur15A17,
  } = useAdhesionDraft();

  const identite = brouillon.identite;
  const [tentativeSoumission, setTentativeSoumission] = useState(false);
  const [lieux, setLieux] = useState<AncienChefLieuProvince[]>([]);
  const [erreurChargementLieux, setErreurChargementLieux] = useState<string | null>(null);

  // Référentiel servi par le service : la liste n'est JAMAIS codée en dur.
  useEffect(() => {
    let actif = true;
    void (async () => {
      const res = await mockPublicContentService.listerAnciensChefLieux();
      if (!actif) return;
      if (res.ok) {
        setLieux(res.valeur);
        setErreurChargementLieux(null);
      } else {
        setErreurChargementLieux(res.erreur.message);
      }
    })();
    return () => {
      actif = false;
    };
  }, []);

  const optionsLieux: OptionSelect[] = lieux.map((l) => ({
    valeur: l.id,
    libelle: l.libelle,
  }));

  const validerNom = (val: string) => (!val.trim() ? 'Le nom est obligatoire.' : undefined);
  const validerPrenom = (val: string) => (!val.trim() ? 'Le prénom est obligatoire.' : undefined);
  const validerDate = (val: string) => {
    if (!val.trim()) return 'La date de naissance est obligatoire.';
    if (!/^\d{4}-\d{2}-\d{2}$/.test(val.trim())) {
      return 'Format attendu : AAAA-MM-JJ (ex. 1996-04-12).';
    }
    const d = new Date(`${val.trim()}T00:00:00.000Z`);
    if (Number.isNaN(d.getTime())) {
      return 'La date de naissance est invalide.';
    }
    return undefined;
  };
  const validerLieuNaissance = (val: string) =>
    !val.trim() ? 'Le lieu de naissance est obligatoire.' : undefined;
  const validerPseudonyme = (val: string) =>
    !val.trim() ? 'Le pseudonyme est obligatoire.' : undefined;
  const validerGroupe = (val: string) =>
    !val.trim() ? 'Le groupe est obligatoire (le pseudonyme peut le remplacer à l’affichage).' : undefined;
  const validerProfession = (val: string) =>
    !val.trim() ? 'La profession est obligatoire.' : undefined;
  const validerCin = (val: string) => {
    const propre = val.replace(/\s+/g, '');
    if (!propre) return 'Le numéro de CIN est obligatoire.';
    if (!/^\d{12}$/.test(propre)) {
      return 'Le numéro de CIN doit comporter exactement 12 chiffres.';
    }
    return undefined;
  };
  const validerCinLieu = (val: string) =>
    !val.trim() ? 'Le lieu de délivrance de la CIN est obligatoire.' : undefined;
  const validerCinDate = (val: string) =>
    !val.trim() ? 'La date de délivrance de la CIN est obligatoire.' : undefined;
  const validerTelephone = (val: string) => {
    const propre = val.replace(/\s+/g, '');
    if (!propre || propre === '+261') return 'Le numéro de téléphone est obligatoire.';
    if (!propre.startsWith('+261')) {
      return 'Le numéro doit commencer par l’indicatif +261.';
    }
    if (propre.length < 13) {
      return 'Numéro incomplet : 9 chiffres requis après +261.';
    }
    return undefined;
  };
  const validerEmail = (val: string) => {
    const propre = val.trim();
    if (!propre) return 'L’adresse e-mail est obligatoire.';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(propre)) {
      return 'Indiquez une adresse e-mail valide.';
    }
    return undefined;
  };
  const validerAdresse = (val: string) => (!val.trim() ? 'L’adresse est obligatoire.' : undefined);
  const validerContactNom = (val: string) =>
    !val.trim() ? 'Le nom de la personne à prévenir est obligatoire.' : undefined;
  const validerContactTelephone = (val: string) =>
    !val.trim() ? 'Le contact de la personne à prévenir est obligatoire.' : undefined;
  // Compte bancaire : JAMAIS bloquant (règle 3) — aucune validation.

  const erreurNom = tentativeSoumission ? validerNom(identite.nom) : undefined;
  const erreurPrenom = tentativeSoumission ? validerPrenom(identite.prenom) : undefined;
  const erreurDate = tentativeSoumission ? validerDate(identite.date_naissance) : undefined;
  const erreurLieuNaissance = tentativeSoumission
    ? validerLieuNaissance(identite.lieu_naissance)
    : undefined;
  const erreurPseudonyme = tentativeSoumission ? validerPseudonyme(identite.pseudonyme) : undefined;
  const erreurGroupe = tentativeSoumission ? validerGroupe(identite.groupe) : undefined;
  const erreurProfession = tentativeSoumission ? validerProfession(identite.profession) : undefined;
  const erreurCin = tentativeSoumission ? validerCin(identite.cin) : undefined;
  const erreurCinLieu = tentativeSoumission ? validerCinLieu(identite.cin_lieu_delivrance) : undefined;
  const erreurCinDate = tentativeSoumission ? validerCinDate(identite.cin_date_delivrance) : undefined;
  const erreurTelephone = tentativeSoumission ? validerTelephone(identite.telephone) : undefined;
  const erreurEmail = tentativeSoumission ? validerEmail(identite.email) : undefined;
  const erreurAdresse = tentativeSoumission ? validerAdresse(identite.adresse) : undefined;
  const erreurContactNom = tentativeSoumission
    ? validerContactNom(identite.contact_urgence_nom)
    : undefined;
  const erreurContactTel = tentativeSoumission
    ? validerContactTelephone(identite.contact_urgence_telephone)
    : undefined;

  const verifierEtContinuer = useCallback(() => {
    setTentativeSoumission(true);

    const t = {
      nom: validerNom(identite.nom),
      prenom: validerPrenom(identite.prenom),
      date: validerDate(identite.date_naissance),
      lieuNaissance: validerLieuNaissance(identite.lieu_naissance),
      pseudonyme: validerPseudonyme(identite.pseudonyme),
      groupe: validerGroupe(identite.groupe),
      profession: validerProfession(identite.profession),
      cin: validerCin(identite.cin),
      cinLieu: validerCinLieu(identite.cin_lieu_delivrance),
      cinDate: validerCinDate(identite.cin_date_delivrance),
      tel: validerTelephone(identite.telephone),
      email: validerEmail(identite.email),
      adresse: validerAdresse(identite.adresse),
      contactNom: validerContactNom(identite.contact_urgence_nom),
      contactTel: validerContactTelephone(identite.contact_urgence_telephone),
    };
    const invalide = Object.values(t).some((v) => v !== undefined);
    if (invalide) return;

    if (estMoinsDe15Ans) {
      router.push('/(adhesion)/refus-age');
      return;
    }

    router.push('/(adhesion)/categorie');
  }, [estMoinsDe15Ans, identite]);

  return (
    <ScreenContainer titre="Identité" sousTitre="Demande d’adhésion">
      <StepProgress etapeCourante={1} />

      <Text className="text-base text-omda-textGray">
        Renseignez vos coordonnées exactes telles qu’elles figurent sur votre pièce d’identité.
      </Text>

      {estMineur15A17 ? (
        <View className="mt-4">
          <InfoBanner
            variante="info"
            titre="Candidat mineur (15 à 17 ans)"
            message="Une autorisation parentale signée sera obligatoirement demandée à l’étape 3 (Documents & œuvres)."
          />
        </View>
      ) : null}

      {estMoinsDe15Ans ? (
        <View className="mt-4">
          <InfoBanner
            variante="error"
            titre="Âge minimal non atteint"
            message="L’adhésion à l’OMDA est ouverte à partir de 15 ans. Vous ne pouvez pas poursuivre cette demande."
            actionLibelle="Consulter les règles d’âge"
            onAction={() => router.push('/(adhesion)/refus-age')}
          />
        </View>
      ) : null}

      <View className="mt-5 gap-4">
        <TextField
          libelle="Nom de famille"
          valeur={identite.nom}
          placeholder="RAKOTO"
          obligatoire
          erreur={erreurNom}
          onChangeValeur={(val) => void mettreAJourIdentite({ nom: val })}
        />

        <TextField
          libelle="Prénom(s)"
          valeur={identite.prenom}
          placeholder="Jean"
          obligatoire
          erreur={erreurPrenom}
          onChangeValeur={(val) => void mettreAJourIdentite({ prenom: val })}
        />

        <TextField
          libelle="Pseudonyme"
          valeur={identite.pseudonyme}
          placeholder="Ex. Dao Kanto"
          aide="Obligatoire à toute adhésion, conservable entre catégories, aucune unicité imposée."
          obligatoire
          erreur={erreurPseudonyme}
          onChangeValeur={(val) => void mettreAJourIdentite({ pseudonyme: val })}
        />

        <TextField
          libelle="Groupe"
          valeur={identite.groupe}
          placeholder="Nom du groupe / collectif"
          aide="Obligatoire ; à défaut de groupe, le pseudonyme tient lieu d’identification publique."
          obligatoire
          erreur={erreurGroupe}
          onChangeValeur={(val) => void mettreAJourIdentite({ groupe: val })}
        />

        <DateField
          mode="date"
          libelle="Date de naissance"
          valeur={identite.date_naissance}
          onChangeValeur={(val) => {
            void mettreAJourIdentite({ date_naissance: val });
          }}
          placeholder="Choisir une date"
          dateMin={DATE_MIN_NAISSANCE}
          dateMax={aujourdhuiLocal()}
          dateInitiale={dateInitialeNaissance()}
          aide="Sélectionnez votre date de naissance dans le calendrier."
          obligatoire
          erreur={erreurDate}
        />

        <TextField
          libelle="Lieu de naissance"
          valeur={identite.lieu_naissance}
          placeholder="Antananarivo"
          obligatoire
          erreur={erreurLieuNaissance}
          onChangeValeur={(val) => void mettreAJourIdentite({ lieu_naissance: val })}
        />

        {age !== null && !estMoinsDe15Ans ? (
          <Text className="text-sm font-semibold text-omda-textGray">
            {`Âge calculé : ${age} an${age > 1 ? 's' : ''}`}
          </Text>
        ) : null}

        <TextField
          libelle="Profession"
          valeur={identite.profession}
          placeholder="Auteur-compositeur, enseignant, …"
          obligatoire
          erreur={erreurProfession}
          onChangeValeur={(val) => void mettreAJourIdentite({ profession: val })}
        />

        <TextField
          libelle="Numéro de CIN"
          valeur={identite.cin}
          placeholder="101234567890"
          aide="12 chiffres consécutifs"
          clavier="numeric"
          maxCaracteres={12}
          obligatoire
          erreur={erreurCin}
          onChangeValeur={(val) => void mettreAJourIdentite({ cin: val.replace(/\s+/g, '') })}
        />

        <TextField
          libelle="Lieu de délivrance de la CIN"
          valeur={identite.cin_lieu_delivrance}
          placeholder="Antananarivo"
          obligatoire
          erreur={erreurCinLieu}
          onChangeValeur={(val) => void mettreAJourIdentite({ cin_lieu_delivrance: val })}
        />

        <DateField
          mode="date"
          libelle="Date de délivrance de la CIN"
          valeur={identite.cin_date_delivrance}
          onChangeValeur={(val) => void mettreAJourIdentite({ cin_date_delivrance: val })}
          placeholder="Choisir une date"
          dateMin={DATE_MIN_NAISSANCE}
          dateMax={aujourdhuiLocal()}
          obligatoire
          erreur={erreurCinDate}
        />

        <TextField
          libelle="Téléphone (+261)"
          valeur={identite.telephone}
          placeholder="+261 34 12 345 67"
          aide="Format international (+261…)"
          clavier="phone-pad"
          obligatoire
          erreur={erreurTelephone}
          onChangeValeur={(val) => void mettreAJourIdentite({ telephone: val })}
        />

        <TextField
          libelle="Adresse e-mail"
          valeur={identite.email}
          placeholder="auteur@example.mg"
          aide="Vos avis de traitement et identifiants y seront transmis"
          clavier="email-address"
          obligatoire
          erreur={erreurEmail}
          onChangeValeur={(val) => void mettreAJourIdentite({ email: val.trim() })}
        />

        <TextField
          libelle="Adresse de résidence"
          valeur={identite.adresse}
          placeholder="Lot 12 Bis, Antananarivo 101"
          multiligne
          obligatoire
          erreur={erreurAdresse}
          onChangeValeur={(val) => void mettreAJourIdentite({ adresse: val })}
        />

        {/* Ancien chef-lieu : SERVI par le service, juste après l'adresse. */}
        <SelectField
          libelle="Ancien chef-lieu de province"
          valeur={identite.ancien_chef_lieu_province_id}
          options={optionsLieux}
          placeholder={erreurChargementLieux ?? 'Choisir un ancien chef-lieu'}
          aide={
            erreurChargementLieux ??
            'Liste de référence servie par le service, jamais codée en dur.'
          }
          desactive={Boolean(erreurChargementLieux) || optionsLieux.length === 0}
          onChangeValeur={(val) =>
            void mettreAJourIdentite({ ancien_chef_lieu_province_id: val as string })
          }
        />

        <TextField
          libelle="Personne à prévenir — nom"
          valeur={identite.contact_urgence_nom}
          placeholder="Nom et prénoms"
          obligatoire
          erreur={erreurContactNom}
          onChangeValeur={(val) => void mettreAJourIdentite({ contact_urgence_nom: val })}
        />

        <TextField
          libelle="Personne à prévenir — contact"
          valeur={identite.contact_urgence_telephone}
          placeholder="+261 …"
          clavier="phone-pad"
          obligatoire
          erreur={erreurContactTel}
          onChangeValeur={(val) => void mettreAJourIdentite({ contact_urgence_telephone: val })}
        />

        {/* Compte bancaire FACULTATIF — jamais bloquant (règle 3). */}
        <TextField
          libelle="Compte bancaire (facultatif)"
          valeur={identite.compte_bancaire}
          placeholder="Bg / n° de compte"
          aide="Facultatif : votre adhésion n’est jamais bloquée en l’absence de compte."
          desactive={false}
          onChangeValeur={(val) => void mettreAJourIdentite({ compte_bancaire: val })}
        />

        {/* Territoire OMDA : valeur FIXE affichée en lecture seule (règle 3). */}
        <View className="rounded-xl border border-omda-borderGray bg-omda-warmGray px-4 py-3">
          <Text className="text-sm font-semibold text-omda-black">
            Territoire géré par l’OMDA
          </Text>
          <Text className="mt-1 text-base text-omda-black">{TERRITOIRE_OMDA_FIXE}</Text>
          <Text className="mt-1 text-xs text-omda-textGray">
            Valeur automatique, non modifiable (règle 3).
          </Text>
        </View>
      </View>

      <View className="mt-8 gap-3">
        <Button
          libelle="Continuer vers la catégorie"
          pleineLargeur
          onPress={verifierEtContinuer}
        />
      </View>
    </ScreenContainer>
  );
}
