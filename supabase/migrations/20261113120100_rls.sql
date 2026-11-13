-- =============================================================================
-- Orbit V1 — contrôle d'accès (row-level security)
--
-- Règles :
--   * admin / manager (« agence ») : toutes les marques de LEUR organisation.
--   * client : uniquement les marques listées dans brand_access, lecture seule
--     (exception : il peut générer ses propres exports de rapport).
--   * Les tables de métriques ne sont écrites que par le service role (collecte).
--   * Les jetons (social_account_tokens) ne sont JAMAIS lisibles hors service role.
--
-- Les helpers sont SECURITY DEFINER (pas de récursion RLS) et STABLE ; les policies
-- utilisent « col in (select helper()) » pour que Postgres les évalue une seule fois.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers d'identité
-- -----------------------------------------------------------------------------
create or replace function public.current_org_id()
returns uuid
language sql stable security definer set search_path = ''
as $$
  select p.organization_id from public.profiles p where p.id = auth.uid();
$$;

create or replace function public.current_app_role()
returns public.app_role
language sql stable security definer set search_path = ''
as $$
  select p.role from public.profiles p where p.id = auth.uid();
$$;

-- Membre de l'équipe agence (admin ou manager) rattaché à une organisation
create or replace function public.is_agency_member()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid()
      and p.role in ('admin', 'manager')
      and p.organization_id is not null
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = auth.uid() and p.role = 'admin' and p.organization_id is not null
  );
$$;

-- Marques lisibles par l'utilisateur courant
create or replace function public.readable_brand_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  -- agence : toutes les marques de son organisation
  select b.id
  from public.brands b
  join public.profiles p on p.id = auth.uid()
  where p.role in ('admin', 'manager')
    and p.organization_id is not null
    and b.organization_id = p.organization_id
  union
  -- client : uniquement les marques explicitement partagées (et de son organisation)
  select b.id
  from public.brand_access ba
  join public.brands b on b.id = ba.brand_id
  join public.profiles p on p.id = ba.user_id
  where ba.user_id = auth.uid()
    and p.organization_id is not null
    and b.organization_id = p.organization_id;
$$;

create or replace function public.can_read_brand(p_brand_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select p_brand_id in (select public.readable_brand_ids());
$$;

-- Écriture (marque, comptes, campagnes, accès clients, envois programmés) : agence uniquement
create or replace function public.can_manage_brand(p_brand_id uuid)
returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1
    from public.brands b
    join public.profiles p on p.id = auth.uid()
    where b.id = p_brand_id
      and p.role in ('admin', 'manager')
      and b.organization_id = p.organization_id
  );
$$;

create or replace function public.readable_account_ids()
returns setof uuid
language sql stable security definer set search_path = ''
as $$
  select a.id from public.social_accounts a
  where a.brand_id in (select public.readable_brand_ids());
$$;

-- Rubriques visibles d'une marque pour l'utilisateur courant
-- (toutes pour l'agence, brand_access.visible_sections pour un client, {} sinon)
create or replace function public.brand_sections(p_brand_id uuid)
returns text[]
language sql stable security definer set search_path = ''
as $$
  select case
    when public.can_manage_brand(p_brand_id)
      then array['analytics','posts','audience','campaigns','reports']
    else coalesce((
      select ba.visible_sections::text[]
      from public.brand_access ba
      where ba.user_id = auth.uid()
        and ba.brand_id = p_brand_id
        and public.can_read_brand(p_brand_id)
    ), array[]::text[])
  end;
$$;

-- -----------------------------------------------------------------------------
-- Création automatique du profil à l'inscription.
-- Organisation et rôle viennent de raw_app_meta_data (réglable uniquement par le
-- service role, ex. auth.admin.inviteUserByEmail puis updateUserById) — jamais de
-- raw_user_meta_data, que l'utilisateur contrôle.
-- -----------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer set search_path = ''
as $$
declare
  v_role public.app_role := 'client';
  v_locale public.app_locale := 'fr';
begin
  if new.raw_app_meta_data ? 'role'
     and new.raw_app_meta_data->>'role' in ('admin', 'manager', 'client') then
    v_role := (new.raw_app_meta_data->>'role')::public.app_role;
  end if;
  if new.raw_user_meta_data->>'locale' in ('fr', 'en') then
    v_locale := (new.raw_user_meta_data->>'locale')::public.app_locale;
  end if;

  insert into public.profiles (id, email, full_name, organization_id, role, locale)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data->>'full_name', ''),
    nullif(new.raw_app_meta_data->>'organization_id', '')::uuid,
    v_role,
    v_locale
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Seul un admin (ou le service role, auth.uid() nul) change rôle / organisation d'un profil
create or replace function public.guard_profile_privileges()
returns trigger
language plpgsql security definer set search_path = ''
as $$
begin
  if (new.role is distinct from old.role or new.organization_id is distinct from old.organization_id)
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Seul un administrateur peut modifier le rôle ou l''organisation d''un utilisateur'
      using errcode = '42501';
  end if;
  if auth.uid() is not null and public.is_admin() and new.organization_id is distinct from public.current_org_id() then
    raise exception 'Un administrateur ne peut pas rattacher un utilisateur à une autre organisation'
      using errcode = '42501';
  end if;
  return new;
