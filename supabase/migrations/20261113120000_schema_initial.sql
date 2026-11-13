-- =============================================================================
-- Orbit V1 — schéma initial
-- Organisations → marques → comptes sociaux → métriques quotidiennes / publications
-- Contrôle d'accès : row-level security (voir 20261113120100_rls.sql)
-- =============================================================================

-- gen_random_uuid() est natif depuis PostgreSQL 13 : aucune extension requise.

-- -----------------------------------------------------------------------------
-- Types énumérés
-- -----------------------------------------------------------------------------
create type public.app_role as enum ('admin', 'manager', 'client');
create type public.app_locale as enum ('fr', 'en');
-- ig = Instagram, fb = Facebook, tt = TikTok, li = LinkedIn, yt = YouTube (V2)
create type public.network as enum ('ig', 'fb', 'tt', 'li', 'yt');
create type public.account_status as enum ('pending', 'active', 'expiring', 'expired', 'error', 'disconnected');
create type public.post_format as enum ('image', 'carousel', 'reel', 'video', 'story', 'link', 'status');
create type public.sync_status as enum ('running', 'success', 'partial', 'error');
create type public.report_kind as enum ('month', 'campaign', 'year', 'custom');
create type public.report_frequency as enum ('weekly', 'monthly', 'quarterly', 'yearly');
create type public.export_format as enum ('pdf', 'pptx', 'csv');
create type public.export_status as enum ('pending', 'processing', 'ready', 'error');

-- Rubriques d'une marque visibles par un client (brand_access.visible_sections)
create domain public.brand_section as text
  check (value in ('analytics', 'posts', 'audience', 'campaigns', 'reports'));

