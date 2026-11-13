-- =============================================================================
-- Orbit V1 — état de la collecte Meta par compte (curseur de backfill, dernière
-- synchro quotidienne, dernière démographie). Table technique : service role uniquement
-- (RLS activée, aucune policy, droits retirés à anon / authenticated).
-- =============================================================================
create table public.account_sync_state (
  account_id          uuid primary key references public.social_accounts (id) on delete cascade,
  -- plus ancienne date de métriques collectée (le backfill remonte à partir d'ici)
  backfill_cursor     date,
  -- true quand Meta ne renvoie plus rien ou que 2 ans sont couverts
  backfill_done       boolean not null default false,
  -- dernier jour (fuseau agence) où la collecte quotidienne a abouti
  last_daily_on       date,
  audience_synced_at  timestamptz,
  -- informations techniques (métriques indisponibles, dernier quota observé…)
  meta                jsonb not null default '{}'::jsonb,
  updated_at          timestamptz not null default now()
);
create index account_sync_state_daily_idx on public.account_sync_state (last_daily_on nulls first);
create trigger account_sync_state_touch before update on public.account_sync_state
  for each row execute function public.touch_updated_at();

alter table public.account_sync_state enable row level security;
revoke all on public.account_sync_state from anon, authenticated;
grant all on public.account_sync_state to service_role;