end;
$$;

create trigger profiles_guard_privileges
  before update on public.profiles
  for each row execute function public.guard_profile_privileges();

-- -----------------------------------------------------------------------------
-- Activation de la RLS
-- -----------------------------------------------------------------------------
alter table public.organizations          enable row level security;
alter table public.profiles               enable row level security;
alter table public.brands                 enable row level security;
alter table public.social_accounts        enable row level security;
alter table public.social_account_tokens  enable row level security;
alter table public.account_daily_metrics  enable row level security;
alter table public.campaigns              enable row level security;
alter table public.posts                  enable row level security;
alter table public.post_metrics           enable row level security;
alter table public.audience_snapshots     enable row level security;
alter table public.brand_access           enable row level security;
alter table public.access_logs            enable row level security;
alter table public.report_templates       enable row level security;
alter table public.report_schedules       enable row level security;
alter table public.report_exports         enable row level security;
alter table public.sync_runs              enable row level security;

-- -----------------------------------------------------------------------------
-- Privilèges : rien pour anon ; authenticated passe par la RLS ; jetons : service role seul
-- -----------------------------------------------------------------------------
revoke all on all tables in schema public from anon;
revoke all on all sequences in schema public from anon;
grant usage on schema public to authenticated, service_role;
grant select, insert, update, delete on all tables in schema public to authenticated;
grant usage, select on all sequences in schema public to authenticated;
grant all on all tables in schema public to service_role;
grant all on all sequences in schema public to service_role;
revoke all on public.social_account_tokens from authenticated;

revoke execute on all functions in schema public from public, anon;
grant execute on all functions in schema public to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- organizations
-- -----------------------------------------------------------------------------
create policy organizations_select on public.organizations
  for select to authenticated
  using (id = (select public.current_org_id()));

create policy organizations_update on public.organizations
  for update to authenticated
  using (id = (select public.current_org_id()) and (select public.is_admin()))
  with check (id = (select public.current_org_id()));

-- -----------------------------------------------------------------------------
-- profiles
-- -----------------------------------------------------------------------------
create policy profiles_select on public.profiles
  for select to authenticated
  using (
    id = (select auth.uid())
    or ((select public.is_agency_member()) and organization_id = (select public.current_org_id()))
  );

create policy profiles_update on public.profiles
  for update to authenticated
  using (
    id = (select auth.uid())
    or ((select public.is_admin()) and organization_id = (select public.current_org_id()))
  )
  with check (
    id = (select auth.uid())
    or ((select public.is_admin()) and organization_id = (select public.current_org_id()))
  );

-- -----------------------------------------------------------------------------
-- brands
-- -----------------------------------------------------------------------------
create policy brands_select on public.brands
  for select to authenticated
  using (id in (select public.readable_brand_ids()));

create policy brands_insert on public.brands
  for insert to authenticated
  with check ((select public.is_agency_member()) and organization_id = (select public.current_org_id()));

create policy brands_update on public.brands
  for update to authenticated
  using (public.can_manage_brand(id))
  with check (organization_id = (select public.current_org_id()));

create policy brands_delete on public.brands
  for delete to authenticated
  using ((select public.is_admin()) and organization_id = (select public.current_org_id()));

-- -----------------------------------------------------------------------------
-- social_accounts (les jetons sont dans social_account_tokens : aucune policy)
-- -----------------------------------------------------------------------------
create policy social_accounts_select on public.social_accounts
  for select to authenticated
  using (brand_id in (select public.readable_brand_ids()));

create policy social_accounts_insert on public.social_accounts
  for insert to authenticated
  with check (public.can_manage_brand(brand_id));

create policy social_accounts_update on public.social_accounts
  for update to authenticated
  using (public.can_manage_brand(brand_id))
  with check (public.can_manage_brand(brand_id));

create policy social_accounts_delete on public.social_accounts
  for delete to authenticated
  using (public.can_manage_brand(brand_id));

