import { TAILLE_MAX_FICHIER_OCTETS, type TypeMime } from '../src/models';
import {
  definirDelaisMock,
  definirOperateurActif,
  forcerErreurReseau,
  forcerErreurServeur,
  mockAuthService,
  mockCandidateApi,
  mockMemberRepository,
  mockPublicContentService,
  oeuvresDemandeCategorieMock,
  reinitialiserEchecsConnexion,
  reinitialiserOptionsMock,
} from '../src/services/mocks';

/**
 * Vérification d'exécution des mocks (smoke test) : 111 contrôles sur les 4 mocks
 * + fixtures. Lancer avec `npx --yes tsx tools/verif-mocks.ts` — sortie attendue :
 * `TOUS LES CONTROLES SONT PASSES`.
 */

let echecs = 0;

function verifier(libelle: string, condition: boolean, detail?: string): void {
  if (condition) {
    console.log('[OK]    ' + libelle);
  } else {
    echecs += 1;
    console.log('[ECHEC] ' + libelle + (detail ? ' -> ' + detail : ''));
  }
}

async function principal(): Promise<void> {
  reinitialiserOptionsMock();
  definirDelaisMock(0, 0);

  const operateurs = await mockPublicContentService.listerOperateursMobileMoney();
  verifier(
    'opérateur unique MVola actif (seul opérateur du schéma)',
    operateurs.ok &&
      operateurs.valeur.length === 1 &&
      operateurs.valeur[0].code === 'MVOLA' &&
      operateurs.valeur[0].actif,
  );

  const categories = await mockPublicContentService.listerCategories();
  verifier(
    'catégorie désactivée absente (3 catégories actives)',
    categories.ok && categories.valeur.length === 3,
  );

  const estimation = await mockPublicContentService.estimerMontant({
    type_operation: 'ADHESION',
    categorie_id: null,
  });
  verifier(
    'estimation dynamique = 150 000 Ar + mention + estimation=true',
    estimation.ok &&
      estimation.valeur.montant === 150000 &&
      estimation.valeur.estimation === true &&
      estimation.valeur.mention.length > 0,
  );

  const estimationMusique = await mockPublicContentService.estimerMontant({
    type_operation: 'ADHESION',
    categorie_id: '33333333-3333-4333-8333-333333333333',
  });
  verifier(
    'tarif spécifique à la catégorie appliqué (120 000 Ar)',
    estimationMusique.ok && estimationMusique.valeur.montant === 120000,
  );

  const articleMasque = await mockPublicContentService.obtenirArticle('article-en-preparation');
  verifier(
    'article non publié inaccessible (ARTICLE_INTROUVABLE)',
    !articleMasque.ok && articleMasque.erreur.type === 'metier' && articleMasque.erreur.code === 'ARTICLE_INTROUVABLE',
  );

  await scenarioSuivi();
  await scenarioMobileMoney();
  await scenarioPannes();
  await scenarioMembre();

  console.log(
    echecs === 0 ? 'TOUS LES CONTROLES SONT PASSES' : `${echecs} controle(s) en echec`,
  );
  if (echecs > 0) {
    throw new Error(`${echecs} controle(s) en echec`);
  }
}

/* ------------------------------------------------------------ Scénarios */

/** Œuvre de test minimale (2 œuvres + 1 attestation chacune). */
function oeuvreTest(titre: string) {
  return {
    titre,
    categorie_id: '11111111-1111-4111-8111-111111111111',
    fichier: {
      chemin_stockage: `oeuvres/${titre}.pdf`,
      mime_type: 'application/pdf' as const,
      taille_octets: 120000,
    },
    attestations: [
      {
        chemin_stockage: `oeuvres/${titre}-attestation.pdf`,
        mime_type: 'application/pdf' as const,
        taille_octets: 1200,
      },
    ],
  };
}