-- -----------------------------------------------------------------------------
-- Utilitaire : updated_at automatique
-- -----------------------------------------------------------------------------
create or replace function public.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Organisations (l'agence)
-- -----------------------------------------------------------------------------
create table public.organizations (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  slug        text not null unique,
  logo_url    text,                                    -- §2.3 : plus tard
  timezone    text not null default 'America/Martinique',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger organizations_touch before update on public.organizations
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Profils utilisateurs (1-1 avec auth.users)
-- -----------------------------------------------------------------------------
create table public.profiles (
  id               uuid primary key references auth.users (id) on delete cascade,
  organization_id  uuid references public.organizations (id) on delete set null,
  email            text not null,
  full_name        text,
  role             public.app_role not null default 'client',
  locale           public.app_locale not null default 'fr',
  avatar_url       text,
  last_seen_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index profiles_org_idx on public.profiles (organization_id);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Marques (groupe de comptes multi-réseaux)
-- -----------------------------------------------------------------------------
create table public.brands (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  slug             text not null,
  sector           text,
  color            text not null default '#6366F1' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  avatar_url       text,             -- photo de profil (par défaut : celle du compte principal)
  archived_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (organization_id, slug)
);
create index brands_org_idx on public.brands (organization_id) where archived_at is null;
create trigger brands_touch before update on public.brands
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Comptes sociaux (Page Facebook, compte Instagram pro…)
-- -----------------------------------------------------------------------------
create table public.social_accounts (
  id                uuid primary key default gen_random_uuid(),
  brand_id          uuid not null references public.brands (id) on delete cascade,
  network           public.network not null,
  external_id       text not null,          -- id Page FB / id IG user / …
  parent_page_id    text,                   -- IG : id de la Page Facebook liée (porteuse du jeton)
  handle            text,                   -- @compte ou nom court
  name              text,
  avatar_url        text,                   -- rafraîchi à chaque synchro (URL CDN Meta signée)
  followers_count   integer,
  token_expires_at  timestamptz,            -- copie non sensible de social_account_tokens.expires_at
  status            public.account_status not null default 'pending',
  status_message    text,
  last_synced_at    timestamptz,
  history_from      date,                   -- plus ancienne date de métriques collectée
  connected_by      uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (network, external_id)
);
create index social_accounts_brand_idx on public.social_accounts (brand_id);
create index social_accounts_status_idx on public.social_accounts (status);
create trigger social_accounts_touch before update on public.social_accounts
  for each row execute function public.touch_updated_at();

-- Jetons d'accès : table séparée, JAMAIS lisible par anon/authenticated (service role uniquement).
-- Chiffrés côté serveur en AES-256-GCM (TOKEN_ENCRYPTION_KEY), format "v1:<iv>:<tag>:<données>" (base64).
create table public.social_account_tokens (
  account_id        uuid primary key references public.social_accounts (id) on delete cascade,
  access_token_enc  text not null,
  token_type        text not null default 'page',   -- page | user | system_user
  scopes            text[] not null default '{}',
  expires_at        timestamptz,
  updated_at        timestamptz not null default now()
);
create trigger social_account_tokens_touch before update on public.social_account_tokens
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Métriques quotidiennes par compte (NULL = métrique indisponible, ≠ 0)
-- -----------------------------------------------------------------------------
create table public.account_daily_metrics (
  account_id        uuid not null references public.social_accounts (id) on delete cascade,
  date              date not null,
  followers         integer,          -- abonnés en fin de journée
  followers_gained  integer,
  followers_lost    integer,
  reach             bigint,           -- FB page_total_media_view_unique / IG reach
  views             bigint,           -- FB page_media_view / IG views
  interactions      integer,          -- FB page_post_engagements / IG total_interactions
  likes             integer,
  comments          integer,
  shares            integer,
  saves             integer,
  profile_visits    integer,          -- FB page_views_total / IG profile_views
  link_clicks       integer,          -- IG profile_links_taps
  posts_count       integer,
  video_views       bigint,
  raw               jsonb,            -- réponse brute utile au diagnostic (optionnel)
  updated_at        timestamptz not null default now(),
  primary key (account_id, date)
);
create index account_daily_metrics_date_idx on public.account_daily_metrics (date);

-- -----------------------------------------------------------------------------
-- Campagnes
-- -----------------------------------------------------------------------------
create table public.campaigns (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references public.brands (id) on delete cascade,
  name         text not null,
  description  text,
  starts_on    date not null,
  ends_on      date not null,
  hashtags     text[] not null default '{}',
  color        text check (color is null or color ~ '^#[0-9A-Fa-f]{6}$'),
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  check (ends_on >= starts_on)
);
create index campaigns_brand_idx on public.campaigns (brand_id, starts_on desc);
create trigger campaigns_touch before update on public.campaigns
  for each row execute function public.touch_updated_at();

-- -----------------------------------------------------------------------------
-- Publications + snapshots de statistiques (J+1, J+7, J+28)
-- -----------------------------------------------------------------------------
create table public.posts (
  id             uuid primary key default gen_random_uuid(),
  account_id     uuid not null references public.social_accounts (id) on delete cascade,
  network        public.network not null,        -- dénormalisé pour les filtres
  external_id    text not null,
  published_at   timestamptz not null,
  format         public.post_format not null,
  caption        text,                            -- langue d'origine, jamais traduite
  permalink      text,
  thumbnail_url  text,
  media_url      text,
  campaign_id    uuid references public.campaigns (id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  unique (account_id, external_id)
);
create index posts_account_published_idx on public.posts (account_id, published_at desc);
create index posts_campaign_idx on public.posts (campaign_id) where campaign_id is not null;
create trigger posts_touch before update on public.posts
  for each row execute function public.touch_updated_at();

create table public.post_metrics (
  post_id       uuid not null references public.posts (id) on delete cascade,
  snapshot_day  smallint not null check (snapshot_day in (1, 7, 28)),
  captured_at   timestamptz not null default now(),
  reach         bigint,
  views         bigint,
  interactions  integer,
  likes         integer,
  comments      integer,
  shares        integer,
  saves         integer,
  video_views   bigint,
  raw           jsonb,
  primary key (post_id, snapshot_day)
);

-- Dernier snapshot connu par publication (security_invoker : la RLS des tables s'applique)
create view public.post_latest_metrics
with (security_invoker = true) as
select distinct on (pm.post_id)
  pm.post_id, pm.snapshot_day, pm.captured_at, pm.reach, pm.views, pm.interactions,
  pm.likes, pm.comments, pm.shares, pm.saves, pm.video_views
from public.post_metrics pm
order by pm.post_id, pm.snapshot_day desc;

-- -----------------------------------------------------------------------------
-- Audience (démographie Instagram ; Meta ne fournit pas celle des Pages FB)
-- demographics = { "age_gender": [{"age":"25-34","gender":"F","value":123}],
--                  "cities": [{"key":"Fort-de-France, Martinique","value":456}],
--                  "countries": [{"key":"MQ","value":789}] }
-- online_followers = { "<jour ISO>": { "0": 12, …, "23": 40 } }
-- -----------------------------------------------------------------------------
create table public.audience_snapshots (
  account_id        uuid not null references public.social_accounts (id) on delete cascade,
  date              date not null,
  demographics      jsonb not null default '{}'::jsonb,
  online_followers  jsonb,
  created_at        timestamptz not null default now(),
  primary key (account_id, date)
);

-- -----------------------------------------------------------------------------
-- Accès clients (lecture seule) : une ligne = un utilisateur client sur une marque
-- -----------------------------------------------------------------------------
create table public.brand_access (
  user_id           uuid not null references public.profiles (id) on delete cascade,
  brand_id          uuid not null references public.brands (id) on delete cascade,
  visible_sections  public.brand_section[] not null
                    default array['analytics','posts','audience','campaigns','reports']::public.brand_section[],
  invited_by        uuid references public.profiles (id) on delete set null,
  created_at        timestamptz not null default now(),
  primary key (user_id, brand_id)
);
create index brand_access_brand_idx on public.brand_access (brand_id);

-- Journal des connexions clients (visible par l'agence, §2.1)
create table public.access_logs (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  brand_id    uuid references public.brands (id) on delete set null,
  event       text not null default 'login',      -- login | view | export
  path        text,
  user_agent  text,
  created_at  timestamptz not null default now()
);
create index access_logs_user_idx on public.access_logs (user_id, created_at desc);
create index access_logs_brand_idx on public.access_logs (brand_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Rapports
-- -----------------------------------------------------------------------------
create table public.report_templates (
  id               uuid primary key default gen_random_uuid(),
  organization_id  uuid not null references public.organizations (id) on delete cascade,
  name             text not null,
  sections         text[] not null default '{}',
  networks         public.network[] not null default array['ig','fb']::public.network[],
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create trigger report_templates_touch before update on public.report_templates
  for each row execute function public.touch_updated_at();

create table public.report_schedules (
  id           uuid primary key default gen_random_uuid(),
  brand_id     uuid not null references public.brands (id) on delete cascade,
  template_id  uuid references public.report_templates (id) on delete set null,
  name         text not null,
  kind         public.report_kind not null default 'month',
  frequency    public.report_frequency not null default 'monthly',
  recipients   text[] not null default '{}',
  locale       public.app_locale not null default 'fr',
  format       public.export_format not null default 'pdf',
  networks     public.network[] not null default array['ig','fb']::public.network[],
  sections     text[] not null default '{}',
  compare      boolean not null default true,
  active       boolean not null default true,
  next_run_at  timestamptz,
  last_run_at  timestamptz,
  created_by   uuid references public.profiles (id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index report_schedules_due_idx on public.report_schedules (next_run_at) where active;
create index report_schedules_brand_idx on public.report_schedules (brand_id);
create trigger report_schedules_touch before update on public.report_schedules
  for each row execute function public.touch_updated_at();

create table public.report_exports (
  id            uuid primary key default gen_random_uuid(),
  brand_id      uuid not null references public.brands (id) on delete cascade,
  schedule_id   uuid references public.report_schedules (id) on delete set null,
  campaign_id   uuid references public.campaigns (id) on delete set null,
  kind          public.report_kind not null,
  period_start  date not null,
  period_end    date not null,
  locale        public.app_locale not null default 'fr',
  format        public.export_format not null default 'pdf',
  networks      public.network[] not null default array['ig','fb']::public.network[],
  sections      text[] not null default '{}',
  status        public.export_status not null default 'pending',
  storage_path  text,                    -- bucket "exports" : <brand_id>/<export_id>.<format>
  error         text,
  created_by    uuid references public.profiles (id) on delete set null,
  created_at    timestamptz not null default now(),
  completed_at  timestamptz,
  check (period_end >= period_start)
);
create index report_exports_brand_idx on public.report_exports (brand_id, created_at desc);

-- -----------------------------------------------------------------------------
-- Journal de collecte (équivalent serveur du « Diagnostic API »)
-- details = { "calls": [{ "metric":"page_follows", "ok":true, "values":30, "message":"…" }], … }
-- -----------------------------------------------------------------------------
create table public.sync_runs (
  id           bigint generated always as identity primary key,
  account_id   uuid references public.social_accounts (id) on delete cascade,  -- NULL = exécution globale
  kind         text not null default 'daily',   -- daily | posts | audience | backfill | token
  trigger      text not null default 'cron',    -- cron | manual | connect
  started_at   timestamptz not null default now(),
  finished_at  timestamptz,
  status       public.sync_status not null default 'running',
  range_from   date,
  range_to     date,
  details      jsonb not null default '{}'::jsonb,
  error        text
);
create index sync_runs_account_idx on public.sync_runs (account_id, started_at desc);
create index sync_runs_started_idx on public.sync_runs (started_at desc);