-- -----------------------------------------------------------------------------
-- Données collectées : lecture selon la marque, écriture service role uniquement
-- -----------------------------------------------------------------------------
create policy account_daily_metrics_select on public.account_daily_metrics
  for select to authenticated
  using (account_id in (select public.readable_account_ids()));

create policy posts_select on public.posts
  for select to authenticated
  using (account_id in (select public.readable_account_ids()));

-- l'agence peut rattacher une publication à une campagne
create policy posts_update on public.posts
  for update to authenticated
  using ((select public.is_agency_member()) and account_id in (select public.readable_account_ids()))
  with check ((select public.is_agency_member()) and account_id in (select public.readable_account_ids()));

create policy post_metrics_select on public.post_metrics
  for select to authenticated
  using (exists (
    select 1 from public.posts p
    where p.id = post_metrics.post_id
      and p.account_id in (select public.readable_account_ids())
  ));

create policy audience_snapshots_select on public.audience_snapshots
  for select to authenticated
  using (account_id in (select public.readable_account_ids()));

-- -----------------------------------------------------------------------------
-- campaigns
-- -----------------------------------------------------------------------------
create policy campaigns_select on public.campaigns
  for select to authenticated
  using (brand_id in (select public.readable_brand_ids()));

create policy campaigns_insert on public.campaigns
  for insert to authenticated
  with check (public.can_manage_brand(brand_id));

create policy campaigns_update on public.campaigns
  for update to authenticated
  using (public.can_manage_brand(brand_id))
  with check (public.can_manage_brand(brand_id));

create policy campaigns_delete on public.campaigns
  for delete to authenticated
  using (public.can_manage_brand(brand_id));

-- -----------------------------------------------------------------------------
-- brand_access : le client voit ses propres lignes ; l'agence gère
-- -----------------------------------------------------------------------------
create policy brand_access_select on public.brand_access
  for select to authenticated
  using (user_id = (select auth.uid()) or public.can_manage_brand(brand_id));

create policy brand_access_insert on public.brand_access
  for insert to authenticated
  with check (
    public.can_manage_brand(brand_id)
    and exists (
      select 1 from public.profiles p
      where p.id = brand_access.user_id
        and p.organization_id = (select public.current_org_id())
    )
  );

create policy brand_access_update on public.brand_access
  for update to authenticated
  using (public.can_manage_brand(brand_id))
  with check (public.can_manage_brand(brand_id));

create policy brand_access_delete on public.brand_access
  for delete to authenticated
  using (public.can_manage_brand(brand_id));

-- -----------------------------------------------------------------------------
-- access_logs : chacun écrit ses propres événements ; l'agence lit ceux de son organisation
-- -----------------------------------------------------------------------------
create policy access_logs_insert on public.access_logs
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and (brand_id is null or brand_id in (select public.readable_brand_ids()))
  );

create policy access_logs_select on public.access_logs
  for select to authenticated
  using (
    user_id = (select auth.uid())
    or (
      (select public.is_agency_member())
      and exists (
        select 1 from public.profiles p
        where p.id = access_logs.user_id
          and p.organization_id = (select public.current_org_id())
      )
    )
  );

-- -----------------------------------------------------------------------------
-- Rapports
-- -----------------------------------------------------------------------------
create policy report_templates_all on public.report_templates
  for all to authenticated
  using ((select public.is_agency_member()) and organization_id = (select public.current_org_id()))
  with check ((select public.is_agency_member()) and organization_id = (select public.current_org_id()));

-- Envois programmés : agence uniquement (interdit au client, §2.1)
create policy report_schedules_all on public.report_schedules
  for all to authenticated
  using (public.can_manage_brand(brand_id))
  with check (public.can_manage_brand(brand_id));

-- Exports : un client peut générer / lire les exports de sa marque si la rubrique « reports » lui est ouverte
create policy report_exports_select on public.report_exports
  for select to authenticated
  using (
    brand_id in (select public.readable_brand_ids())
    and 'reports' = any (public.brand_sections(brand_id))
  );

create policy report_exports_insert on public.report_exports
  for insert to authenticated
  with check (
    created_by = (select auth.uid())
    and brand_id in (select public.readable_brand_ids())
    and 'reports' = any (public.brand_sections(brand_id))
  );

create policy report_exports_delete on public.report_exports
  for delete to authenticated
  using (public.can_manage_brand(brand_id));

-- -----------------------------------------------------------------------------
-- sync_runs : journal de collecte, lecture agence uniquement
-- -----------------------------------------------------------------------------
create policy sync_runs_select on public.sync_runs
  for select to authenticated
  using (
    (select public.is_agency_member())
    and (account_id is null or account_id in (select public.readable_account_ids()))
  );