async function scenarioSuivi(): Promise<void> {
  const validee = await mockCandidateApi.suivreDemande({
    numero_dossier: 'OMDA-2026-000001',
    code_suivi: 'K7X4-9B2Q',
  });
  verifier(
    'suivi dossier VALIDEE : statut, montant dû et timeline de 4 étapes',
    validee.ok &&
      validee.valeur.statut === 'VALIDEE' &&
      validee.valeur.paiement_du?.montant === 150000 &&
      validee.valeur.etapes.length === 4,
  );

  const rejetee = await mockCandidateApi.suivreDemande({
    numero_dossier: 'OMDA-2026-000003',
    code_suivi: 'R9F2-4H6K',
  });
  verifier(
    'suivi dossier REJETEE : motif obligatoire, aucun paiement dû',
    rejetee.ok &&
      rejetee.valeur.statut === 'REJETEE' &&
      (rejetee.valeur.motif_rejet ?? '').length > 0 &&
      rejetee.valeur.paiement_du === null,
  );

  const codeErrone = await mockCandidateApi.suivreDemande({
    numero_dossier: 'OMDA-2026-000001',
    code_suivi: 'XXXX-0000',
  });
  verifier(
    'code de suivi erroné -> CODE_SUIVI_INVALIDE',
    !codeErrone.ok &&
      codeErrone.erreur.type === 'metier' &&
      codeErrone.erreur.code === 'CODE_SUIVI_INVALIDE',
  );

  const introuvable = await mockCandidateApi.suivreDemande({
    numero_dossier: 'OMDA-2026-999999',
    code_suivi: 'K7X4-9B2Q',
  });
  verifier(
    'dossier inconnu -> DEMANDE_INTROUVABLE',
    !introuvable.ok &&
      introuvable.erreur.type === 'metier' &&
      introuvable.erreur.code === 'DEMANDE_INTROUVABLE',
  );

  const nonValidee = await mockCandidateApi.obtenirOptionsPaiement({
    numero_dossier: 'OMDA-2026-000006',
    code_suivi: 'T4C1-8M5J',
  });
  verifier(
    'paiement refusé si dossier non validé -> DEMANDE_NON_VALIDEE',
    !nonValidee.ok &&
      nonValidee.erreur.type === 'metier' &&
      nonValidee.erreur.code === 'DEMANDE_NON_VALIDEE',
  );

  const options = await mockCandidateApi.obtenirOptionsPaiement({
    numero_dossier: 'OMDA-2026-000001',
    code_suivi: 'K7X4-9B2Q',
  });
  verifier(
    'options : montant serveur + seul mode Mobile Money (MVola)',
    options.ok &&
      options.valeur.paiement_du.montant === 150000 &&
      options.valeur.modes.length === 1 &&
      options.valeur.modes[0].mode === 'MOBILE_MONEY' &&
      options.valeur.modes[0].operateurs.length === 1 &&
      options.valeur.modes[0].operateurs[0].code === 'MVOLA',
  );

  const modification = await mockCandidateApi.mettreAJourDemande(
    'OMDA-2026-000006',
    'T4C1-8M5J',
    { identite: { adresse: 'Lot 10, Fianarantsoa 301' } },
  );
  verifier('mise à jour d’un brouillon acceptée', modification.ok);

  const modificationRefusee = await mockCandidateApi.mettreAJourDemande(
    'OMDA-2026-000005',
    'B2V6-3L9X',
    { identite: { adresse: 'Lot 99' } },
  );
  verifier(
    'mise à jour d’un dossier envoyé -> DEMANDE_NON_MODIFIABLE',
    !modificationRefusee.ok &&
      modificationRefusee.erreur.type === 'metier' &&
      modificationRefusee.erreur.code === 'DEMANDE_NON_MODIFIABLE',
  );

  const mineur = await mockCandidateApi.creerDemande({
    identite: {
      nom: 'TEST',
      prenom: 'Mineur',
      date_naissance: '2015-01-01',
      cin: '101000000000',
      telephone: '+261340000000',
      email: 'mineur@example.mg',
      adresse: 'Lot 1',
    },
    categorie_id: '11111111-1111-4111-8111-111111111111',
  });
  verifier(
    'moins de 15 ans -> AGE_INSUFFISANT',
    !mineur.ok && mineur.erreur.type === 'metier' && mineur.erreur.code === 'AGE_INSUFFISANT',
  );

  const nouveau = await mockCandidateApi.creerDemande({
    identite: {
      nom: 'TEST',
      prenom: 'Adulte',
      date_naissance: '1995-02-02',
      cin: '101999999999',
      telephone: '+261340000000',
      email: 'adulte@example.mg',
      adresse: 'Lot 2',
    },
    categorie_id: '11111111-1111-4111-8111-111111111111',
  });
  verifier(
    'création d’un brouillon : numéro + code de suivi + statut BROUILLON',
    nouveau.ok &&
      nouveau.valeur.numero_dossier.startsWith('OMDA-2026-') &&
      nouveau.valeur.code_suivi.length === 9,
  );

  // Envoi d'un dossier complet : le service confirme numero de dossier + code de
  // suivi (contrat de l'ecran K -> ecran L, aucun paiement declenche).
  const brouillonAdulte = nouveau.ok ? nouveau.valeur : null;
  const soumise = brouillonAdulte
    ? await mockCandidateApi.soumettreDemande({
        numero_dossier: brouillonAdulte.numero_dossier,
        code_suivi: brouillonAdulte.code_suivi,
        categorie_id: '11111111-1111-4111-8111-111111111111',
        pieces: [
          {
            type: 'PHOTO',
            chemin_stockage: 'pieces/photo.jpg',
            mime_type: 'image/jpeg',
            taille_octets: 120000,
          },
          {
            type: 'CIN',
            chemin_stockage: 'pieces/cin.pdf',
            mime_type: 'application/pdf',
            taille_octets: 240000,
          },
          {
            type: 'ACTE_NAISSANCE',
            chemin_stockage: 'pieces/acte.pdf',
            mime_type: 'application/pdf',
            taille_octets: 180000,
          },
          {
            type: 'CERTIFICAT_RESIDENCE',
            chemin_stockage: 'pieces/residence.pdf',
            mime_type: 'application/pdf',
            taille_octets: 150000,
          },
        ],
        oeuvres: [oeuvreTest('varangue'), oeuvreTest('riziere')],
      })
    : null;
  verifier(
    'envoi du dossier complet : numéro + code de suivi + statut ENVOYEE + délai 72 h',
    brouillonAdulte !== null &&
      soumise !== null &&
      soumise.ok &&
      soumise.valeur.numero_dossier === brouillonAdulte.numero_dossier &&
      soumise.valeur.code_suivi === brouillonAdulte.code_suivi &&
      soumise.valeur.statut === 'ENVOYEE' &&
      soumise.valeur.delai_indicatif_heures === 72,
  );

  const autorisationParentale = await mockCandidateApi.soumettreDemande({
    numero_dossier: 'OMDA-2026-000007',
    code_suivi: 'P6L3-2S7D',
    categorie_id: '11111111-1111-4111-8111-111111111111',
    pieces: [
      {
        type: 'PHOTO',
        chemin_stockage: 'pieces/photo.jpg',
        mime_type: 'image/jpeg',
        taille_octets: 120000,
      },
    ],
    oeuvres: [oeuvreTest('a'), oeuvreTest('b')],
  });
  verifier(
    '15–17 ans sans autorisation parentale -> AUTORISATION_PARENTALE_REQUISE',
    !autorisationParentale.ok &&
      autorisationParentale.erreur.type === 'metier' &&
      autorisationParentale.erreur.code === 'AUTORISATION_PARENTALE_REQUISE',
  );

  const dossierIncomplet = await mockCandidateApi.soumettreDemande({
    numero_dossier: 'OMDA-2026-000006',
    code_suivi: 'T4C1-8M5J',
    categorie_id: '33333333-3333-4333-8333-333333333333',
    pieces: [],
    oeuvres: [oeuvreTest('seule')],
  });
  verifier(
    'moins de 2 œuvres -> DOSSIER_INCOMPLET',
    !dossierIncomplet.ok &&
      dossierIncomplet.erreur.type === 'metier' &&
      dossierIncomplet.erreur.code === 'DOSSIER_INCOMPLET',
  );
}

async function scenarioMobileMoney(): Promise<void> {
  // Opérateur désactivé côté « serveur » : MVola doit être refusé pendant ce laps.
  definirOperateurActif('MVOLA', false);
  const operateurInactif = await mockCandidateApi.initierPaiement({
    numero_dossier: 'OMDA-2026-000001',
    code_suivi: 'K7X4-9B2Q',
    mode: 'MOBILE_MONEY',
    operateur: 'MVOLA',
    numero_telephone: '+261340000001',
  });
  verifier(
    'opérateur désactivé -> OPERATEUR_INDISPONIBLE',
    !operateurInactif.ok &&
      operateurInactif.erreur.type === 'metier' &&
      operateurInactif.erreur.code === 'OPERATEUR_INDISPONIBLE',
  );
  definirOperateurActif('MVOLA', true);

  const numeroInvalide = await mockCandidateApi.initierPaiement({
    numero_dossier: 'OMDA-2026-000001',
    code_suivi: 'K7X4-9B2Q',
    mode: 'MOBILE_MONEY',
    operateur: 'MVOLA',
    numero_telephone: '0341234567',
  });
  verifier(
    'numéro sans indicatif +261 -> NUMERO_TELEPHONE_INVALIDE',
    !numeroInvalide.ok &&
      numeroInvalide.erreur.type === 'metier' &&
      numeroInvalide.erreur.code === 'NUMERO_TELEPHONE_INVALIDE',
  );

  const initie = await mockCandidateApi.initierPaiement({
    numero_dossier: 'OMDA-2026-000001',
    code_suivi: 'K7X4-9B2Q',
    mode: 'MOBILE_MONEY',
    operateur: 'MVOLA',
    numero_telephone: '+261340000001',
  });
  verifier(
    'initiation Mobile Money = INITIE (aucun succès annoncé)',
    initie.ok && initie.valeur.statut === 'INITIE' && initie.valeur.date_confirmation === null,
  );
  const reference = initie.ok ? initie.valeur.reference_interne : '';

  const polling1 = await mockCandidateApi.obtenirEtatPaiement(reference);
  verifier(
    'polling 1 -> EN_ATTENTE_CONFIRMATION',
    polling1.ok && polling1.valeur.statut === 'EN_ATTENTE_CONFIRMATION',
  );

  const polling2 = await mockCandidateApi.obtenirEtatPaiement(reference);
  verifier(
    'polling 2 -> REUSSI confirmé par le serveur (+ date_confirmation)',
    polling2.ok && polling2.valeur.statut === 'REUSSI' && polling2.valeur.date_confirmation !== null,
  );

  const dejaReussi = await mockCandidateApi.initierPaiement({
    numero_dossier: 'OMDA-2026-000001',
    code_suivi: 'K7X4-9B2Q',
    mode: 'MOBILE_MONEY',
    operateur: 'MVOLA',
    numero_telephone: '+261340000001',
  });
  verifier(
    'second paiement sur le même dossier -> PAIEMENT_DEJA_REUSSI',
    !dejaReussi.ok &&
      dejaReussi.erreur.type === 'metier' &&
      dejaReussi.erreur.code === 'PAIEMENT_DEJA_REUSSI',
  );

  const paiementInconnu = await mockCandidateApi.obtenirEtatPaiement('PAI-2026-999999');
  verifier(
    'référence de paiement inconnue -> PAIEMENT_INTROUVABLE',
    !paiementInconnu.ok &&
      paiementInconnu.erreur.type === 'metier' &&
      paiementInconnu.erreur.code === 'PAIEMENT_INTROUVABLE',
  );
}

