# OMDA — DB_SUPABASE (PostgreSQL / Supabase)
Version : 1.0

Ce document contient :
1) Le script SQL complet fourni (schéma + storage + RLS + trigger Supabase Auth)
2) Un ADDENDUM recommandé pour gérer l’activation/désactivation des opérateurs Mobile Money (MVola / Orange Money / Airtel Money)

---

## 1) Script SQL — Schéma + Storage + RLS + Auth trigger (COMPLET)

```sql
-- ============================================================
-- OMDA — schéma PostgreSQL
-- ============================================================

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ------------------------------------------------------------
-- Types énumérés
-- ------------------------------------------------------------

CREATE TYPE role_utilisateur AS ENUM (
  'MEMBRE',
  'AGENT',
  'ADMINISTRATEUR'
);

CREATE TYPE statut_utilisateur AS ENUM (
  'ACTIF',
  'DESACTIVE',
  'EN_ATTENTE_CHANGEMENT_MDP'
);

CREATE TYPE statut_demande AS ENUM (
  'BROUILLON',
  'ENVOYEE',
  'EN_COURS_DE_VERIFICATION',
  'VALIDEE',
  'REJETEE',
  'ADHESION_TERMINEE'
);

CREATE TYPE type_piece AS ENUM (
  'PHOTO',
  'CIN',
  'ACTE_NAISSANCE',
  'CERTIFICAT_RESIDENCE',
  'AUTORISATION_PARENTALE',
  'AUTRE'
);

CREATE TYPE statut_oeuvre AS ENUM (
  'BROUILLON',
  'ENVOYEE',
  'EN_COURS_DE_VALIDATION',
  'VALIDEE',
  'REJETEE',
  'DEPOT_FINALISE'
);

CREATE TYPE type_paiement AS ENUM (
  'ADHESION',
  'DEPOT_OEUVRE',
  'COTISATION'
);

CREATE TYPE mode_paiement AS ENUM (
  'MOBILE_MONEY',
  'VIREMENT_BANCAIRE'
);

CREATE TYPE operateur_paiement AS ENUM (
  'MVOLA',
  'ORANGE_MONEY',
  'AIRTEL_MONEY'
);

CREATE TYPE statut_paiement AS ENUM (
  'INITIE',
  'EN_ATTENTE_CONFIRMATION',
  'EN_ATTENTE_PREUVE',
  'EN_ATTENTE_VERIFICATION_AGENT',
  'REUSSI',
  'ECHEC_SOLDE_INSUFFISANT',
  'ECHEC_AUTRE',
  'REJETE'
);

CREATE TYPE type_operation_tarif AS ENUM (
  'ADHESION',
  'DEPOT_OEUVRE',
  'COTISATION'
);

CREATE TYPE statut_cotisation AS ENUM (
  'NON_PAYEE',
  'PAYEE'
);

CREATE TYPE statut_adhesion_categorie AS ENUM (
  'ACTIVE',
  'INACTIVE'
);

CREATE TYPE type_notification AS ENUM (
  'DEMANDE_ENVOYEE',
  'DEMANDE_VALIDEE',
  'DEMANDE_REJETEE',
  'PAIEMENT_DISPONIBLE',
  'PAIEMENT_REUSSI',
  'PAIEMENT_ECHEC',
  'OEUVRE_VALIDEE',
  'OEUVRE_REJETEE',
  'VIREMENT_VALIDE',
  'VIREMENT_REJETE',
  'IDENTIFIANTS_ENVOYES',
  'GLOBALE'
);

-- ------------------------------------------------------------
-- Référentiels
-- ------------------------------------------------------------

CREATE TABLE categorie (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  code          TEXT NOT NULL UNIQUE,
  libelle       TEXT NOT NULL,
  description   TEXT,
  actif         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE tarif (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type_operation  type_operation_tarif NOT NULL,
  categorie_id    UUID REFERENCES categorie(id),
  montant         INTEGER NOT NULL CHECK (montant >= 0),
  devise          CHAR(3) NOT NULL DEFAULT 'MGA',
  actif           BOOLEAN NOT NULL DEFAULT TRUE,
  date_debut      DATE,
  date_fin        DATE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT tarif_dates_chk CHECK (date_fin IS NULL OR date_debut IS NULL OR date_fin >= date_debut)
);

CREATE UNIQUE INDEX tarif_actif_unique
  ON tarif (type_operation, COALESCE(categorie_id, '00000000-0000-0000-0000-000000000000'))
  WHERE actif = TRUE;

CREATE TABLE coordonnees_bancaires (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  titulaire       TEXT NOT NULL,
  banque          TEXT NOT NULL,
  numero_compte   TEXT NOT NULL,
  iban            TEXT,
  swift           TEXT,
  instructions    TEXT,
  actif           BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE documentation (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT NOT NULL UNIQUE,
  titre       TEXT NOT NULL,
  contenu     TEXT NOT NULL,
  ordre       INTEGER NOT NULL DEFAULT 0,
  publie      BOOLEAN NOT NULL DEFAULT TRUE,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Identités et comptes
-- ------------------------------------------------------------

CREATE TABLE utilisateur (
  id                         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email                      TEXT NOT NULL UNIQUE,
  telephone                  TEXT,
  mot_de_passe_hash          TEXT,
  role                       role_utilisateur NOT NULL,
  statut                     statut_utilisateur NOT NULL DEFAULT 'ACTIF',
  doit_changer_mot_de_passe  BOOLEAN NOT NULL DEFAULT FALSE,
  derniere_connexion_at      TIMESTAMPTZ,
  created_at                 TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at                 TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX utilisateur_role_idx ON utilisateur (role);

CREATE TABLE candidat (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  nom              TEXT NOT NULL,
  prenom           TEXT NOT NULL,
  cin              TEXT NOT NULL UNIQUE,
  date_naissance   DATE NOT NULL,
  telephone        TEXT NOT NULL,
  email            TEXT NOT NULL,
  adresse          TEXT NOT NULL,
  utilisateur_id   UUID UNIQUE REFERENCES utilisateur(id),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT candidat_age_min_chk CHECK (date_naissance <= (CURRENT_DATE - INTERVAL '15 years'))
);

CREATE TABLE membre (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id     UUID NOT NULL UNIQUE REFERENCES utilisateur(id),
  candidat_id        UUID NOT NULL UNIQUE REFERENCES candidat(id),
  numero_adherent    TEXT NOT NULL UNIQUE,
  statut             statut_utilisateur NOT NULL DEFAULT 'ACTIF',
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE membre_categorie (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id            UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  categorie_id         UUID NOT NULL REFERENCES categorie(id),
  demande_adhesion_id  UUID,
  statut               statut_adhesion_categorie NOT NULL DEFAULT 'ACTIVE',
  date_activation      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (membre_id, categorie_id)
);

-- ------------------------------------------------------------
-- Demandes d'adhésion et pièces
-- ------------------------------------------------------------

CREATE TABLE demande_adhesion (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_dossier         TEXT NOT NULL UNIQUE,
  jeton_suivi_hash       TEXT NOT NULL,
  candidat_id            UUID NOT NULL REFERENCES candidat(id),
  membre_id              UUID REFERENCES membre(id),
  categorie_id           UUID NOT NULL REFERENCES categorie(id),
  statut                 statut_demande NOT NULL DEFAULT 'BROUILLON',
  motif_rejet            TEXT,
  date_soumission        TIMESTAMPTZ,
  date_decision          TIMESTAMPTZ,
  agent_id               UUID REFERENCES utilisateur(id),
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT demande_rejet_motif_chk CHECK (
    statut <> 'REJETEE' OR motif_rejet IS NOT NULL
  )
);

CREATE INDEX demande_statut_idx ON demande_adhesion (statut);
CREATE INDEX demande_candidat_idx ON demande_adhesion (candidat_id);
CREATE INDEX demande_membre_idx ON demande_adhesion (membre_id);

ALTER TABLE membre_categorie
  ADD CONSTRAINT membre_categorie_demande_fk
  FOREIGN KEY (demande_adhesion_id) REFERENCES demande_adhesion(id);

CREATE TABLE piece (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  demande_adhesion_id   UUID NOT NULL REFERENCES demande_adhesion(id) ON DELETE CASCADE,
  type                  type_piece NOT NULL,
  chemin_stockage       TEXT NOT NULL,
  mime_type             TEXT NOT NULL,
  taille_octets         INTEGER NOT NULL CHECK (taille_octets > 0 AND taille_octets <= 20971520),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX piece_demande_idx ON piece (demande_adhesion_id);

-- ------------------------------------------------------------
-- Œuvres et attestations
-- ------------------------------------------------------------

CREATE TABLE oeuvre (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id             UUID REFERENCES membre(id),
  demande_adhesion_id   UUID REFERENCES demande_adhesion(id),
  categorie_id          UUID NOT NULL REFERENCES categorie(id),
  titre                 TEXT NOT NULL,
  description           TEXT,
  annee                 INTEGER,
  statut                statut_oeuvre NOT NULL DEFAULT 'BROUILLON',
  motif_rejet           TEXT,
  chemin_fichier        TEXT,
  mime_type             TEXT,
  taille_octets         INTEGER CHECK (taille_octets IS NULL OR (taille_octets > 0 AND taille_octets <= 20971520)),
  date_soumission       TIMESTAMPTZ,
  date_decision         TIMESTAMPTZ,
  agent_id              UUID REFERENCES utilisateur(id),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT oeuvre_contexte_chk CHECK (
    membre_id IS NOT NULL OR demande_adhesion_id IS NOT NULL
  ),
  CONSTRAINT oeuvre_rejet_motif_chk CHECK (
    statut <> 'REJETEE' OR motif_rejet IS NOT NULL
  )
);

CREATE INDEX oeuvre_membre_idx ON oeuvre (membre_id);
CREATE INDEX oeuvre_demande_idx ON oeuvre (demande_adhesion_id);
CREATE INDEX oeuvre_statut_idx ON oeuvre (statut);

CREATE TABLE attestation_diffusion (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  oeuvre_id       UUID NOT NULL REFERENCES oeuvre(id) ON DELETE CASCADE,
  chemin_stockage TEXT NOT NULL,
  mime_type       TEXT NOT NULL,
  taille_octets   INTEGER NOT NULL CHECK (taille_octets > 0 AND taille_octets <= 20971520),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ------------------------------------------------------------
-- Cotisations
-- ------------------------------------------------------------

CREATE TABLE cotisation (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  membre_id        UUID NOT NULL REFERENCES membre(id) ON DELETE CASCADE,
  annee            INTEGER NOT NULL,
  montant          INTEGER NOT NULL CHECK (montant >= 0),
  statut           statut_cotisation NOT NULL DEFAULT 'NON_PAYEE',
  date_paiement    TIMESTAMPTZ,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (membre_id, annee)
);

-- ------------------------------------------------------------
-- Paiements
-- ------------------------------------------------------------

CREATE TABLE paiement (
  id                     UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type                   type_paiement NOT NULL,
  montant                INTEGER NOT NULL CHECK (montant >= 0),
  devise                 CHAR(3) NOT NULL DEFAULT 'MGA',
  mode                   mode_paiement NOT NULL,
  operateur              operateur_paiement,
  numero_telephone       TEXT,
  reference_interne      TEXT NOT NULL UNIQUE,
  reference_externe      TEXT UNIQUE,
  statut                 statut_paiement NOT NULL DEFAULT 'INITIE',
  motif_echec            TEXT,
  demande_adhesion_id    UUID REFERENCES demande_adhesion(id),
  oeuvre_id              UUID REFERENCES oeuvre(id),
  cotisation_id          UUID REFERENCES cotisation(id),
  candidat_id            UUID REFERENCES candidat(id),
  membre_id              UUID REFERENCES membre(id),
  date_initiation        TIMESTAMPTZ NOT NULL DEFAULT now(),
  date_confirmation      TIMESTAMPTZ,
  created_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at             TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT paiement_contexte_chk CHECK (
    (type = 'ADHESION'     AND demande_adhesion_id IS NOT NULL) OR
    (type = 'DEPOT_OEUVRE' AND oeuvre_id IS NOT NULL) OR
    (type = 'COTISATION'   AND cotisation_id IS NOT NULL)
  ),
  CONSTRAINT paiement_mm_operateur_chk CHECK (
    mode <> 'MOBILE_MONEY' OR operateur IS NOT NULL
  )
);

CREATE INDEX paiement_statut_idx ON paiement (statut);
CREATE INDEX paiement_demande_idx ON paiement (demande_adhesion_id);
CREATE INDEX paiement_oeuvre_idx ON paiement (oeuvre_id);

CREATE UNIQUE INDEX paiement_adhesion_reussi_unique
  ON paiement (demande_adhesion_id)
  WHERE type = 'ADHESION' AND statut = 'REUSSI';

CREATE UNIQUE INDEX paiement_depot_reussi_unique
  ON paiement (oeuvre_id)
  WHERE type = 'DEPOT_OEUVRE' AND statut = 'REUSSI';

CREATE UNIQUE INDEX paiement_cotisation_reussi_unique
  ON paiement (cotisation_id)
  WHERE type = 'COTISATION' AND statut = 'REUSSI';

CREATE TABLE preuve_virement (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paiement_id          UUID NOT NULL REFERENCES paiement(id) ON DELETE CASCADE,
  chemin_stockage      TEXT NOT NULL,
  mime_type            TEXT NOT NULL,
  taille_octets        INTEGER NOT NULL CHECK (taille_octets > 0 AND taille_octets <= 20971520),
  reference_fournie    TEXT,
  date_upload          TIMESTAMPTZ NOT NULL DEFAULT now(),
  agent_id             UUID REFERENCES utilisateur(id),
  date_verification    TIMESTAMPTZ,
  motif_rejet          TEXT
);

CREATE TABLE journal_paiement (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  paiement_id   UUID NOT NULL REFERENCES paiement(id) ON DELETE CASCADE,
  evenement     TEXT NOT NULL,
  payload       JSONB,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX journal_paiement_idx ON journal_paiement (paiement_id, created_at);

-- ------------------------------------------------------------
-- Notifications et sécurité
-- ------------------------------------------------------------

CREATE TABLE notification (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id UUID REFERENCES utilisateur(id) ON DELETE CASCADE,
  candidat_id   UUID REFERENCES candidat(id) ON DELETE CASCADE,
  type          type_notification NOT NULL,
  titre         TEXT NOT NULL,
  message       TEXT NOT NULL,
  lue           BOOLEAN NOT NULL DEFAULT FALSE,
  globale       BOOLEAN NOT NULL DEFAULT FALSE,
  metadata      JSONB,
  date_envoi    TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT notification_destinataire_chk CHECK (
    globale = TRUE OR utilisateur_id IS NOT NULL OR candidat_id IS NOT NULL
  )
);

CREATE INDEX notification_user_idx ON notification (utilisateur_id, lue, date_envoi DESC);

CREATE TABLE jeton_reinitialisation (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  utilisateur_id  UUID NOT NULL REFERENCES utilisateur(id) ON DELETE CASCADE,
  jeton_hash      TEXT NOT NULL UNIQUE,
  expire_at       TIMESTAMPTZ NOT NULL,
  utilise_at      TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Création des buckets de stockage privés
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES 
  ('pieces', 'pieces', FALSE, 20971520, ARRAY['image/jpeg', 'image/png', 'application/pdf']),
  ('oeuvres', 'oeuvres', FALSE, 20971520, ARRAY['audio/mpeg', 'audio/wav', 'application/pdf', 'image/jpeg', 'image/png']),
  ('preuves', 'preuves', FALSE, 20971520, ARRAY['image/jpeg', 'image/png', 'application/pdf'])
ON CONFLICT (id) DO NOTHING;

-- Politiques pour le bucket 'pieces'
CREATE POLICY "Autoriser upload pieces"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'pieces');

CREATE POLICY "Autoriser lecture pieces"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'pieces');

-- Politiques pour le bucket 'oeuvres'
CREATE POLICY "Autoriser upload oeuvres"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'oeuvres');

CREATE POLICY "Autoriser lecture oeuvres"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'oeuvres');

-- Politiques pour le bucket 'preuves'
CREATE POLICY "Autoriser upload preuves"
ON storage.objects FOR INSERT
TO public
WITH CHECK (bucket_id = 'preuves');

CREATE POLICY "Autoriser lecture preuves"
ON storage.objects FOR SELECT
TO public
USING (bucket_id = 'preuves');




-- ============================================================
-- OMDA — SCRIPT COMPLET DE SÉCURITÉ ET POLITIQUES RLS
-- ============================================================

-- ------------------------------------------------------------
-- 0. Fonctions utilitaires de vérification des rôles
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.get_user_role()
RETURNS role_utilisateur AS $$
  SELECT role FROM public.utilisateur WHERE id = auth.uid();
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((public.get_user_role() = 'ADMINISTRATEUR'), FALSE);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

CREATE OR REPLACE FUNCTION public.is_agent_or_admin()
RETURNS BOOLEAN AS $$
  SELECT COALESCE((public.get_user_role() IN ('AGENT', 'ADMINISTRATEUR')), FALSE);
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- ------------------------------------------------------------
-- 1. Activation du RLS sur l'ensemble des tables
-- ------------------------------------------------------------
ALTER TABLE public.categorie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tarif ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.coordonnees_bancaires ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.documentation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.utilisateur ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.candidat ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membre ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.membre_categorie ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.demande_adhesion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.piece ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oeuvre ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.attestation_diffusion ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.cotisation ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.paiement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.preuve_virement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_paiement ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notification ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.jeton_reinitialisation ENABLE ROW LEVEL SECURITY;

-- ------------------------------------------------------------
-- 2. Tables Référentiels (Lecture publique / Modification Admin)
-- ------------------------------------------------------------

-- CATEGORIE
DROP POLICY IF EXISTS "categorie_select_all" ON public.categorie;
CREATE POLICY "categorie_select_all" ON public.categorie
  FOR SELECT TO public USING (TRUE);

DROP POLICY IF EXISTS "categorie_admin_all" ON public.categorie;
CREATE POLICY "categorie_admin_all" ON public.categorie
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- TARIF
DROP POLICY IF EXISTS "tarif_select_all" ON public.tarif;
CREATE POLICY "tarif_select_all" ON public.tarif
  FOR SELECT TO public USING (TRUE);

DROP POLICY IF EXISTS "tarif_admin_all" ON public.tarif;
CREATE POLICY "tarif_admin_all" ON public.tarif
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- COORDONNEES BANCAIRES
DROP POLICY IF EXISTS "coordonnees_select_all" ON public.coordonnees_bancaires;
CREATE POLICY "coordonnees_select_all" ON public.coordonnees_bancaires
  FOR SELECT TO public USING (TRUE);

DROP POLICY IF EXISTS "coordonnees_admin_all" ON public.coordonnees_bancaires;
CREATE POLICY "coordonnees_admin_all" ON public.coordonnees_bancaires
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- DOCUMENTATION
DROP POLICY IF EXISTS "documentation_select_public" ON public.documentation;
CREATE POLICY "documentation_select_public" ON public.documentation
  FOR SELECT TO public USING (publie = TRUE OR public.is_agent_or_admin());

DROP POLICY IF EXISTS "documentation_admin_all" ON public.documentation;
CREATE POLICY "documentation_admin_all" ON public.documentation
  FOR ALL TO authenticated USING (public.is_admin()) WITH CHECK (public.is_admin());

-- ------------------------------------------------------------
-- 3. Identités et comptes
-- ------------------------------------------------------------

-- UTILISATEUR
DROP POLICY IF EXISTS "utilisateur_select_self_or_staff" ON public.utilisateur;
CREATE POLICY "utilisateur_select_self_or_staff" ON public.utilisateur
  FOR SELECT TO authenticated USING (id = auth.uid() OR public.is_agent_or_admin());

DROP POLICY IF EXISTS "utilisateur_update_self_or_admin" ON public.utilisateur;
CREATE POLICY "utilisateur_update_self_or_admin" ON public.utilisateur
  FOR UPDATE TO authenticated USING (id = auth.uid() OR public.is_admin()) WITH CHECK (id = auth.uid() OR public.is_admin());

-- CANDIDAT
DROP POLICY IF EXISTS "candidat_select_self_or_staff" ON public.candidat;
CREATE POLICY "candidat_select_self_or_staff" ON public.candidat
  FOR SELECT TO authenticated USING (utilisateur_id = auth.uid() OR public.is_agent_or_admin());

DROP POLICY IF EXISTS "candidat_insert_self_or_staff" ON public.candidat;
CREATE POLICY "candidat_insert_self_or_staff" ON public.candidat
  FOR INSERT TO authenticated WITH CHECK (utilisateur_id = auth.uid() OR public.is_agent_or_admin());

DROP POLICY IF EXISTS "candidat_update_self_or_staff" ON public.candidat;
CREATE POLICY "candidat_update_self_or_staff" ON public.candidat
  FOR UPDATE TO authenticated USING (utilisateur_id = auth.uid() OR public.is_agent_or_admin());

-- MEMBRE
DROP POLICY IF EXISTS "membre_select_self_or_staff" ON public.membre;
CREATE POLICY "membre_select_self_or_staff" ON public.membre
  FOR SELECT TO authenticated USING (utilisateur_id = auth.uid() OR public.is_agent_or_admin());

DROP POLICY IF EXISTS "membre_staff_manage" ON public.membre;
CREATE POLICY "membre_staff_manage" ON public.membre
  FOR ALL TO authenticated USING (public.is_agent_or_admin()) WITH CHECK (public.is_agent_or_admin());

-- MEMBRE_CATEGORIE
DROP POLICY IF EXISTS "membre_categorie_select" ON public.membre_categorie;
CREATE POLICY "membre_categorie_select" ON public.membre_categorie
  FOR SELECT TO authenticated USING (
    membre_id IN (SELECT id FROM public.membre WHERE utilisateur_id = auth.uid()) 
    OR public.is_agent_or_admin()
  );

DROP POLICY IF EXISTS "membre_categorie_staff_all" ON public.membre_categorie;
CREATE POLICY "membre_categorie_staff_all" ON public.membre_categorie
  FOR ALL TO authenticated USING (public.is_agent_or_admin()) WITH CHECK (public.is_agent_or_admin());

-- ------------------------------------------------------------
-- 4. Demandes d'adhésion et pièces
-- ------------------------------------------------------------

-- DEMANDE_ADHESION
DROP POLICY IF EXISTS "demande_select_owner_or_staff" ON public.demande_adhesion;
CREATE POLICY "demande_select_owner_or_staff" ON public.demande_adhesion
  FOR SELECT TO authenticated USING (
    candidat_id IN (SELECT id FROM public.candidat WHERE utilisateur_id = auth.uid())
    OR membre_id IN (SELECT id FROM public.membre WHERE utilisateur_id = auth.uid())
    OR public.is_agent_or_admin()
  );

DROP POLICY IF EXISTS "demande_insert_owner_or_staff" ON public.demande_adhesion;
CREATE POLICY "demande_insert_owner_or_staff" ON public.demande_adhesion
  FOR INSERT TO authenticated WITH CHECK (
    candidat_id IN (SELECT id FROM public.candidat WHERE utilisateur_id = auth.uid())
    OR public.is_agent_or_admin()
  );

DROP POLICY IF EXISTS "demande_update_owner_or_staff" ON public.demande_adhesion;
CREATE POLICY "demande_update_owner_or_staff" ON public.demande_adhesion
  FOR UPDATE TO authenticated USING (
    (candidat_id IN (SELECT id FROM public.candidat WHERE utilisateur_id = auth.uid()) AND statut = 'BROUILLON')
    OR public.is_agent_or_admin()
  );

-- PIECE
DROP POLICY IF EXISTS "piece_select_owner_or_staff" ON public.piece;
CREATE POLICY "piece_select_owner_or_staff" ON public.piece
  FOR SELECT TO authenticated USING (
    demande_adhesion_id IN (
      SELECT id FROM public.demande_adhesion 
      WHERE candidat_id IN (SELECT id FROM public.candidat WHERE utilisateur_id = auth.uid())
    )
    OR public.is_agent_or_admin()
  );

DROP POLICY IF EXISTS "piece_insert_owner_or_staff" ON public.piece;
CREATE POLICY "piece_insert_owner_or_staff" ON public.piece
  FOR INSERT TO authenticated WITH CHECK (
    demande_adhesion_id IN (
      SELECT id FROM public.demande_adhesion 
      WHERE candidat_id IN (SELECT id FROM public.candidat WHERE utilisateur_id = auth.uid())
    )
    OR public.is_agent_or_admin()
  );

-- ------------------------------------------------------------
-- 5. Œuvres et attestations
-- ------------------------------------------------------------

-- OEUVRE
DROP POLICY IF EXISTS "oeuvre_select_owner_or_staff" ON public.oeuvre;
CREATE POLICY "oeuvre_select_owner_or_staff" ON public.oeuvre
  FOR SELECT TO authenticated USING (
    membre_id IN (SELECT id FROM public.membre WHERE utilisateur_id = auth.uid())
    OR demande_adhesion_id IN (
      SELECT id FROM public.demande_adhesion 
      WHERE candidat_id IN (SELECT id FROM public.candidat WHERE utilisateur_id = auth.uid())
    )
    OR public.is_agent_or_admin()
  );

DROP POLICY IF EXISTS "oeuvre_insert_owner_or_staff" ON public.oeuvre;
CREATE POLICY "oeuvre_insert_owner_or_staff" ON public.oeuvre
  FOR INSERT TO authenticated WITH CHECK (
    membre_id IN (SELECT id FROM public.membre WHERE utilisateur_id = auth.uid())
    OR demande_adhesion_id IN (
      SELECT id FROM public.demande_adhesion 
      WHERE candidat_id IN (SELECT id FROM public.candidat WHERE utilisateur_id = auth.uid())
    )
    OR public.is_agent_or_admin()
  );

DROP POLICY IF EXISTS "oeuvre_update_staff" ON public.oeuvre;
CREATE POLICY "oeuvre_update_staff" ON public.oeuvre
  FOR UPDATE TO authenticated USING (public.is_agent_or_admin());

-- ATTESTATION_DIFFUSION
DROP POLICY IF EXISTS "attestation_select_owner_or_staff" ON public.attestation_diffusion;
CREATE POLICY "attestation_select_owner_or_staff" ON public.attestation_diffusion
  FOR SELECT TO authenticated USING (
    oeuvre_id IN (
      SELECT id FROM public.oeuvre 
      WHERE membre_id IN (SELECT id FROM public.membre WHERE utilisateur_id = auth.uid())
    )
    OR public.is_agent_or_admin()
  );

-- ------------------------------------------------------------
-- 6. Cotisations
-- ------------------------------------------------------------

-- COTISATION
DROP POLICY IF EXISTS "cotisation_select_owner_or_staff" ON public.cotisation;
CREATE POLICY "cotisation_select_owner_or_staff" ON public.cotisation
  FOR SELECT TO authenticated USING (
    membre_id IN (SELECT id FROM public.membre WHERE utilisateur_id = auth.uid())
    OR public.is_agent_or_admin()
  );

DROP POLICY IF EXISTS "cotisation_staff_manage" ON public.cotisation;
CREATE POLICY "cotisation_staff_manage" ON public.cotisation
  FOR ALL TO authenticated USING (public.is_agent_or_admin()) WITH CHECK (public.is_agent_or_admin());

-- ------------------------------------------------------------
-- 7. Paiements et preuves
-- ------------------------------------------------------------

-- PAIEMENT
DROP POLICY IF EXISTS "paiement_select_owner_or_staff" ON public.paiement;
CREATE POLICY "paiement_select_owner_or_staff" ON public.paiement
  FOR SELECT TO authenticated USING (
    candidat_id IN (SELECT id FROM public.candidat WHERE utilisateur_id = auth.uid())
    OR membre_id IN (SELECT id FROM public.membre WHERE utilisateur_id = auth.uid())
    OR public.is_agent_or_admin()
  );

DROP POLICY IF EXISTS "paiement_insert_owner_or_staff" ON public.paiement;
CREATE POLICY "paiement_insert_owner_or_staff" ON public.paiement
  FOR INSERT TO authenticated WITH CHECK (
    candidat_id IN (SELECT id FROM public.candidat WHERE utilisateur_id = auth.uid())
    OR membre_id IN (SELECT id FROM public.membre WHERE utilisateur_id = auth.uid())
    OR public.is_agent_or_admin()
  );

DROP POLICY IF EXISTS "paiement_staff_update" ON public.paiement;
CREATE POLICY "paiement_staff_update" ON public.paiement
  FOR UPDATE TO authenticated USING (public.is_agent_or_admin());

-- PREUVE_VIREMENT
DROP POLICY IF EXISTS "preuve_select_owner_or_staff" ON public.preuve_virement;
CREATE POLICY "preuve_select_owner_or_staff" ON public.preuve_virement
  FOR SELECT TO authenticated USING (
    paiement_id IN (
      SELECT id FROM public.paiement 
      WHERE candidat_id IN (SELECT id FROM public.candidat WHERE utilisateur_id = auth.uid())
         OR membre_id IN (SELECT id FROM public.membre WHERE utilisateur_id = auth.uid())
    )
    OR public.is_agent_or_admin()
  );

DROP POLICY IF EXISTS "preuve_insert_owner_or_staff" ON public.preuve_virement;
CREATE POLICY "preuve_insert_owner_or_staff" ON public.preuve_virement
  FOR INSERT TO authenticated WITH CHECK (
    paiement_id IN (
      SELECT id FROM public.paiement 
      WHERE candidat_id IN (SELECT id FROM public.candidat WHERE utilisateur_id = auth.uid())
         OR membre_id IN (SELECT id FROM public.membre WHERE utilisateur_id = auth.uid())
    )
    OR public.is_agent_or_admin()
  );

-- JOURNAL_PAIEMENT
DROP POLICY IF EXISTS "journal_staff_only" ON public.journal_paiement;
CREATE POLICY "journal_staff_only" ON public.journal_paiement
  FOR ALL TO authenticated USING (public.is_agent_or_admin());

-- ------------------------------------------------------------
-- 8. Notifications et sécurité
-- ------------------------------------------------------------

-- NOTIFICATION
DROP POLICY IF EXISTS "notification_select_owner" ON public.notification;
CREATE POLICY "notification_select_owner" ON public.notification
  FOR SELECT TO authenticated USING (
    globale = TRUE
    OR utilisateur_id = auth.uid()
    OR candidat_id IN (SELECT id FROM public.candidat WHERE utilisateur_id = auth.uid())
    OR public.is_agent_or_admin()
  );

DROP POLICY IF EXISTS "notification_update_owner" ON public.notification;
CREATE POLICY "notification_update_owner" ON public.notification
  FOR UPDATE TO authenticated USING (utilisateur_id = auth.uid()) WITH CHECK (utilisateur_id = auth.uid());

-- JETON_REINITIALISATION
DROP POLICY IF EXISTS "jeton_self_only" ON public.jeton_reinitialisation;
CREATE POLICY "jeton_self_only" ON public.jeton_reinitialisation
  FOR ALL TO authenticated USING (utilisateur_id = auth.uid());






-- 1. Lier la table utilisateur à Supabase Auth
ALTER TABLE public.utilisateur
  DROP COLUMN IF EXISTS mot_de_passe_hash,
  ADD CONSTRAINT utilisateur_id_fkey FOREIGN KEY (id) REFERENCES auth.users(id) ON DELETE CASCADE;

-- 2. Créer la fonction de synchronisation automatique
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.utilisateur (id, email, role, statut)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE((NEW.raw_user_meta_data->>'role')::role_utilisateur, 'MEMBRE'),
    'ACTIF'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Attacher le déclencheur sur les inscriptions Supabase Auth
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();






CREATE TABLE IF NOT EXISTS public.operateur_mobile_money (
  code        operateur_paiement PRIMARY KEY,
  libelle     TEXT NOT NULL,
  actif       BOOLEAN NOT NULL DEFAULT TRUE,
  ordre       INTEGER NOT NULL DEFAULT 0,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.operateur_mobile_money (code, libelle, actif, ordre)
VALUES
  ('MVOLA',        'MVola',        TRUE, 1),
  ('ORANGE_MONEY', 'Orange Money', TRUE, 2),
  ('AIRTEL_MONEY', 'Airtel Money', TRUE, 3)
ON CONFLICT (code) DO NOTHING;

ALTER TABLE public.operateur_mobile_money ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "operateur_mm_select_all" ON public.operateur_mobile_money;
CREATE POLICY "operateur_mm_select_all"
ON public.operateur_mobile_money
FOR SELECT TO public
USING (TRUE);

DROP POLICY IF EXISTS "operateur_mm_admin_all" ON public.operateur_mobile_money;
CREATE POLICY "operateur_mm_admin_all"
ON public.operateur_mobile_money
FOR ALL TO authenticated
USING (public.is_admin())
WITH CHECK (public.is_admin());

CREATE OR REPLACE FUNCTION public.verifier_operateur_mm_actif()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.mode = 'MOBILE_MONEY' THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.operateur_mobile_money omm
      WHERE omm.code = NEW.operateur AND omm.actif = TRUE
    ) THEN
      RAISE EXCEPTION 'Opérateur Mobile Money indisponible';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_verifier_operateur_mm_actif ON public.paiement;
CREATE TRIGGER trg_verifier_operateur_mm_actif
BEFORE INSERT OR UPDATE OF mode, operateur ON public.paiement
FOR EACH ROW EXECUTE FUNCTION public.verifier_operateur_mm_actif();