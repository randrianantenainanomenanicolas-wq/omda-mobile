import {
  definirDelaisMock,
  definirOperateurActif,
  forcerErreurReseau,
  forcerErreurServeur,
  mockAuthService,
  mockCandidateApi,
  mockMemberRepository,
  mockPublicContentService,
  reinitialiserEchecsConnexion,
  reinitialiserOptionsMock,
  simulerVirementValideParAgent,
} from '../src/services/mocks';

/**
 * Vérification d'exécution des mocks (smoke test) : 77 contrôles sur les 4 mocks
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
    'opérateur désactivé absent (AIRTEL_MONEY)',
    operateurs.ok && !operateurs.valeur.some((element) => element.code === 'AIRTEL_MONEY'),
  );
  verifier(
    'opérateurs actifs triés (MVOLA puis ORANGE_MONEY)',
    operateurs.ok &&
      operateurs.valeur.map((element) => element.code).join(',') === 'MVOLA,ORANGE_MONEY',
  );

  const categories = await mockPublicContentService.listerCategories();
  verifier(
    'catégorie désactivée absente (3 catégories actives)',
    categories.ok && categories.valeur.length === 3,
  );

  const coordonnees = await mockPublicContentService.obtenirCoordonneesBancaires();
  verifier(
    'coordonnées bancaires actives uniquement (1 sur 2)',
    coordonnees.ok && coordonnees.valeur.length === 1 && coordonnees.valeur[0].banque === 'BNI Madagascar',
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
  await scenarioVirement();
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
    'options : montant serveur + 2 modes + 2 opérateurs actifs + 1 compte actif',
    options.ok &&
      options.valeur.paiement_du.montant === 150000 &&
      options.valeur.modes.length === 2 &&
      options.valeur.modes[0].operateurs.length === 2 &&
      options.valeur.modes[1].coordonnees_bancaires.length === 1,
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
  const operateurInactif = await mockCandidateApi.initierPaiement({
    numero_dossier: 'OMDA-2026-000001',
    code_suivi: 'K7X4-9B2Q',
    mode: 'MOBILE_MONEY',
    operateur: 'AIRTEL_MONEY',
    numero_telephone: '+261340000001',
  });
  verifier(
    'opérateur désactivé -> OPERATEUR_INDISPONIBLE',
    !operateurInactif.ok &&
      operateurInactif.erreur.type === 'metier' &&
      operateurInactif.erreur.code === 'OPERATEUR_INDISPONIBLE',
  );

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

  const preuveSurPaiementInconnu = await mockCandidateApi.declarerPreuveVirement({
    paiement_id: 'paiement-inexistant',
    chemin_stockage: 'preuves/inconnu.pdf',
    mime_type: 'application/pdf',
    taille_octets: 1200,
  });
  verifier(
    'preuve sur un paiement inexistant -> PAIEMENT_INTROUVABLE',
    !preuveSurPaiementInconnu.ok &&
      preuveSurPaiementInconnu.erreur.type === 'metier' &&
      preuveSurPaiementInconnu.erreur.code === 'PAIEMENT_INTROUVABLE',
  );
}

async function scenarioVirement(): Promise<void> {
  const initie = await mockCandidateApi.initierPaiement({
    numero_dossier: 'OMDA-2026-000008',
    code_suivi: 'V4J9-6W3N',
    mode: 'VIREMENT_BANCAIRE',
  });
  verifier(
    'virement initié -> EN_ATTENTE_PREUVE + tarif de la catégorie (120 000 Ar)',
    initie.ok &&
      initie.valeur.statut === 'EN_ATTENTE_PREUVE' &&
      initie.valeur.montant === 120000 &&
      initie.valeur.operateur === null,
  );
  const paiementId = initie.ok ? initie.valeur.paiement_id : '';
  const reference = initie.ok ? initie.valeur.reference_interne : '';

  const url = await mockCandidateApi.obtenirUrlTeleversementPreuve({
    paiement_id: paiementId,
    nom_fichier: 'recu-virement.pdf',
    mime_type: 'application/pdf',
    taille_octets: 183022,
  });
  verifier(
    'URL signée de preuve (bucket preuves)',
    url.ok && url.valeur.chemin_stockage.startsWith('preuves/') && url.valeur.expire_at.length > 0,
  );
  const chemin = url.ok ? url.valeur.chemin_stockage : '';

  const urlTropVolumineuse = await mockCandidateApi.obtenirUrlTeleversementPreuve({
    paiement_id: paiementId,
    nom_fichier: 'enorme.pdf',
    mime_type: 'application/pdf',
    taille_octets: 22000000,
  });
  verifier(
    'preuve de plus de 20 Mo -> FICHIER_TROP_VOLUMINEUX',
    !urlTropVolumineuse.ok &&
      urlTropVolumineuse.erreur.type === 'metier' &&
      urlTropVolumineuse.erreur.code === 'FICHIER_TROP_VOLUMINEUX',
  );

  const urlMimeRefuse = await mockCandidateApi.obtenirUrlTeleversementPreuve({
    paiement_id: paiementId,
    nom_fichier: 'son.mp3',
    mime_type: 'audio/mpeg',
    taille_octets: 120000,
  });
  verifier(
    'format non autorisé pour `preuves` -> TYPE_FICHIER_NON_AUTORISE',
    !urlMimeRefuse.ok &&
      urlMimeRefuse.erreur.type === 'metier' &&
      urlMimeRefuse.erreur.code === 'TYPE_FICHIER_NON_AUTORISE',
  );

  const declaree = await mockCandidateApi.declarerPreuveVirement({
    paiement_id: paiementId,
    chemin_stockage: chemin,
    mime_type: 'application/pdf',
    taille_octets: 183022,
    reference_fournie: 'VIR-2026-8891',
  });
  verifier(
    'preuve déposée -> EN_ATTENTE_VERIFICATION_AGENT (jamais REUSSI)',
    declaree.ok &&
      declaree.valeur.statut === 'EN_ATTENTE_VERIFICATION_AGENT' &&
      declaree.valeur.date_confirmation === null,
  );

  const pollingVirement = await mockCandidateApi.obtenirEtatPaiement(reference);
  verifier(
    'polling virement : reste en attente d’un agent (aucun succès automatique)',
    pollingVirement.ok && pollingVirement.valeur.statut === 'EN_ATTENTE_VERIFICATION_AGENT',
  );

  simulerVirementValideParAgent(true);
  const apresAgent = await mockCandidateApi.obtenirEtatPaiement(reference);
  verifier(
    'validation simulée par un agent -> REUSSI (+ date_confirmation)',
    apresAgent.ok &&
      apresAgent.valeur.statut === 'REUSSI' &&
      apresAgent.valeur.date_confirmation !== null,
  );
  simulerVirementValideParAgent(false);
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

  definirOperateurActif('AIRTEL_MONEY', true);
  const avecAirtel = await mockPublicContentService.listerOperateursMobileMoney();
  verifier(
    'opérateur réactivé côté « serveur » : il réapparaît',
    avecAirtel.ok && avecAirtel.valeur.some((element) => element.code === 'AIRTEL_MONEY'),
  );
  definirOperateurActif('AIRTEL_MONEY', false);
  const sansAirtel = await mockPublicContentService.listerOperateursMobileMoney();
  verifier(
    'opérateur désactivé : il disparaît de nouveau (liste dynamique)',
    sansAirtel.ok && !sansAirtel.valeur.some((element) => element.code === 'AIRTEL_MONEY'),
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
  await scenarioMembreCotisation();
  await scenarioMembreComptes();
}

principal().catch((erreur) => {
  console.error('ECHEC GLOBAL', erreur);
  throw erreur;
});