async function scenarioPannes(): Promise<void> {
  forcerErreurReseau(true);
  const panneReseau = await mockPublicContentService.listerCategories();
  verifier(
    'mode debug : erreur réseau simulée',
    !panneReseau.ok && panneReseau.erreur.type === 'reseau',
  );
  forcerErreurReseau(false);

  forcerErreurServeur(true);
  const panneServeur = await mockCandidateApi.suivreDemande({
    numero_dossier: 'OMDA-2026-000001',
    code_suivi: 'K7X4-9B2Q',
  });
  verifier(
    'mode debug : erreur serveur 503 simulée',
    !panneServeur.ok &&
      panneServeur.erreur.type === 'serveur' &&
      panneServeur.erreur.statut_http === 503,
  );
  forcerErreurServeur(false);

  const apresPannes = await mockPublicContentService.listerCategories();
  verifier('pannes désactivées : appels normaux', apresPannes.ok);

  definirDelaisMock(300, 300);
  const debut = Date.now();
  await mockPublicContentService.listerCategories();
  const duree = Date.now() - debut;
  verifier('délai réseau simulé respecté (>= 250 ms)', duree >= 250, `${duree} ms`);
  definirDelaisMock(0, 0);

  definirOperateurActif('MVOLA', false);
  const sansMvola = await mockPublicContentService.listerOperateursMobileMoney();
  verifier(
    'opérateur désactivé : la liste devient vide (liste dynamique)',
    sansMvola.ok && sansMvola.valeur.length === 0,
  );
  definirOperateurActif('MVOLA', true);
  const avecMvola = await mockPublicContentService.listerOperateursMobileMoney();
  verifier(
    'opérateur réactivé côté « serveur » : MVola réapparaît',
    avecMvola.ok && avecMvola.valeur.length === 1 && avecMvola.valeur[0].code === 'MVOLA',
  );
}

async function scenarioMembreConnexion(): Promise<void> {
  const sansSession = await mockMemberRepository.obtenirProfil();
  verifier(
    'sans session -> NON_AUTHENTIFIE',
    !sansSession.ok &&
      sansSession.erreur.type === 'metier' &&
      sansSession.erreur.code === 'NON_AUTHENTIFIE',
  );

  const desactive = await mockAuthService.connecter({
    email: 'desactive@omda.mg',
    mot_de_passe: 'Omda2026!',
  });
  verifier(
    'compte désactivé -> COMPTE_DESACTIVE',
    !desactive.ok &&
      desactive.erreur.type === 'metier' &&
      desactive.erreur.code === 'COMPTE_DESACTIVE',
  );

  const mauvaisMotDePasse = await mockAuthService.connecter({
    email: 'membre@omda.mg',
    mot_de_passe: 'mauvais',
  });
  verifier(
    'mot de passe incorrect -> IDENTIFIANTS_INVALIDES',
    !mauvaisMotDePasse.ok &&
      mauvaisMotDePasse.erreur.type === 'metier' &&
      mauvaisMotDePasse.erreur.code === 'IDENTIFIANTS_INVALIDES',
  );

  const connexion = await mockAuthService.connecter({
    email: 'membre@omda.mg',
    mot_de_passe: 'Omda2026!',
  });
  verifier(
    'connexion membre réussie (numéro d’adhérent présent)',
    connexion.ok && connexion.valeur.membre?.numero_adherent === 'OMDA-2026-A-000123',
  );

  const profil = await mockMemberRepository.obtenirProfil();
  verifier('profil : 1 catégorie active', profil.ok && profil.valeur.categories.length === 1);

  const tableau = await mockMemberRepository.obtenirTableauDeBord();
  verifier(
    'tableau de bord : 3 œuvres + 2 notifications non lues + cotisation 2026 NON_PAYEE',
    tableau.ok &&
      tableau.valeur.nombre_oeuvres === 3 &&
      tableau.valeur.notifications_non_lues === 2 &&
      tableau.valeur.cotisation_annee?.statut === 'NON_PAYEE' &&
      tableau.valeur.prenom === 'Jean',
  );

  const oeuvres = await mockMemberRepository.listerOeuvres();
  verifier(
    'œuvre REJETEE avec motif (jamais vide)',
    oeuvres.ok &&
      oeuvres.valeur.length === 3 &&
      oeuvres.valeur.some(
        (oeuvre) => oeuvre.statut === 'REJETEE' && (oeuvre.motif_rejet ?? '').length > 0,
      ),
  );

  const oeuvresValidees = await mockMemberRepository.listerOeuvres({ statut: 'VALIDEE' });
  verifier('filtre par statut : 1 œuvre VALIDEE', oeuvresValidees.ok && oeuvresValidees.valeur.length === 1);

  const paiementOeuvreNonValidee = await mockMemberRepository.initierPaiement({
    type: 'DEPOT_OEUVRE',
    mode: 'MOBILE_MONEY',
    operateur: 'MVOLA',
    numero_telephone: '+261340000001',
    oeuvre_id: 'a0000000-0000-4000-8000-000000000002',
  });
  verifier(
    'dépôt d’une œuvre non validée -> OEUVRE_NON_VALIDEE',
    !paiementOeuvreNonValidee.ok &&
      paiementOeuvreNonValidee.erreur.type === 'metier' &&
      paiementOeuvreNonValidee.erreur.code === 'OEUVRE_NON_VALIDEE',
  );

  const paiementOeuvreValidee = await mockMemberRepository.initierPaiement({
    type: 'DEPOT_OEUVRE',
    mode: 'MOBILE_MONEY',
    operateur: 'MVOLA',
    numero_telephone: '+261340000001',
    oeuvre_id: 'a0000000-0000-4000-8000-000000000001',
  });
  verifier(
    'dépôt initié : montant du tarif (50 000 Ar) et statut INITIE',
    paiementOeuvreValidee.ok &&
      paiementOeuvreValidee.valeur.montant === 50000 &&
      paiementOeuvreValidee.valeur.statut === 'INITIE',
  );
  const idPaiementOeuvre = paiementOeuvreValidee.ok ? paiementOeuvreValidee.valeur.id : '';
  await mockMemberRepository.obtenirPaiement(idPaiementOeuvre);
  const etatPaiementOeuvre = await mockMemberRepository.obtenirPaiement(idPaiementOeuvre);
  verifier(
    'dépôt confirmé -> REUSSI + effet serveur DEPOT_FINALISE',
    etatPaiementOeuvre.ok && etatPaiementOeuvre.valeur.statut === 'REUSSI',
  );
  const oeuvreFinalisee = await mockMemberRepository.obtenirOeuvre(
    'a0000000-0000-4000-8000-000000000001',
  );
  verifier(
    'œuvre passée en DEPOT_FINALISE après paiement confirmé',
    oeuvreFinalisee.ok && oeuvreFinalisee.valeur.statut === 'DEPOT_FINALISE',
  );
}

