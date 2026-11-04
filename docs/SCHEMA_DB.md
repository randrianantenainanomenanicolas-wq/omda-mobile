# OMDA — Base de données Supabase (3 opérateurs Mobile Money)

Ce document contient l'intégralité du script SQL de la base de données OMDA, configuré pour les paiements via Mobile Money (**MVola, Orange Money, Airtel Money**). Les opérateurs sont servis par la table `operateur_mobile_money`, jamais codés en dur.

```sql
-- ============================================================
-- OMDA — DB_SUPABASE (MVOLA uniquement)
-- PostgreSQL / Supabase
-- ============================================================

-- Extension
create extension if not exists "pgcrypto";

-- ============================================================
-- Types énumérés
-- ============================================================

create type role_utilisateur as enum (
  'MEMBRE',
  'AGENT',
  'ADMINISTRATEUR'
);

create type statut_utilisateur as enum (
  'ACTIF',
  'DESACTIVE',
  'EN_ATTENTE_CHANGEMENT_MDP'
);

create type statut_demande as enum (
  'BROUILLON',
  'ENVOYEE',
  'EN_COURS_DE_VERIFICATION',
  'VALIDEE',
  'REJETEE',
  'ADHESION_TERMINEE'
);

create type type_piece as enum (
  'PHOTO',
  'CIN',
  'ACTE_NAISSANCE',
  'CERTIFICAT_RESIDENCE',
  'AUTORISATION_PARENTALE',
  'AUTRE',
  'OEUVRE',
  'ATTESTATION_DIFFUSION',
  'BULLETIN',
  'SELFIE_CIN'
);

create type statut_oeuvre as enum (
  'BROUILLON',
  'ENVOYEE',
  'EN_COURS_DE_VALIDATION',
  'VALIDEE',
  'REJETEE',
  'DEPOT_FINALISE'
);

create type type_paiement as enum (
  'ADHESION',
  'DEPOT_OEUVRE',
  'COTISATION'
);

-- Paiement : Mobile Money uniquement
create type mode_paiement as enum ('MOBILE_MONEY');

-- Opérateurs Mobile Money (3 opérateurs au choix, servis par operateur_mobile_money)
create type operateur_paiement as enum ('MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY');

-- Statuts paiement
create type statut_paiement as enum (
  'INITIE',
  'EN_ATTENTE_CONFIRMATION',
  'REUSSI',
  'ECHEC_SOLDE_INSUFFISANT',
  'ECHEC_AUTRE',
  'REJETE'
);

create type type_operation_tarif as enum (
  'ADHESION',
  'DEPOT_OEUVRE',
  'COTISATION'
);

create type statut_cotisation as enum (
  'NON_PAYEE',
  'PAYEE'
);

create type statut_adhesion_categorie as enum (
  'ACTIVE',
  'EN_ATTENTE',
  'INACTIVE',
  'REJETEE',
  'ANNULEE'
);

-- Notifications
create type type_notification as enum (
  'DEMANDE_ENVOYEE',
  'DEMANDE_VALIDEE',
  'DEMANDE_REJETEE',
  'PAIEMENT_DISPONIBLE',
  'PAIEMENT_REUSSI',
  'PAIEMENT_ECHEC',
  'OEUVRE_VALIDEE',
  'OEUVRE_REJETEE',
  'IDENTIFIANTS_ENVOYES',
  'GLOBALE'
);

-- Type de bulletin par catégorie
create type type_bulletin as enum (
  'LITTERAIRE',
  'DRAMATIQUE',
  'MUSIQUE_ACR',
  'MUSIQUE_COLLECTIVE',
  'AUDIOVISUEL',
  'FIGURATIF_PROVISOIRE'
);

-- Type d'œuvre littéraire (Livre / Poème)
create type litteraire_type as enum (
  'LIVRE',
  'POEME'
);

-- ============================================================
-- Référentiels
-- ============================================================

create table categorie (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  libelle       text not null,
  description   text,
  ordre         integer not null,
  type_bulletin type_bulletin not null,
  actif         boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create table tarif (
  id              uuid primary key default gen_random_uuid(),
  type_operation  type_operation_tarif not null,
  categorie_id    uuid references categorie(id),
  montant         integer not null check (montant >= 0),
  devise          char(3) not null default 'MGA',
  actif           boolean not null default true,
  date_debut      date,
  date_fin        date,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  constraint tarif_dates_chk check (date_fin is null or date_debut is null or date_fin >= date_debut)
);

create unique index tarif_actif_unique
  on tarif (type_operation, coalesce(categorie_id, '00000000-0000-0000-0000-000000000000'::uuid))
  where actif = true;

create table operateur_mobile_money (
  code      operateur_paiement primary key,
  libelle   text not null,
  actif     boolean not null default true,
  ordre     integer not null,
  updated_at timestamptz not null default now()
);

create table documentation (
  id          uuid primary key default gen_random_uuid(),
  slug        text not null unique,
  titre       text not null,
  contenu     text not null,
  ordre       integer not null default 0,
  publie      boolean not null default true,
  updated_at  timestamptz not null default now()
);

-- ============================================================
-- Identités et comptes
-- ============================================================

-- IMPORTANT : utilisateur.id est lié à auth.users.id => pas de default gen_random_uuid()
create table utilisateur (
  id                         uuid primary key,
  email                      text not null unique,
  telephone                  text,
  role                       role_utilisateur not null,
  statut                     statut_utilisateur not null default 'ACTIF',
  doit_changer_mot_de_passe  boolean not null default false,
  derniere_connexion_at      timestamptz,
  created_at                 timestamptz not null default now(),
  updated_at                 timestamptz not null default now()
);

create index utilisateur_role_idx on utilisateur (role);

create table candidat (
  id                        uuid primary key default gen_random_uuid(),
  nom                       text not null,
  prenom                    text not null,
  pseudonyme                text not null,
  groupe                    text not null,
  cin                       text not null unique,
  date_naissance            date not null,
  telephone                 text not null,
  email                     text not null,
  adresse                   text not null,
  ancien_chef_lieu_province_id uuid references ancien_chef_lieu_province(id),
  territoire                text not null default 'Madagascar et le monde entier',
  compte_bancaire           text, -- facultatif, jamais bloquant, donnée sensible : RLS stricte, jamais journalisé
  utilisateur_id            uuid unique references utilisateur(id),
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  constraint candidat_age_min_chk check (date_naissance <= (current_date - interval '15 years'))
);

create table membre (
  id                 uuid primary key default gen_random_uuid(),
  utilisateur_id     uuid not null unique references utilisateur(id),
  candidat_id        uuid not null unique references candidat(id),
  -- OBSOLETE : numero_adherent est conservé pour rétrocompatibilité (étape 28).
  -- Remplacé par membre_categorie.numero_omda (attribué côté serveur, par catégorie, à la validation).
  -- Suppression prévue à l'étape 29 (migration DROP, modèle, mocks, écrans, tests).
  numero_adherent    text not null unique,
  statut             statut_utilisateur not null default 'ACTIF',
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create table membre_categorie (
  id                   uuid primary key default gen_random_uuid(),
  membre_id            uuid not null references membre(id) on delete cascade,
  categorie_id         uuid not null references categorie(id),
  demande_adhesion_id  uuid,
  numero_omda          text unique, -- attribué côté serveur à la validation, nul tant que la demande n'est pas validée
  statut               statut_adhesion_categorie not null default 'ACTIVE',
  date_activation      timestamptz not null default now(),
  unique (membre_id, categorie_id)
);

-- ============================================================
-- Ancien chef-lieu de province (liste de référence, servie par le service, jamais codée dans l'écran)
-- ============================================================

create table ancien_chef_lieu_province (
  id          uuid primary key default gen_random_uuid(),
  libelle     text not null unique,
  ordre       integer not null,
  actif       boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- FK candidat vers ancien_chef_lieu_province (ajoutée après création des deux tables)
alter table public.candidat
  add constraint candidat_ancien_chef_lieu_fk
  foreign key (ancien_chef_lieu_province_id) references ancien_chef_lieu_province(id);

-- ============================================================
-- Autorisation de soumission d'œuvre (usage unique, liée au membre et au brouillon, hachée, expiration 10 min)
-- ============================================================

create table autorisation_soumission_oeuvre (
  id              uuid primary key default gen_random_uuid(),
  membre_id       uuid not null references membre(id) on delete cascade,
  oeuvre_brouillon_id uuid not null references oeuvre(id) on delete cascade,
  jeton_hash      text not null unique,
  expire_at       timestamptz not null,
  utilisee        boolean not null default false,
  created_at      timestamptz not null default now()
);

create index autorisation_soumission_membre_idx on autorisation_soumission_oeuvre (membre_id);
create index autorisation_soumission_jeton_idx on autorisation_soumission_oeuvre (jeton_hash);

-- ============================================================
-- Compteur d'échecs de confirmation par mot de passe (par membre, réinitialisé à la connexion réussie)
-- ============================================================

create table compteur_echecs_mot_de_passe (
  id               uuid primary key default gen_random_uuid(),
  membre_id        uuid not null unique references membre(id) on delete cascade,
  nb_echecs        integer not null default 0 check (nb_echecs >= 0),
  dernier_echec_at timestamptz,
  reset_at         timestamptz not null default now(),
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

-- ============================================================
-- Demandes d'adhésion et pièces
-- ============================================================

create table demande_adhesion (
  id                     uuid primary key default gen_random_uuid(),
  numero_dossier         text not null unique,
  jeton_suivi_hash       text not null,
  candidat_id            uuid not null references candidat(id),
  membre_id              uuid references membre(id),
  categorie_id           uuid not null references categorie(id),
  statut                 statut_demande not null default 'BROUILLON',
  motif_rejet            text,
  date_soumission        timestamptz,
  date_decision          timestamptz,
  agent_id               uuid references utilisateur(id),
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint demande_rejet_motif_chk check (
    statut <> 'REJETEE' or motif_rejet is not null
  )
);

create index demande_statut_idx on demande_adhesion (statut);
create index demande_candidat_idx on demande_adhesion (candidat_id);
create index demande_membre_idx on demande_adhesion (membre_id);

alter table membre_categorie
  add constraint membre_categorie_demande_fk
  foreign key (demande_adhesion_id) references demande_adhesion(id);

create table piece (
  id                    uuid primary key default gen_random_uuid(),
  demande_adhesion_id   uuid not null references demande_adhesion(id) on delete cascade,
  type                  type_piece not null,
  chemin_stockage       text not null,
  mime_type             text not null,
  taille_octets         integer not null check (taille_octets > 0 and taille_octets <= 20971520),
  created_at            timestamptz not null default now()
);

create index piece_demande_idx on piece (demande_adhesion_id);

-- ============================================================
-- Œuvres et attestations
-- ============================================================

create table oeuvre (
  id                    uuid primary key default gen_random_uuid(),
  membre_id             uuid references membre(id),
  demande_adhesion_id   uuid references demande_adhesion(id),
  categorie_id          uuid not null references categorie(id),
  titre                 text not null,
  description           text,
  annee                 integer,
  statut                statut_oeuvre not null default 'BROUILLON',
  motif_rejet           text,
  chemin_fichier        text,
  mime_type             text,
  taille_octets         integer check (taille_octets is null or (taille_octets > 0 and taille_octets <= 20971520)),
  date_soumission       timestamptz,
  date_decision         timestamptz,
  agent_id              uuid references utilisateur(id),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  constraint oeuvre_contexte_chk check (
    membre_id is not null or demande_adhesion_id is not null
  ),
  constraint oeuvre_rejet_motif_chk check (
    statut <> 'REJETEE' or motif_rejet is not null
  )
);

create index oeuvre_membre_idx on oeuvre (membre_id);
create index oeuvre_demande_idx on oeuvre (demande_adhesion_id);
create index oeuvre_statut_idx on oeuvre (statut);

create table attestation_diffusion (
  id              uuid primary key default gen_random_uuid(),
  oeuvre_id       uuid not null references oeuvre(id) on delete cascade,
  chemin_stockage text not null,
  mime_type       text not null,
  taille_octets   integer not null check (taille_octets > 0 and taille_octets <= 20971520),
  created_at      timestamptz not null default now()
);

-- ============================================================
-- Cotisations
-- ============================================================

create table cotisation (
  id               uuid primary key default gen_random_uuid(),
  membre_id        uuid not null references membre(id) on delete cascade,
  annee            integer not null,
  montant          integer not null check (montant >= 0),
  statut           statut_cotisation not null default 'NON_PAYEE',
  date_paiement    timestamptz,
  created_at       timestamptz not null default now(),
  unique (membre_id, annee)
);

-- ============================================================
-- Paiements (MOBILE_MONEY + MVOLA uniquement)
-- ============================================================

create table paiement (
  id                     uuid primary key default gen_random_uuid(),
  type                   type_paiement not null,
  montant                integer not null check (montant >= 0),
  devise                 char(3) not null default 'MGA',
  mode                   mode_paiement not null default 'MOBILE_MONEY',
  operateur              operateur_paiement not null default 'MVOLA',
  numero_telephone       text not null,
  reference_interne      text not null unique,
  reference_externe      text unique,
  statut                 statut_paiement not null default 'INITIE',
  motif_echec            text,
  demande_adhesion_id    uuid references demande_adhesion(id),
  oeuvre_id              uuid references oeuvre(id),
  cotisation_id          uuid references cotisation(id),
  candidat_id            uuid references candidat(id),
  membre_id              uuid references membre(id),
  date_initiation        timestamptz not null default now(),
  date_confirmation      timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now(),
  constraint paiement_contexte_chk check (
    (type = 'ADHESION'     and demande_adhesion_id is not null) or
    (type = 'DEPOT_OEUVRE' and oeuvre_id is not null) or
    (type = 'COTISATION'   and cotisation_id is not null)
  ),
  -- 3 opérateurs acceptés (MVola, Orange Money, Airtel Money), liste dynamique depuis operateur_mobile_money
  constraint paiement_mm_operateur_chk check (operateur in ('MVOLA', 'ORANGE_MONEY', 'AIRTEL_MONEY')),
  constraint paiement_mm_tel_chk check (numero_telephone <> '')
);

create index paiement_statut_idx on paiement (statut);
create index paiement_demande_idx on paiement (demande_adhesion_id);
create index paiement_oeuvre_idx on paiement (oeuvre_id);

create unique index paiement_adhesion_reussi_unique
  on paiement (demande_adhesion_id)
  where type = 'ADHESION' and statut = 'REUSSI';

create unique index paiement_depot_reussi_unique
  on paiement (oeuvre_id)
  where type = 'DEPOT_OEUVRE' and statut = 'REUSSI';

create unique index paiement_cotisation_reussi_unique
  on paiement (cotisation_id)
  where type = 'COTISATION' and statut = 'REUSSI';

create table journal_paiement (
  id            uuid primary key default gen_random_uuid(),
  paiement_id   uuid not null references paiement(id) on delete cascade,
  evenement     text not null,
  payload       jsonb,
  created_at    timestamptz not null default now()
);

create index journal_paiement_idx on journal_paiement (paiement_id, created_at);

-- ============================================================
-- Notifications et sécurité
-- ============================================================

create table notification (
  id             uuid primary key default gen_random_uuid(),
  utilisateur_id uuid references utilisateur(id) on delete cascade,
  candidat_id    uuid references candidat(id) on delete cascade,
  type           type_notification not null,
  titre          text not null,
  message        text not null,
  lue            boolean not null default false,
  globale        boolean not null default false,
  metadata       jsonb,
  date_envoi     timestamptz not null default now(),
  constraint notification_destinataire_chk check (
    globale = true or utilisateur_id is not null or candidat_id is not null
  )
);

create index notification_user_idx on notification (utilisateur_id, lue, date_envoi desc);

create table jeton_reinitialisation (
  id              uuid primary key default gen_random_uuid(),
  utilisateur_id  uuid not null references utilisateur(id) on delete cascade,
  jeton_hash      text not null unique,
  expire_at       timestamptz not null,
  utilise_at      timestamptz,
  created_at      timestamptz not null default now()
);

-- ============================================================
-- Storage buckets
-- ============================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values
  ('pieces',  'pieces',  false, 20971520, array['image/jpeg', 'image/png', 'application/pdf']),
  ('oeuvres', 'oeuvres', false, 20971520, array['audio/mpeg', 'audio/wav', 'application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Policies storage (pièces)
drop policy if exists "Autoriser upload pieces" on storage.objects;
create policy "Autoriser upload pieces"
on storage.objects for insert
to public
with check (bucket_id = 'pieces');

drop policy if exists "Autoriser lecture pieces" on storage.objects;
create policy "Autoriser lecture pieces"
on storage.objects for select
to public
using (bucket_id = 'pieces');

-- Policies storage (oeuvres)
drop policy if exists "Autoriser upload oeuvres" on storage.objects;
create policy "Autoriser upload oeuvres"
on storage.objects for insert
to public
with check (bucket_id = 'oeuvres');

drop policy if exists "Autoriser lecture oeuvres" on storage.objects;
create policy "Autoriser lecture oeuvres"
on storage.objects for select
to public
using (bucket_id = 'oeuvres');

-- ============================================================
-- RLS : fonctions utilitaires
-- ============================================================

create or replace function public.get_user_role()
returns role_utilisateur as $$
  select role from public.utilisateur where id = auth.uid();
$$ language sql security definer stable;

create or replace function public.is_admin()
returns boolean as $$
  select coalesce((public.get_user_role() = 'ADMINISTRATEUR'), false);
$$ language sql security definer stable;

create or replace function public.is_agent_or_admin()
returns boolean as $$
  select coalesce((public.get_user_role() in ('AGENT', 'ADMINISTRATEUR')), false);
$$ language sql security definer stable;

-- ============================================================
-- Activer RLS sur toutes les tables
-- ============================================================

alter table public.categorie enable row level security;
alter table public.tarif enable row level security;
alter table public.documentation enable row level security;
alter table public.operateur_mobile_money enable row level security;
alter table public.ancien_chef_lieu_province enable row level security;
alter table public.autorisation_soumission_oeuvre enable row level security;
alter table public.compteur_echecs_mot_de_passe enable row level security;

alter table public.utilisateur enable row level security;
alter table public.candidat enable row level security;
alter table public.membre enable row level security;
alter table public.membre_categorie enable row level security;

alter table public.demande_adhesion enable row level security;
alter table public.piece enable row level security;

alter table public.oeuvre enable row level security;
alter table public.attestation_diffusion enable row level security;

alter table public.cotisation enable row level security;
alter table public.paiement enable row level security;
alter table public.journal_paiement enable row level security;

alter table public.notification enable row level security;
alter table public.jeton_reinitialisation enable row level security;

-- ============================================================
-- Policies RLS — Référentiels
-- ============================================================

-- CATEGORIE (lecture publique)
drop policy if exists "categorie_select_all" on public.categorie;
create policy "categorie_select_all" on public.categorie
  for select to public using (true);

drop policy if exists "categorie_admin_all" on public.categorie;
create policy "categorie_admin_all" on public.categorie
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- TARIF (lecture publique)
drop policy if exists "tarif_select_all" on public.tarif;
create policy "tarif_select_all" on public.tarif
  for select to public using (true);

drop policy if exists "tarif_admin_all" on public.tarif;
create policy "tarif_admin_all" on public.tarif
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- OPERATEUR_MOBILE_MONEY (lecture publique, actifs seulement)
drop policy if exists "operateur_mobile_money_select_public" on public.operateur_mobile_money;
create policy "operateur_mobile_money_select_public" on public.operateur_mobile_money
  for select to public using (actif = true);

drop policy if exists "operateur_mobile_money_admin_all" on public.operateur_mobile_money;
create policy "operateur_mobile_money_admin_all" on public.operateur_mobile_money
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ANCIEN_CHEF_LIEU_PROVINCE (lecture publique)
drop policy if exists "ancien_chef_lieu_select_public" on public.ancien_chef_lieu_province;
create policy "ancien_chef_lieu_select_public" on public.ancien_chef_lieu_province
  for select to public using (actif = true);

drop policy if exists "ancien_chef_lieu_admin_all" on public.ancien_chef_lieu_province;
create policy "ancien_chef_lieu_admin_all" on public.ancien_chef_lieu_province
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- AUTORISATION_SOUMISSION_OEUVRE (propriétaire seulement)
drop policy if exists "autorisation_soumission_select_owner" on public.autorisation_soumission_oeuvre;
create policy "autorisation_soumission_select_owner" on public.autorisation_soumission_oeuvre
  for select to authenticated using (
    membre_id in (select id from public.membre where utilisateur_id = auth.uid())
    or public.is_agent_or_admin()
  );

drop policy if exists "autorisation_soumission_insert_owner" on public.autorisation_soumission_oeuvre;
create policy "autorisation_soumission_insert_owner" on public.autorisation_soumission_oeuvre
  for insert to authenticated with check (
    membre_id in (select id from public.membre where utilisateur_id = auth.uid())
    or public.is_agent_or_admin()
  );

drop policy if exists "autorisation_soumission_update_owner" on public.autorisation_soumission_oeuvre;
create policy "autorisation_soumission_update_owner" on public.autorisation_soumission_oeuvre
  for update to authenticated using (
    membre_id in (select id from public.membre where utilisateur_id = auth.uid())
    or public.is_agent_or_admin()
  );

-- COMPTEUR_ECHECS_MOT_DE_PASSE (accès strictement serveur, aucun accès mobile direct)
drop policy if exists "compteur_echecs_staff_only" on public.compteur_echecs_mot_de_passe;
create policy "compteur_echecs_staff_only" on public.compteur_echecs_mot_de_passe
  for all to authenticated using (public.is_agent_or_admin());

-- DOCUMENTATION (publique si publie=true)
drop policy if exists "documentation_select_public" on public.documentation;
create policy "documentation_select_public" on public.documentation
  for select to public using (publie = true or public.is_agent_or_admin());

drop policy if exists "documentation_admin_all" on public.documentation;
create policy "documentation_admin_all" on public.documentation
  for all to authenticated using (public.is_admin()) with check (public.is_admin());

-- ============================================================
-- Policies RLS — Identités et comptes
-- ============================================================

-- UTILISATEUR
drop policy if exists "utilisateur_select_self_or_staff" on public.utilisateur;
create policy "utilisateur_select_self_or_staff" on public.utilisateur
  for select to authenticated using (id = auth.uid() or public.is_agent_or_admin());

drop policy if exists "utilisateur_update_self_or_admin" on public.utilisateur;
create policy "utilisateur_update_self_or_admin" on public.utilisateur
  for update to authenticated
  using (id = auth.uid() or public.is_admin())
  with check (id = auth.uid() or public.is_admin());

-- CANDIDAT
drop policy if exists "candidat_select_self_or_staff" on public.candidat;
create policy "candidat_select_self_or_staff" on public.candidat
  for select to authenticated using (utilisateur_id = auth.uid() or public.is_agent_or_admin());

drop policy if exists "candidat_insert_self_or_staff" on public.candidat;
create policy "candidat_insert_self_or_staff" on public.candidat
  for insert to authenticated with check (utilisateur_id = auth.uid() or public.is_agent_or_admin());

drop policy if exists "candidat_update_self_or_staff" on public.candidat;
create policy "candidat_update_self_or_staff" on public.candidat
  for update to authenticated using (utilisateur_id = auth.uid() or public.is_agent_or_admin());

-- MEMBRE
drop policy if exists "membre_select_self_or_staff" on public.membre;
create policy "membre_select_self_or_staff" on public.membre
  for select to authenticated using (utilisateur_id = auth.uid() or public.is_agent_or_admin());

drop policy if exists "membre_staff_manage" on public.membre;
create policy "membre_staff_manage" on public.membre
  for all to authenticated using (public.is_agent_or_admin()) with check (public.is_agent_or_admin());

-- MEMBRE_CATEGORIE
drop policy if exists "membre_categorie_select" on public.membre_categorie;
create policy "membre_categorie_select" on public.membre_categorie
  for select to authenticated using (
    membre_id in (select id from public.membre where utilisateur_id = auth.uid())
    or public.is_agent_or_admin()
  );

drop policy if exists "membre_categorie_staff_all" on public.membre_categorie;
create policy "membre_categorie_staff_all" on public.membre_categorie
  for all to authenticated using (public.is_agent_or_admin()) with check (public.is_agent_or_admin());

-- ============================================================
-- Policies RLS — Demandes + pièces
-- ============================================================

-- DEMANDE_ADHESION
drop policy if exists "demande_select_owner_or_staff" on public.demande_adhesion;
create policy "demande_select_owner_or_staff" on public.demande_adhesion
  for select to authenticated using (
    candidat_id in (select id from public.candidat where utilisateur_id = auth.uid())
    or membre_id in (select id from public.membre where utilisateur_id = auth.uid())
    or public.is_agent_or_admin()
  );

drop policy if exists "demande_insert_owner_or_staff" on public.demande_adhesion;
create policy "demande_insert_owner_or_staff" on public.demande_adhesion
  for insert to authenticated with check (
    candidat_id in (select id from public.candidat where utilisateur_id = auth.uid())
    or public.is_agent_or_admin()
  );

drop policy if exists "demande_update_owner_or_staff" on public.demande_adhesion;
create policy "demande_update_owner_or_staff" on public.demande_adhesion
  for update to authenticated using (
    (candidat_id in (select id from public.candidat where utilisateur_id = auth.uid()) and statut = 'BROUILLON')
    or public.is_agent_or_admin()
  );

-- PIECE
drop policy if exists "piece_select_owner_or_staff" on public.piece;
create policy "piece_select_owner_or_staff" on public.piece
  for select to authenticated using (
    demande_adhesion_id in (
      select id from public.demande_adhesion
      where candidat_id in (select id from public.candidat where utilisateur_id = auth.uid())
    )
    or public.is_agent_or_admin()
  );

drop policy if exists "piece_insert_owner_or_staff" on public.piece;
create policy "piece_insert_owner_or_staff" on public.piece
  for insert to authenticated with check (
    demande_adhesion_id in (
      select id from public.demande_adhesion
      where candidat_id in (select id from public.candidat where utilisateur_id = auth.uid())
    )
    or public.is_agent_or_admin()
  );

-- ============================================================
-- Policies RLS — Œuvres + attestations
-- ============================================================

-- OEUVRE
drop policy if exists "oeuvre_select_owner_or_staff" on public.oeuvre;
create policy "oeuvre_select_owner_or_staff" on public.oeuvre
  for select to authenticated using (
    membre_id in (select id from public.membre where utilisateur_id = auth.uid())
    or demande_adhesion_id in (
      select id from public.demande_adhesion
      where candidat_id in (select id from public.candidat where utilisateur_id = auth.uid())
    )
    or public.is_agent_or_admin()
  );

drop policy if exists "oeuvre_insert_owner_or_staff" on public.oeuvre;
create policy "oeuvre_insert_owner_or_staff" on public.oeuvre
  for insert to authenticated with check (
    membre_id in (select id from public.membre where utilisateur_id = auth.uid())
    or demande_adhesion_id in (
      select id from public.demande_adhesion
      where candidat_id in (select id from public.candidat where utilisateur_id = auth.uid())
    )
    or public.is_agent_or_admin()
  );

drop policy if exists "oeuvre_update_staff" on public.oeuvre;
create policy "oeuvre_update_staff" on public.oeuvre
  for update to authenticated using (public.is_agent_or_admin());

-- ATTESTATION_DIFFUSION
drop policy if exists "attestation_select_owner_or_staff" on public.attestation_diffusion;
create policy "attestation_select_owner_or_staff" on public.attestation_diffusion
  for select to authenticated using (
    oeuvre_id in (
      select id from public.oeuvre
      where membre_id in (select id from public.membre where utilisateur_id = auth.uid())
    )
    or public.is_agent_or_admin()
  );

-- ============================================================
-- Policies RLS — Cotisations
-- ============================================================

drop policy if exists "cotisation_select_owner_or_staff" on public.cotisation;
create policy "cotisation_select_owner_or_staff" on public.cotisation
  for select to authenticated using (
    membre_id in (select id from public.membre where utilisateur_id = auth.uid())
    or public.is_agent_or_admin()
  );

drop policy if exists "cotisation_staff_manage" on public.cotisation;
create policy "cotisation_staff_manage" on public.cotisation
  for all to authenticated using (public.is_agent_or_admin()) with check (public.is_agent_or_admin());

-- ============================================================
-- Policies RLS — Paiements
-- ============================================================

drop policy if exists "paiement_select_owner_or_staff" on public.paiement;
create policy "paiement_select_owner_or_staff" on public.paiement
  for select to authenticated using (
    candidat_id in (select id from public.candidat where utilisateur_id = auth.uid())
    or membre_id in (select id from public.membre where utilisateur_id = auth.uid())
    or public.is_agent_or_admin()
  );

drop policy if exists "paiement_insert_owner_or_staff" on public.paiement;
create policy "paiement_insert_owner_or_staff" on public.paiement
  for insert to authenticated with check (
    candidat_id in (select id from public.candidat where utilisateur_id = auth.uid())
    or membre_id in (select id from public.membre where utilisateur_id = auth.uid())
    or public.is_agent_or_admin()
  );

drop policy if exists "paiement_staff_update" on public.paiement;
create policy "paiement_staff_update" on public.paiement
  for update to authenticated using (public.is_agent_or_admin());

-- JOURNAL_PAIEMENT (staff only)
drop policy if exists "journal_staff_only" on public.journal_paiement;
create policy "journal_staff_only" on public.journal_paiement
  for all to authenticated using (public.is_agent_or_admin());

-- ============================================================
-- Policies RLS — Notifications
-- ============================================================

drop policy if exists "notification_select_owner" on public.notification;
create policy "notification_select_owner" on public.notification
  for select to authenticated using (
    globale = true
    or utilisateur_id = auth.uid()
    or candidat_id in (select id from public.candidat where utilisateur_id = auth.uid())
    or public.is_agent_or_admin()
  );

drop policy if exists "notification_update_owner" on public.notification;
create policy "notification_update_owner" on public.notification
  for update to authenticated using (utilisateur_id = auth.uid()) with check (utilisateur_id = auth.uid());

-- JETON_REINITIALISATION (self only)
drop policy if exists "jeton_self_only" on public.jeton_reinitialisation;
create policy "jeton_self_only" on public.jeton_reinitialisation
  for all to authenticated using (utilisateur_id = auth.uid());

-- ============================================================
-- Lier utilisateur à Supabase Auth + trigger sync
-- ============================================================

-- Lien FK vers auth.users (Supabase)
alter table public.utilisateur
  add constraint utilisateur_id_fkey foreign key (id) references auth.users(id) on delete cascade;

-- Fonction de synchronisation automatique lors de la création d'un user Auth
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.utilisateur (id, email, role, statut)
  values (
    new.id,
    new.email,
    coalesce((new.raw_user_meta_data->>'role')::role_utilisateur, 'MEMBRE'),
    'ACTIF'
  );
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

alter table public.attestation_diffusion
  drop constraint if exists attestation_diffusion_mime_chk;

alter table public.attestation_diffusion
  add constraint attestation_diffusion_mime_chk
  check (mime_type in ('application/pdf','image/jpeg','image/png'));

-- ============================================================
-- Seed : référentiels (5 catégories, tarifs, 3 opérateurs, 6 anciens chefs-lieux)
-- ============================================================

-- Catégories (toujours dans l'ordre : Musique, Littéraire, Dramatique, Audiovisuel, Figuratif)
insert into categorie (id, code, libelle, description, ordre, type_bulletin, actif) values
  ('11111111-1111-1111-1111-111111111101', 'MUSIQUE', 'Musique', 'Œuvres musicales', 1, 'MUSIQUE_ACR', true),
  ('11111111-1111-1111-1111-111111111102', 'LITTERAIRE', 'Littéraire', 'Œuvres littéraires (Livre, Poème)', 2, 'LITTERAIRE', true),
  ('11111111-1111-1111-1111-111111111103', 'DRAMATIQUE', 'Dramatique', 'Œuvres dramatiques', 3, 'DRAMATIQUE', true),
  ('11111111-1111-1111-1111-111111111104', 'AUDIOVISUEL', 'Audiovisuel', 'Œuvres audiovisuelles et cinématographiques', 4, 'AUDIOVISUEL', true),
  ('11111111-1111-1111-1111-111111111105', 'FIGURATIF', 'Figuratif', 'Œuvres figuratives — formulaire et bulletin provisoires, à confirmer', 5, 'FIGURATIF_PROVISOIRE', true)
on conflict (code) do nothing;

-- Tarifs (montants lus par l'app, jamais codés en dur)
-- Adhésion : nouvel adhérent 20 000 Ar ; membre existant (nouvelle catégorie) 10 000 Ar
insert into tarif (type_operation, categorie_id, montant, devise, actif) values
  ('ADHESION', null, 20000, 'MGA', true),
  ('ADHESION', (select id from categorie where code = 'MUSIQUE'), 10000, 'MGA', true),
  ('ADHESION', (select id from categorie where code = 'LITTERAIRE'), 10000, 'MGA', true),
  ('ADHESION', (select id from categorie where code = 'DRAMATIQUE'), 10000, 'MGA', true),
  ('ADHESION', (select id from categorie where code = 'AUDIOVISUEL'), 10000, 'MGA', true),
  ('ADHESION', (select id from categorie where code = 'FIGURATIF'), 10000, 'MGA', true),
  -- Déclaration par titre
  ('DEPOT_OEUVRE', (select id from categorie where code = 'MUSIQUE'), 1000, 'MGA', true),
  ('DEPOT_OEUVRE', (select id from categorie where code = 'LITTERAIRE'), 1000, 'MGA', true), -- Livre : 1 000 ; Poème : 500 (règle métier, à affiner par type d'œuvre)
  ('DEPOT_OEUVRE', (select id from categorie where code = 'DRAMATIQUE'), 1000, 'MGA', true),
  ('DEPOT_OEUVRE', (select id from categorie where code = 'AUDIOVISUEL'), 1000, 'MGA', true),
  ('DEPOT_OEUVRE', (select id from categorie where code = 'FIGURATIF'), 500, 'MGA', true)
on conflict (type_operation, coalesce(categorie_id, '00000000-0000-0000-0000-000000000000'::uuid)) where actif = true do nothing;

-- Opérateurs Mobile Money (3 opérateurs au choix, servis par operateur_mobile_money)
insert into operateur_mobile_money (code, libelle, actif, ordre) values
  ('MVOLA', 'MVola', true, 1),
  ('ORANGE_MONEY', 'Orange Money', true, 2),
  ('AIRTEL_MONEY', 'Airtel Money', true, 3)
on conflict (code) do nothing;

-- Anciens chefs-lieux de province (liste de référence, servie par le service, jamais codée dans l'écran)
insert into ancien_chef_lieu_province (libelle, ordre, actif) values
  ('Antananarivo', 1, true),
  ('Antsiranana', 2, true),
  ('Fianarantsoa', 3, true),
  ('Mahajanga', 4, true),
  ('Toamasina', 5, true),
  ('Toliara', 6, true)
on conflict (libelle) do nothing;
```