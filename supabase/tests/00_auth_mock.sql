-- =============================================================================
-- Simulation minimale de Supabase pour tester les migrations sur un postgres:16 nu.
-- NE PAS appliquer sur Supabase (le schéma auth y existe déjà).
-- =============================================================================
do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'anon') then
    create role anon nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin noinherit;
  end if;
  if not exists (select 1 from pg_roles where rolname = 'service_role') then
    create role service_role nologin noinherit bypassrls;
  end if;
end;
$$;

create schema if not exists auth;
grant usage on schema auth to anon, authenticated, service_role;

create table if not exists auth.users (
  instance_id                 uuid,
  id                          uuid primary key,
  aud                         varchar(255),
  role                        varchar(255),
  email                       varchar(255),
  encrypted_password          varchar(255),
  email_confirmed_at          timestamptz,
  raw_app_meta_data           jsonb default '{}'::jsonb,
  raw_user_meta_data          jsonb default '{}'::jsonb,
  created_at                  timestamptz default now(),
  updated_at                  timestamptz default now(),
  confirmation_token          varchar(255) default '',
  recovery_token              varchar(255) default '',
  email_change                varchar(255) default '',
  email_change_token_new      varchar(255) default ''
);

-- Comme Supabase : l'identité vient du JWT (request.jwt.claims)
create or replace function auth.uid()
returns uuid
language sql stable
as $$
  select nullif(
    coalesce(
      current_setting('request.jwt.claim.sub', true),
      (nullif(current_setting('request.jwt.claims', true), '')::jsonb ->> 'sub')
    ),
    ''
  )::uuid;
$$;

grant execute on function auth.uid() to anon, authenticated, service_role;
grant usage on schema public to anon, authenticated, service_role;