/**
 * Écrans Q, R, S (partie 2 de l'espace membre) — cycle de vie d'une œuvre :
 * brouillon, modification, téléversement (progression, annulation, contrôles
 * 20 Mo / type MIME), envoi `ENVOYEE` SANS paiement (règle métier 4), refus des
 * paiements d'œuvre non validée, cotisation de l'année et erreurs de paiement.
 * S'exécute avec la session du compte « complet » (`membre@omda.mg`) encore
 * ouverte et n'ajoute AUCUNE notification (aucun paiement confirmé).
 */
async function scenarioMembreOeuvres(): Promise<void> {
  const appartenances = await mockMemberRepository.listerCategoriesMembre();
  const categorieId = appartenances.ok ? appartenances.valeur.categories[0].id : '';

  const brouillon = await mockMemberRepository.creerOeuvre({
    titre: 'Poèmes de la côte',
    categorie_id: categorieId,
    description: 'Recueil en chantier.',
    annee: 2026,
  });
  verifier(
    'création d’une œuvre -> BROUILLON (ni fichier, ni envoi, ni paiement)',
    brouillon.ok &&
      brouillon.valeur.statut === 'BROUILLON' &&
      brouillon.valeur.chemin_fichier === null &&
      brouillon.valeur.date_soumission === null &&
      brouillon.valeur.motif_rejet === null,
  );
  const oeuvreId = brouillon.ok ? brouillon.valeur.id : '';

  const brouillons = await mockMemberRepository.listerOeuvres({ statut: 'BROUILLON' });
  verifier(
    'filtre BROUILLON : le brouillon créé est listé',
    brouillons.ok && brouillons.valeur.some((oeuvre) => oeuvre.id === oeuvreId),
  );

  const modifie = await mockMemberRepository.mettreAJourOeuvre(oeuvreId, {
    titre: 'Poèmes de la côte (version 2)',
    annee: 2025,
  });
  verifier(
    'brouillon modifiable (titre + année)',
    modifie.ok &&
      modifie.valeur.titre === 'Poèmes de la côte (version 2)' &&
      modifie.valeur.annee === 2025,
  );

  const progressions: number[] = [];
  const fichier = await mockMemberRepository.televerserFichier(
    {
      bucket: 'oeuvres',
      chemin_stockage: 'oeuvres/brouillons/poemes-cote.pdf',
      fichier_uri: 'file:///tmp/poemes-cote.pdf',
      nom_fichier: 'poemes-cote.pdf',
      mime_type: 'application/pdf',
      taille_octets: 512000,
    },
    { onProgression: (pourcentage) => progressions.push(pourcentage) },
  );
  verifier(
    'téléversement d’une œuvre : progression 0 → 100 puis référence déposée',
    fichier.ok &&
      fichier.valeur.chemin_stockage === 'oeuvres/brouillons/poemes-cote.pdf' &&
      progressions.length > 0 &&
      progressions[progressions.length - 1] === 100,
  );

  const mimeRefuse = await mockMemberRepository.televerserFichier({
    bucket: 'oeuvres',
    chemin_stockage: 'oeuvres/brouillons/mauvais-format.gif',
    fichier_uri: 'file:///tmp/mauvais-format.gif',
    nom_fichier: 'mauvais-format.gif',
    mime_type: 'image/gif' as TypeMime,
    taille_octets: 1024,
  });
  verifier(
    'format non autorisé refusé (TYPE_FICHIER_NON_AUTORISE)',
    !mimeRefuse.ok &&
      mimeRefuse.erreur.type === 'metier' &&
      mimeRefuse.erreur.code === 'TYPE_FICHIER_NON_AUTORISE',
  );

  const tropVolumineux = await mockMemberRepository.televerserFichier({
    bucket: 'oeuvres',
    chemin_stockage: 'oeuvres/brouillons/trop-gros.pdf',
    fichier_uri: 'file:///tmp/trop-gros.pdf',
    nom_fichier: 'trop-gros.pdf',
    mime_type: 'application/pdf',
    taille_octets: TAILLE_MAX_FICHIER_OCTETS + 1,
  });
  verifier(
    'fichier dépassant 20 Mo refusé (FICHIER_TROP_VOLUMINEUX)',
    !tropVolumineux.ok &&
      tropVolumineux.erreur.type === 'metier' &&
      tropVolumineux.erreur.code === 'FICHIER_TROP_VOLUMINEUX',
  );

  const controleur = new AbortController();
  controleur.abort();
  const envoiAnnule = await mockMemberRepository.televerserFichier(
    {
      bucket: 'oeuvres',
      chemin_stockage: 'oeuvres/brouillons/interrompu.pdf',
      fichier_uri: 'file:///tmp/interrompu.pdf',
      nom_fichier: 'interrompu.pdf',
      mime_type: 'application/pdf',
      taille_octets: 2048,
    },
    { signal: controleur.signal },
  );
  verifier(
    'envoi annulé -> TELEVERSEMENT_ANNULE (reprise possible)',
    !envoiAnnule.ok &&
      envoiAnnule.erreur.type === 'metier' &&
      envoiAnnule.erreur.code === 'TELEVERSEMENT_ANNULE',
  );

  const fichierDepose = fichier.ok
    ? fichier.valeur
    : { chemin_stockage: '', mime_type: 'application/pdf' as TypeMime, taille_octets: 0 };
  const attestation = {
    chemin_stockage: 'oeuvres/brouillons/attestation-cote.pdf',
    mime_type: 'application/pdf' as TypeMime,
    taille_octets: 98304,
  };

  const sansAttestation = await mockMemberRepository.soumettreOeuvre({
    oeuvre_id: oeuvreId,
    fichier: fichierDepose,
    attestations: [],
  });
  verifier(
    'envoi sans attestation de diffusion refusé (règle métier 8)',
    !sansAttestation.ok &&
      sansAttestation.erreur.type === 'metier' &&
      sansAttestation.erreur.code === 'DOSSIER_INCOMPLET',
  );

  const envoyee = await mockMemberRepository.soumettreOeuvre({
    oeuvre_id: oeuvreId,
    fichier: fichierDepose,
    attestations: [attestation],
  });
  verifier(
    'envoi de l’œuvre -> ENVOYEE avec fichier et date de soumission',
    envoyee.ok &&
      envoyee.valeur.statut === 'ENVOYEE' &&
      envoyee.valeur.chemin_fichier === fichierDepose.chemin_stockage &&
      envoyee.valeur.date_soumission !== null,
  );

  const paiementAvantValidation = await mockMemberRepository.initierPaiement({
    type: 'DEPOT_OEUVRE',
    mode: 'MOBILE_MONEY',
    operateur: 'MVOLA',
    numero_telephone: '+261340000001',
    oeuvre_id: oeuvreId,
  });
  verifier(
    'AUCUN paiement à l’envoi : paiement refusé tant que l’œuvre n’est pas VALIDEE',
    !paiementAvantValidation.ok &&
      paiementAvantValidation.erreur.type === 'metier' &&
      paiementAvantValidation.erreur.code === 'OEUVRE_NON_VALIDEE',
  );

  const paiementOeuvreRejetee = await mockMemberRepository.initierPaiement({
    type: 'DEPOT_OEUVRE',
    mode: 'MOBILE_MONEY',
    operateur: 'MVOLA',
    numero_telephone: '+261340000001',
    oeuvre_id: 'a0000000-0000-4000-8000-000000000003',
  });
  verifier(
    'œuvre REJETEE non payable (OEUVRE_NON_VALIDEE)',
    !paiementOeuvreRejetee.ok &&
      paiementOeuvreRejetee.erreur.type === 'metier' &&
      paiementOeuvreRejetee.erreur.code === 'OEUVRE_NON_VALIDEE',
  );

  /** Tant que l'OMDA n'a pas statué, une œuvre ENVOYEE reste corrigeable. */
  const fichierCorrige = {
    chemin_stockage: 'oeuvres/corrections/poemes-cote-v2.pdf',
    mime_type: 'application/pdf' as TypeMime,
    taille_octets: 640000,
  };
  const attestationCorrigee = {
    chemin_stockage: 'oeuvres/corrections/attestation-cote-v2.pdf',
    mime_type: 'application/pdf' as TypeMime,
    taille_octets: 102400,
  };

  const correctionApresEnvoi = await mockMemberRepository.mettreAJourOeuvre(oeuvreId, {
    titre: 'Poèmes de la côte (corrigé)',
    fichier: fichierCorrige,
    attestation: attestationCorrigee,
  });
  verifier(
    'œuvre ENVOYEE corrigeable : titre, fichier et attestation remplacés, statut inchangé',
    correctionApresEnvoi.ok &&
      correctionApresEnvoi.valeur.titre === 'Poèmes de la côte (corrigé)' &&
      correctionApresEnvoi.valeur.chemin_fichier === fichierCorrige.chemin_stockage &&
      correctionApresEnvoi.valeur.taille_octets === fichierCorrige.taille_octets &&
      correctionApresEnvoi.valeur.statut === 'ENVOYEE',
  );

  const attestationsEnregistrees = await mockMemberRepository.listerAttestationsOeuvre(oeuvreId);
  verifier(
    'attestation REMPLACÉE (une seule, jamais supprimée — règle métier 8)',
    attestationsEnregistrees.ok &&
      attestationsEnregistrees.valeur.length === 1 &&
      attestationsEnregistrees.valeur[0].chemin_stockage === attestationCorrigee.chemin_stockage,
  );

  /** Consultation d'un document : lien temporaire demandé au service. */
  const urlFichierTeleverse = await mockMemberRepository.obtenirUrlFichier(
    'oeuvres/brouillons/poemes-cote.pdf',
  );
  verifier(
    'lien d’un fichier téléversé : URI locale de la session (écoute réelle)',
    urlFichierTeleverse.ok && urlFichierTeleverse.valeur.url === 'file:///tmp/poemes-cote.pdf',
  );

  const urlFichierJeuDeTest = await mockMemberRepository.obtenirUrlFichier(
    'oeuvres/jeux-de-test/varangue.mp3',
  );
  verifier(
    'lien d’un document des jeux de test : URL signée du bucket simulé',
    urlFichierJeuDeTest.ok &&
      urlFichierJeuDeTest.valeur.url.startsWith('https://mock.omda.mg/storage/') &&
      urlFichierJeuDeTest.valeur.url.includes('oeuvres/jeux-de-test/varangue.mp3'),
  );

  const urlFichierAbsent = await mockMemberRepository.obtenirUrlFichier('   ');
  verifier(
    'chemin de stockage vide -> FICHIER_INTROUVABLE',
    !urlFichierAbsent.ok &&
      urlFichierAbsent.erreur.type === 'metier' &&
      urlFichierAbsent.erreur.code === 'FICHIER_INTROUVABLE',
  );

  const oeuvreValideeFigee = await mockMemberRepository.mettreAJourOeuvre(
    'a0000000-0000-4000-8000-000000000001',
    { titre: 'Titre interdit' },
  );
  verifier(
    'œuvre VALIDEE figée (OEUVRE_NON_MODIFIABLE)',
    !oeuvreValideeFigee.ok &&
      oeuvreValideeFigee.erreur.type === 'metier' &&
      oeuvreValideeFigee.erreur.code === 'OEUVRE_NON_MODIFIABLE',
  );

  const renvoi = await mockMemberRepository.soumettreOeuvre({
    oeuvre_id: oeuvreId,
    fichier: fichierDepose,
    attestations: [attestation],
  });
  verifier(
    'second envoi de la même œuvre refusé (OEUVRE_NON_MODIFIABLE)',
    !renvoi.ok && renvoi.erreur.type === 'metier' && renvoi.erreur.code === 'OEUVRE_NON_MODIFIABLE',
  );

  const oeuvreIntrouvable = await mockMemberRepository.obtenirOeuvre(
    'a0000000-0000-4000-8000-0000000000ff',
  );
  verifier(
    'œuvre inconnue -> OEUVRE_INTROUVABLE',
    !oeuvreIntrouvable.ok &&
      oeuvreIntrouvable.erreur.type === 'metier' &&
      oeuvreIntrouvable.erreur.code === 'OEUVRE_INTROUVABLE',
  );

  const cotisation2026 = await mockMemberRepository.obtenirCotisation(2026);
  verifier(
    'cotisation 2026 : NON_PAYEE, montant du service, aucune date de paiement',
    cotisation2026.ok &&
      cotisation2026.valeur.statut === 'NON_PAYEE' &&
      cotisation2026.valeur.montant > 0 &&
      cotisation2026.valeur.date_paiement === null,
  );
  const cotisationId = cotisation2026.ok ? cotisation2026.valeur.id : '';

  const cotisationAbsente = await mockMemberRepository.obtenirCotisation(2024);
  verifier(
    'année sans cotisation -> COTISATION_INTROUVABLE',
    !cotisationAbsente.ok &&
      cotisationAbsente.erreur.type === 'metier' &&
      cotisationAbsente.erreur.code === 'COTISATION_INTROUVABLE',
  );

  // Opérateur désactivé côté « serveur » : MVola doit être refusé pendant ce laps.
  definirOperateurActif('MVOLA', false);
  const operateurInactif = await mockMemberRepository.initierPaiement({
    type: 'COTISATION',
    cotisation_id: cotisationId,
    mode: 'MOBILE_MONEY',
    operateur: 'MVOLA',
    numero_telephone: '+261340000001',
  });
  verifier(
    'opérateur désactivé refusé (OPERATEUR_INDISPONIBLE)',
    !operateurInactif.ok &&
      operateurInactif.erreur.type === 'metier' &&
      operateurInactif.erreur.code === 'OPERATEUR_INDISPONIBLE',
  );
  definirOperateurActif('MVOLA', true);

  const numeroInvalide = await mockMemberRepository.initierPaiement({
    type: 'COTISATION',
    cotisation_id: cotisationId,
    mode: 'MOBILE_MONEY',
    operateur: 'MVOLA',
    numero_telephone: '0340000001',
  });
  verifier(
    'numéro hors format international refusé (NUMERO_TELEPHONE_INVALIDE)',
    !numeroInvalide.ok &&
      numeroInvalide.erreur.type === 'metier' &&
      numeroInvalide.erreur.code === 'NUMERO_TELEPHONE_INVALIDE',
  );

  const fraisDepot = await mockPublicContentService.estimerMontant({
    type_operation: 'DEPOT_OEUVRE',
    categorie_id: categorieId,
  });
  verifier(
    'frais de dépôt fournis par le service (montant > 0 + mention d’estimation)',
    fraisDepot.ok &&
      fraisDepot.valeur.montant > 0 &&
      fraisDepot.valeur.estimation === true &&
      fraisDepot.valeur.mention.length > 0,
  );
}

/**
 * Règle métier 9 — catégories multiples : appartenance unique, demande de
 * catégorie supplémentaire au statut `EN_ATTENTE` et refus des doublons.
 * S'exécute avec la session `membre@omda.mg` encore ouverte (1 catégorie ACTIVE).
 */
async function scenarioMembreCategories(): Promise<void> {
  const depart = await mockMemberRepository.listerCategoriesMembre();
  verifier(
    'catégories du membre : 1 appartenance ACTIVE au départ',
    depart.ok &&
      depart.valeur.categories.length === 1 &&
      depart.valeur.membre_categories.length === 1 &&
      depart.valeur.membre_categories[0].statut === 'ACTIVE',
  );

  // Écrivain : catégorie active et absente du profil.
  const demande = await mockMemberRepository.demanderCategorieSupplementaire(
    '22222222-2222-4222-8222-222222222222',
  );
  verifier(
    'demande de catégorie supplémentaire -> EN_ATTENTE (aucune activation locale)',
    demande.ok &&
      demande.valeur.statut === 'EN_ATTENTE' &&
      demande.valeur.categorie_id === '22222222-2222-4222-8222-222222222222' &&
      demande.valeur.date_activation.length > 0,
  );

  const apresDemande = await mockMemberRepository.listerCategoriesMembre();
  verifier(
    'après demande : 2 catégories (1 ACTIVE + 1 EN_ATTENTE)',
    apresDemande.ok &&
      apresDemande.valeur.categories.length === 2 &&
      apresDemande.valeur.membre_categories.filter(
        (element) => element.statut === 'EN_ATTENTE',
      ).length === 1,
  );

  const doublon = await mockMemberRepository.demanderCategorieSupplementaire(
    '22222222-2222-4222-8222-222222222222',
  );
  verifier(
    'seconde demande pour la même catégorie -> CATEGORIE_DEJA_DEMANDEE',
    !doublon.ok &&
      doublon.erreur.type === 'metier' &&
      doublon.erreur.code === 'CATEGORIE_DEJA_DEMANDEE',
  );

  const dejaRattachee = await mockMemberRepository.demanderCategorieSupplementaire(
    '11111111-1111-4111-8111-111111111111',
  );
  verifier(
    'catégorie déjà ACTIVE au profil -> CATEGORIE_DEJA_ENREGISTREE',
    !dejaRattachee.ok &&
      dejaRattachee.erreur.type === 'metier' &&
      dejaRattachee.erreur.code === 'CATEGORIE_DEJA_ENREGISTREE',
  );

  const inactive = await mockMemberRepository.demanderCategorieSupplementaire(
    '44444444-4444-4444-8444-444444444444',
  );
  verifier(
    'catégorie désactivée -> CATEGORIE_INDISPONIBLE',
    !inactive.ok &&
      inactive.erreur.type === 'metier' &&
      inactive.erreur.code === 'CATEGORIE_INDISPONIBLE',
  );

  const profilApres = await mockMemberRepository.obtenirProfil();
  verifier(
    'profil final : 2 catégories (dont 1 « Demande en attente »)',
    profilApres.ok &&
      profilApres.valeur.categories.length === 2 &&
      profilApres.valeur.membre_categories.some(
        (element) => element.statut === 'EN_ATTENTE',
      ),
  );
}

/** Œuvre jointe telle que transmise à `demanderCategorieSupplementaireAvecOeuvres`. */
type OeuvreDemandeTest = Parameters<
  typeof mockMemberRepository.demanderCategorieSupplementaireAvecOeuvres
>[0]['oeuvres'][number];

/** Œuvre complète : titre + fichier + attestation de diffusion (2 fichiers déposés). */
function oeuvreCompleteTest(titre: string): OeuvreDemandeTest {
  return {
    titre,
    fichier: {
      chemin_stockage: `oeuvres/${titre}.mp3`,
      mime_type: 'audio/mpeg',
      taille_octets: 3500000,
    },
    attestation: {
      chemin_stockage: `oeuvres/${titre}-attestation.pdf`,
      mime_type: 'application/pdf',
      taille_octets: 420000,
    },
  };
}

/**
 * Règles métier 9 + 8 étendues — demande de catégorie AVEC œuvres jointes et
 * annulation : minimum 2 œuvres, complétude (titre / fichier / attestation),
 * limite de 20 Mo revalidée, création `EN_ATTENTE` avec œuvres jointes en
 * mémoire, annulation → `ANNULEE` (+ œuvres retirées), refus d'annulation hors
 * `EN_ATTENTE`, et réouverture d'une demande annulée.
 * S'exécute avec la session `membre@omda.mg` encore ouverte (1 ACTIVE +
 * 1 EN_ATTENTE issues du scénario précédent ; cat_3333 reste libre).
 */
async function scenarioDemandeCategorieOeuvres(): Promise<void> {
  const categorieLibre = '33333333-3333-4333-8333-333333333333';

  const uneSeule = await mockMemberRepository.demanderCategorieSupplementaireAvecOeuvres({
    categorie_id: categorieLibre,
    oeuvres: [oeuvreCompleteTest('oeuvre-seule')],
  });
  verifier(
    'demande avec 1 seule œuvre -> OEUVRE_MINIMUM_REQUIS',
    !uneSeule.ok &&
      uneSeule.erreur.type === 'metier' &&
      uneSeule.erreur.code === 'OEUVRE_MINIMUM_REQUIS',
  );

  const titreManquant = await mockMemberRepository.demanderCategorieSupplementaireAvecOeuvres({
    categorie_id: categorieLibre,
    oeuvres: [{ ...oeuvreCompleteTest('sans-titre'), titre: '   ' }, oeuvreCompleteTest('b')],
  });
  verifier(
    'œuvre sans titre -> OEUVRE_INCOMPLETE',
    !titreManquant.ok &&
      titreManquant.erreur.type === 'metier' &&
      titreManquant.erreur.code === 'OEUVRE_INCOMPLETE',
  );

  const sansAttestation = await mockMemberRepository.demanderCategorieSupplementaireAvecOeuvres({
    categorie_id: categorieLibre,
    oeuvres: [
      oeuvreCompleteTest('a'),
      {
        ...oeuvreCompleteTest('b'),
        attestation: {
          chemin_stockage: '',
          mime_type: 'application/pdf',
          taille_octets: 420000,
        },
      },
    ],
  });
  verifier(
    '2 œuvres dont 1 sans attestation -> ATTESTATION_MANQUANTE',
    !sansAttestation.ok &&
      sansAttestation.erreur.type === 'metier' &&
      sansAttestation.erreur.code === 'ATTESTATION_MANQUANTE',
  );

  const tropVolumineuse = await mockMemberRepository.demanderCategorieSupplementaireAvecOeuvres({
    categorie_id: categorieLibre,
    oeuvres: [
      {
        ...oeuvreCompleteTest('a'),
        fichier: { ...oeuvreCompleteTest('a').fichier, taille_octets: 26214400 },
      },
      oeuvreCompleteTest('b'),
    ],
  });
  verifier(
    'fichier de 25 Mo -> FICHIER_TROP_VOLUMINEUX (revalidation)',
    !tropVolumineuse.ok &&
      tropVolumineuse.erreur.type === 'metier' &&
      tropVolumineuse.erreur.code === 'FICHIER_TROP_VOLUMINEUX',
  );

  const demande = await mockMemberRepository.demanderCategorieSupplementaireAvecOeuvres({
    categorie_id: categorieLibre,
    oeuvres: [oeuvreCompleteTest('a'), oeuvreCompleteTest('b')],
  });
  verifier(
    'demande avec 2 œuvres complètes -> EN_ATTENTE',
    demande.ok &&
      demande.valeur.statut === 'EN_ATTENTE' &&
      demande.valeur.categorie_id === categorieLibre,
  );
  verifier(
    'œuvres jointes enregistrées côté « serveur » (2)',
    demande.ok && (oeuvresDemandeCategorieMock.get(demande.valeur.id)?.length ?? -1) === 2,
  );

  const doublon = await mockMemberRepository.demanderCategorieSupplementaireAvecOeuvres({
    categorie_id: categorieLibre,
    oeuvres: [oeuvreCompleteTest('a'), oeuvreCompleteTest('b')],
  });
  verifier(
    'seconde demande pour la même catégorie -> CATEGORIE_DEJA_DEMANDEE',
    !doublon.ok &&
      doublon.erreur.type === 'metier' &&
      doublon.erreur.code === 'CATEGORIE_DEJA_DEMANDEE',
  );

  if (demande.ok) {
    const annulee = await mockMemberRepository.annulerDemandeCategorie(demande.valeur.id);
    verifier(
      'annulation d’une demande EN_ATTENTE -> ANNULEE (enregistrement conservé)',
      annulee.ok &&
        annulee.valeur.statut === 'ANNULEE' &&
        annulee.valeur.id === demande.valeur.id,
    );
    verifier(
      'œuvres jointes retirées après annulation (0)',
      (oeuvresDemandeCategorieMock.get(demande.valeur.id)?.length ?? -1) === 0,
    );

    const reannulation = await mockMemberRepository.annulerDemandeCategorie(demande.valeur.id);
    verifier(
      'demande déjà ANNULEE -> DEMANDE_NON_ANNUABLE',
      !reannulation.ok &&
        reannulation.erreur.type === 'metier' &&
        reannulation.erreur.code === 'DEMANDE_NON_ANNUABLE',
    );

    const inconnue = await mockMemberRepository.annulerDemandeCategorie(
      'ffffffff-ffff-4fff-8fff-ffffffffffff',
    );
    verifier(
      'demande inconnue -> DEMANDE_CATEGORIE_INTROUVABLE',
      !inconnue.ok &&
        inconnue.erreur.type === 'metier' &&
        inconnue.erreur.code === 'DEMANDE_CATEGORIE_INTROUVABLE',
    );

    const reouverture = await mockMemberRepository.demanderCategorieSupplementaireAvecOeuvres({
      categorie_id: categorieLibre,
      oeuvres: [oeuvreCompleteTest('a'), oeuvreCompleteTest('b')],
    });
    verifier(
      'demande réouvrable après annulation -> nouvel EN_ATTENTE avec œuvres',
      reouverture.ok &&
        reouverture.valeur.statut === 'EN_ATTENTE' &&
        reouverture.valeur.id === demande.valeur.id &&
        (oeuvresDemandeCategorieMock.get(reouverture.valeur.id)?.length ?? -1) === 2,
    );
  } else {
    verifier('annulation / réouverture (non exécutable sans demande valide)', false, 'échec');
  }

  const appartenances = await mockMemberRepository.listerCategoriesMembre();
  const active = appartenances.ok
    ? appartenances.valeur.membre_categories.find((element) => element.statut === 'ACTIVE')
    : undefined;
  if (active) {
    const annulationActive = await mockMemberRepository.annulerDemandeCategorie(active.id);
    verifier(
      'catégorie ACTIVE -> annulation refusée (DEMANDE_NON_ANNUABLE)',
      !annulationActive.ok &&
        annulationActive.erreur.type === 'metier' &&
        annulationActive.erreur.code === 'DEMANDE_NON_ANNUABLE',
    );
  } else {
    verifier(
      'catégorie ACTIVE -> annulation refusée (DEMANDE_NON_ANNUABLE)',
      false,
      'aucune appartenance ACTIVE',
    );
  }
}

async function scenarioMembreCotisation(): Promise<void> {
  const cotisations = await mockMemberRepository.listerCotisations({ annee: 2026 });
  verifier(
    'cotisation 2026 : 1 ligne NON_PAYEE avec montant',
    cotisations.ok &&
      cotisations.valeur.length === 1 &&
      cotisations.valeur[0].statut === 'NON_PAYEE' &&
      cotisations.valeur[0].montant > 0,
  );
  const montantCotisation = cotisations.ok ? cotisations.valeur[0].montant : -1;
  const cotisationId = cotisations.ok ? cotisations.valeur[0].id : '';

  const initie = await mockMemberRepository.initierPaiement({
    type: 'COTISATION',
    cotisation_id: cotisationId,
    mode: 'MOBILE_MONEY',
    operateur: 'MVOLA',
    numero_telephone: '+261340000001',
  });
  verifier(
    'initiation cotisation = INITIE (jamais REUSSI immédiat)',
    initie.ok &&
      initie.valeur.statut === 'INITIE' &&
      initie.valeur.montant === montantCotisation &&
      initie.valeur.date_confirmation === null,
  );
  const paiementId = initie.ok ? initie.valeur.id : '';

  const polling1 = await mockMemberRepository.obtenirPaiement(paiementId);
  verifier(
    'polling 1 -> EN_ATTENTE_CONFIRMATION',
    polling1.ok && polling1.valeur.statut === 'EN_ATTENTE_CONFIRMATION',
  );
  const polling2 = await mockMemberRepository.obtenirPaiement(paiementId);
  verifier('polling 2 -> REUSSI confirmé par le serveur', polling2.ok && polling2.valeur.statut === 'REUSSI');

  const cotisationsApres = await mockMemberRepository.listerCotisations({ annee: 2026 });
  verifier(
    'effet serveur : cotisation PAYEE avec date de paiement',
    cotisationsApres.ok &&
      cotisationsApres.valeur[0].statut === 'PAYEE' &&
      cotisationsApres.valeur[0].date_paiement !== null,
  );

  const relance = await mockMemberRepository.initierPaiement({
    type: 'COTISATION',
    cotisation_id: cotisationId,
    mode: 'MOBILE_MONEY',
    operateur: 'MVOLA',
    numero_telephone: '+261340000001',
  });
  verifier(
    'seconde cotisation -> COTISATION_DEJA_PAYEE',
    !relance.ok &&
      relance.erreur.type === 'metier' &&
      relance.erreur.code === 'COTISATION_DEJA_PAYEE',
  );

  const notifications = await mockMemberRepository.listerNotifications({ non_lues_uniquement: true });
  verifier(
    '4 non lues (2 initiales + 2 paiements confirmés), toutes de type PAIEMENT_REUSSI pour les 2 dernières',
    notifications.ok &&
      notifications.valeur.length === 4 &&
      notifications.valeur.filter((element) => element.type === 'PAIEMENT_REUSSI').length === 2,
  );

  const marquage = await mockMemberRepository.marquerToutesNotificationsLues();
  verifier('marquage global : 4 notifications passées à lues', marquage.ok && marquage.valeur === 4);

  const restantes = await mockMemberRepository.listerNotifications({ non_lues_uniquement: true });
  verifier('plus aucune notification non lue', restantes.ok && restantes.valeur.length === 0);

  const reinitConnue = await mockAuthService.demanderReinitialisationMotDePasse({
    email: 'membre@omda.mg',
  });
  const reinitInconnue = await mockAuthService.demanderReinitialisationMotDePasse({
    email: 'inconnu@exemple.mg',
  });
  verifier(
    '« mot de passe oublié » : réponse identique (compte connu ou non)',
    reinitConnue.ok && reinitInconnue.ok,
  );
}

async function scenarioMembreComptes(): Promise<void> {
  const deconnexion = await mockAuthService.deconnecter();
  verifier('déconnexion du membre', deconnexion.ok);
  const sessionApres = await mockAuthService.obtenirSession();
  verifier('session nulle après déconnexion', sessionApres.ok && sessionApres.valeur === null);
  const sansSession = await mockMemberRepository.listerOeuvres();
  verifier(
    'appels membre sans session -> NON_AUTHENTIFIE',
    !sansSession.ok &&
      sansSession.erreur.type === 'metier' &&
      sansSession.erreur.code === 'NON_AUTHENTIFIE',
  );

  const premiere = await mockAuthService.connecter({
    email: 'premiere.connexion@omda.mg',
    mot_de_passe: 'Omda2026!',
  });
  verifier(
    'première connexion : doit_changer_mot_de_passe = true',
    premiere.ok && premiere.valeur.doit_changer_mot_de_passe === true,
  );
  const motDePasseFaible = await mockAuthService.changerMotDePasse({
    mot_de_passe_actuel: 'Omda2026!',
    nouveau_mot_de_passe: 'facile',
    confirmation_mot_de_passe: 'facile',
  });
  verifier(
    'nouveau mot de passe faible -> MOT_DE_PASSE_FAIBLE',
    !motDePasseFaible.ok &&
      motDePasseFaible.erreur.type === 'metier' &&
      motDePasseFaible.erreur.code === 'MOT_DE_PASSE_FAIBLE',
  );
  const confirmationDifferent = await mockAuthService.changerMotDePasse({
    mot_de_passe_actuel: 'Omda2026!',
    nouveau_mot_de_passe: 'Nouveau2026!',
    confirmation_mot_de_passe: 'Different2026!',
  });
  verifier(
    'confirmation différente -> CONFIRMATION_DIFFERENTE',
    !confirmationDifferent.ok &&
      confirmationDifferent.erreur.type === 'metier' &&
      confirmationDifferent.erreur.code === 'CONFIRMATION_DIFFERENTE',
  );
  await mockAuthService.deconnecter();

  const vide = await mockAuthService.connecter({ email: 'vide@omda.mg', mot_de_passe: 'Omda2026!' });
  verifier('connexion du compte vide', vide.ok);
  const oeuvresVides = await mockMemberRepository.listerOeuvres();
  const cotisationsVides = await mockMemberRepository.listerCotisations();
  const notificationsVides = await mockMemberRepository.listerNotifications({
    non_lues_uniquement: true,
  });
  const tableauVide = await mockMemberRepository.obtenirTableauDeBord();
  verifier(
    'états vides : 0 œuvre, 0 cotisation, 0 notification non lue, cotisation_annee null',
    oeuvresVides.ok &&
      oeuvresVides.valeur.length === 0 &&
      cotisationsVides.ok &&
      cotisationsVides.valeur.length === 0 &&
      notificationsVides.ok &&
      notificationsVides.valeur.length === 0 &&
      tableauVide.ok &&
      tableauVide.valeur.nombre_oeuvres === 0 &&
      tableauVide.valeur.notifications_non_lues === 0 &&
      tableauVide.valeur.cotisation_annee === null,
  );
  await mockAuthService.deconnecter();

  const desactive = await mockAuthService.connecter({
    email: 'desactive@omda.mg',
    mot_de_passe: 'Omda2026!',
  });
  verifier(
    'compte désactivé -> COMPTE_DESACTIVE (rappel)',
    !desactive.ok &&
      desactive.erreur.type === 'metier' &&
      desactive.erreur.code === 'COMPTE_DESACTIVE',
  );

  for (let tentative = 1; tentative <= 3; tentative += 1) {
    const echec = await mockAuthService.connecter({
      email: 'bloque@omda.mg',
      mot_de_passe: `faux-${tentative}`,
    });
    verifier(
      `échec de connexion ${tentative}/3 -> IDENTIFIANTS_INVALIDES`,
      !echec.ok &&
        echec.erreur.type === 'metier' &&
        echec.erreur.code === 'IDENTIFIANTS_INVALIDES',
    );
  }
  const bloque = await mockAuthService.connecter({
    email: 'bloque@omda.mg',
    mot_de_passe: 'Omda2026!',
  });
  verifier(
    '4e tentative (mot de passe correct) -> TROP_DE_TENTATIVES',
    !bloque.ok && bloque.erreur.type === 'metier' && bloque.erreur.code === 'TROP_DE_TENTATIVES',
  );
  reinitialiserEchecsConnexion('bloque@omda.mg');
  const reouverture = await mockAuthService.connecter({
    email: 'bloque@omda.mg',
    mot_de_passe: 'Omda2026!',
  });
  verifier('compteur réinitialisé : connexion à nouveau possible', reouverture.ok);
  await mockAuthService.deconnecter();
}

/** Espace membre : connexion + données, cotisation + notifications, comptes de test. */
async function scenarioMembre(): Promise<void> {
  await scenarioMembreConnexion();
  await scenarioMembreOeuvres();
  await scenarioMembreCategories();
  await scenarioDemandeCategorieOeuvres();
  await scenarioMembreCotisation();
  await scenarioMembreComptes();
}

principal().catch((erreur) => {
  console.error('ECHEC GLOBAL', erreur);
  throw erreur;
});
