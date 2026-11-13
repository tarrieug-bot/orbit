-- =============================================================================
-- Tests de la row-level security d'Orbit.
-- Pré-requis : migrations + seed.sql appliqués (voir supabase/tests/run.sh).
-- Chaque bloc échoue (RAISE EXCEPTION) si une règle est violée.
-- =============================================================================
\set ON_ERROR_STOP 1
\set QUIET 1

-- -----------------------------------------------------------------------------
-- Données supplémentaires : une 2e organisation (autre agence) et un client sans accès
-- -----------------------------------------------------------------------------
insert into public.organizations (id, name, slug)
values ('00000000-0000-4000-8000-000000000002', 'Autre agence', 'autre-agence');

insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('10000000-0000-4000-8000-000000000091', 'manager@autre.test',
   '{"organization_id":"00000000-0000-4000-8000-000000000002","role":"manager"}', '{}'),
  ('10000000-0000-4000-8000-000000000092', 'orphelin@orbit.test',
   '{"organization_id":"00000000-0000-4000-8000-000000000001","role":"client"}', '{}'),
  -- tentative d'élévation via user_metadata (contrôlé par l'utilisateur) : doit rester « client » sans organisation
  ('10000000-0000-4000-8000-000000000093', 'pirate@orbit.test',
   '{}', '{"role":"admin","organization_id":"00000000-0000-4000-8000-000000000001"}');

insert into public.brands (id, organization_id, name, slug)
values ('20000000-0000-4000-8000-000000000099', '00000000-0000-4000-8000-000000000002', 'Marque autre agence', 'autre');
insert into public.social_accounts (id, brand_id, network, external_id, handle)
values ('30000000-0000-4000-8000-000000000099', '20000000-0000-4000-8000-000000000099', 'ig', 'x-99', '@autre');
insert into public.account_daily_metrics (account_id, date, followers, reach)
values ('30000000-0000-4000-8000-000000000099', current_date - 1, 100, 50);
insert into public.social_account_tokens (account_id, access_token_enc)
select id, 'v1:fake:fake:fake' from public.social_accounts;

-- Le pirate n'a obtenu ni rôle ni organisation
do $$
begin
  if exists (select 1 from public.profiles where email = 'pirate@orbit.test'
             and (role <> 'client' or organization_id is not null)) then
    raise exception 'ÉCHEC : élévation de privilèges via raw_user_meta_data';
  end if;
  raise notice 'OK  profil créé depuis app_metadata uniquement';
end $$;

-- =============================================================================
-- 1. Client Café Lumière (brand 1 uniquement)
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000003","role":"authenticated"}';

do $$
declare
  b1 constant uuid := '20000000-0000-4000-8000-000000000001';
  n int;
begin
  -- marques
  if (select array_agg(id) from public.brands) is distinct from array[b1] then
    raise exception 'ÉCHEC client : voit d''autres marques que la sienne';
  end if;
  -- comptes
  select count(*) into n from public.social_accounts where brand_id <> b1;
  if n > 0 then raise exception 'ÉCHEC client : % compte(s) d''une autre marque visibles', n; end if;
  -- métriques
  select count(*) into n from public.account_daily_metrics m
    where m.account_id not in ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002');
  if n > 0 then raise exception 'ÉCHEC client : % ligne(s) de métriques d''une autre marque', n; end if;
  if (select count(*) from public.account_daily_metrics) = 0 then
    raise exception 'ÉCHEC client : ne voit pas ses propres métriques';
  end if;
  -- publications et snapshots
  select count(*) into n from public.posts p join public.social_accounts a on a.id = p.account_id where a.brand_id <> b1;
  if n > 0 then raise exception 'ÉCHEC client : publications d''une autre marque'; end if;
  select count(*) into n from public.post_metrics pm
    where pm.post_id not in (select id from public.posts);
  if n > 0 then raise exception 'ÉCHEC client : snapshots orphelins visibles'; end if;
  select count(*) into n from public.post_latest_metrics;
  if n = 0 then raise exception 'ÉCHEC client : vue post_latest_metrics vide'; end if;
  -- audience, campagnes
  select count(*) into n from public.audience_snapshots
    where account_id not in ('30000000-0000-4000-8000-000000000001', '30000000-0000-4000-8000-000000000002');
  if n > 0 then raise exception 'ÉCHEC client : audience d''une autre marque'; end if;
  select count(*) into n from public.campaigns where brand_id <> b1;
  if n > 0 then raise exception 'ÉCHEC client : campagnes d''une autre marque'; end if;
  -- accès direct par identifiant
  select count(*) into n from public.brands where id = '20000000-0000-4000-8000-000000000002';
  if n > 0 then raise exception 'ÉCHEC client : lecture directe de la marque 2'; end if;
  -- fonctions d'agrégation
  select count(*) into n from public.brand_metrics('20000000-0000-4000-8000-000000000002', current_date - 90, current_date);
  if n > 0 then raise exception 'ÉCHEC client : brand_metrics renvoie la marque 2'; end if;
  select count(*) into n from public.brand_metrics(b1, current_date - 30, current_date);
  if n = 0 then raise exception 'ÉCHEC client : brand_metrics vide pour sa marque'; end if;
  select count(*) into n from public.account_period_totals(current_date - 30, current_date) where brand_id <> b1;
  if n > 0 then raise exception 'ÉCHEC client : account_period_totals renvoie d''autres marques'; end if;
  if public.can_read_brand('20000000-0000-4000-8000-000000000002') then
    raise exception 'ÉCHEC client : can_read_brand(marque 2) = true';
  end if;
  if not public.can_read_brand(b1) then raise exception 'ÉCHEC client : can_read_brand(sa marque) = false'; end if;
  if public.is_agency_member() then raise exception 'ÉCHEC client : is_agency_member() = true'; end if;
  -- données réservées à l'agence
  if (select count(*) from public.report_schedules) > 0 then raise exception 'ÉCHEC client : voit les envois programmés'; end if;
  if (select count(*) from public.sync_runs) > 0 then raise exception 'ÉCHEC client : voit le journal de collecte'; end if;
  if (select count(*) from public.profiles) <> 1 then raise exception 'ÉCHEC client : voit d''autres profils'; end if;
  if (select count(*) from public.brand_access) <> 1 then raise exception 'ÉCHEC client : voit les accès des autres'; end if;
  raise notice 'OK  client : lecture limitée à sa marque (13 contrôles)';
end $$;

-- écritures interdites
do $$
declare n int;
begin
  begin
    perform 1 from public.social_account_tokens;
    raise exception 'ÉCHEC client : jetons lisibles';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.campaigns (brand_id, name, starts_on, ends_on)
    values ('20000000-0000-4000-8000-000000000001', 'x', current_date, current_date);
    raise exception 'ÉCHEC client : peut créer une campagne';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.brand_access (user_id, brand_id)
    values ('10000000-0000-4000-8000-000000000003', '20000000-0000-4000-8000-000000000002');
    raise exception 'ÉCHEC client : peut s''attribuer une autre marque';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.social_accounts (brand_id, network, external_id)
    values ('20000000-0000-4000-8000-000000000001', 'tt', 'x');
    raise exception 'ÉCHEC client : peut connecter un compte';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.report_schedules (brand_id, name)
    values ('20000000-0000-4000-8000-000000000001', 'x');
    raise exception 'ÉCHEC client : peut programmer un envoi';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set role = 'admin' where id = '10000000-0000-4000-8000-000000000003';
    raise exception 'ÉCHEC client : peut changer son rôle';
  exception when insufficient_privilege then null;
  end;
  begin
    insert into public.account_daily_metrics (account_id, date, reach)
    values ('30000000-0000-4000-8000-000000000001', current_date + 10, 1);
    raise exception 'ÉCHEC client : peut écrire des métriques';
  exception when insufficient_privilege then null;
  end;
  update public.brands set name = 'piratée' where true;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'ÉCHEC client : peut renommer une marque'; end if;
  delete from public.posts where true;
  get diagnostics n = row_count;
  if n > 0 then raise exception 'ÉCHEC client : peut supprimer des publications'; end if;
  -- autorisé : changer sa langue, générer un export de SA marque
  update public.profiles set locale = 'en' where id = '10000000-0000-4000-8000-000000000003';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ÉCHEC client : ne peut pas changer sa langue'; end if;
  insert into public.report_exports (brand_id, kind, period_start, period_end, created_by)
  values ('20000000-0000-4000-8000-000000000001', 'month', current_date - 30, current_date, '10000000-0000-4000-8000-000000000003');
  begin
    insert into public.report_exports (brand_id, kind, period_start, period_end, created_by)
    values ('20000000-0000-4000-8000-000000000002', 'month', current_date - 30, current_date, '10000000-0000-4000-8000-000000000003');
    raise exception 'ÉCHEC client : peut exporter une autre marque';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK  client : écritures interdites refusées, langue et export autorisés (12 contrôles)';
end $$;
rollback;

-- =============================================================================
-- 2. Client Atelier Mangrove (brand 2, sans rubrique « audience »)
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000004"}';
do $$
begin
  if (select array_agg(id) from public.brands) is distinct from array['20000000-0000-4000-8000-000000000002'::uuid] then
    raise exception 'ÉCHEC client 2 : marques visibles incorrectes';
  end if;
  if exists (select 1 from public.campaigns where brand_id <> '20000000-0000-4000-8000-000000000002') then
    raise exception 'ÉCHEC client 2 : campagnes d''une autre marque';
  end if;
  if public.brand_sections('20000000-0000-4000-8000-000000000002') @> array['audience'] then
    raise exception 'ÉCHEC client 2 : rubrique audience exposée';
  end if;
  if public.brand_sections('20000000-0000-4000-8000-000000000001') <> '{}'::text[] then
    raise exception 'ÉCHEC client 2 : rubriques d''une marque non partagée';
  end if;
  raise notice 'OK  client 2 : isolé sur sa marque, rubriques respectées';
end $$;
rollback;

-- =============================================================================
-- 3. Client sans aucun accès, et utilisateur « pirate »
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000092"}';
do $$
begin
  if (select count(*) from public.brands) > 0 or (select count(*) from public.account_daily_metrics) > 0
     or (select count(*) from public.posts) > 0 then
    raise exception 'ÉCHEC client sans accès : voit des données';
  end if;
  raise notice 'OK  client sans brand_access : aucune donnée';
end $$;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000093"}';
do $$
begin
  if (select count(*) from public.brands) > 0 then raise exception 'ÉCHEC pirate : voit des marques'; end if;
  raise notice 'OK  utilisateur auto-déclaré admin : aucune donnée';
end $$;
rollback;

-- =============================================================================
-- 4. Manager de l'agence 1
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000002"}';
do $$
declare n int;
begin
  if (select count(*) from public.brands) <> 3 then raise exception 'ÉCHEC manager : devrait voir 3 marques'; end if;
  if exists (select 1 from public.brands where organization_id <> '00000000-0000-4000-8000-000000000001') then
    raise exception 'ÉCHEC manager : voit une marque d''une autre organisation';
  end if;
  if exists (select 1 from public.account_daily_metrics where account_id = '30000000-0000-4000-8000-000000000099') then
    raise exception 'ÉCHEC manager : voit les métriques d''une autre organisation';
  end if;
  if (select count(*) from public.sync_runs) = 0 then raise exception 'ÉCHEC manager : ne voit pas le journal'; end if;
  if (select count(*) from public.profiles) < 4 then raise exception 'ÉCHEC manager : ne voit pas les profils de son organisation'; end if;
  if exists (select 1 from public.profiles where organization_id = '00000000-0000-4000-8000-000000000002') then
    raise exception 'ÉCHEC manager : voit les profils d''une autre organisation';
  end if;
  insert into public.campaigns (brand_id, name, starts_on, ends_on)
  values ('20000000-0000-4000-8000-000000000001', 'Test', current_date, current_date);
  begin
    insert into public.campaigns (brand_id, name, starts_on, ends_on)
    values ('20000000-0000-4000-8000-000000000099', 'Test', current_date, current_date);
    raise exception 'ÉCHEC manager : écrit dans une autre organisation';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.social_account_tokens;
    raise exception 'ÉCHEC manager : jetons lisibles';
  exception when insufficient_privilege then null;
  end;
  begin
    update public.profiles set role = 'admin' where id = '10000000-0000-4000-8000-000000000002';
    raise exception 'ÉCHEC manager : peut se promouvoir admin';
  exception when insufficient_privilege then null;
  end;
  insert into public.brand_access (user_id, brand_id)
  values ('10000000-0000-4000-8000-000000000092', '20000000-0000-4000-8000-000000000003');
  begin
    insert into public.brand_access (user_id, brand_id)
    values ('10000000-0000-4000-8000-000000000091', '20000000-0000-4000-8000-000000000003');
    raise exception 'ÉCHEC manager : donne accès à un utilisateur d''une autre organisation';
  exception when insufficient_privilege then null;
  end;
  select count(*) into n from public.account_period_totals(current_date - 30, current_date);
  if n <> 6 then raise exception 'ÉCHEC manager : account_period_totals renvoie % comptes au lieu de 6', n; end if;
  raise notice 'OK  manager : 3 marques de son organisation, écriture limitée à son organisation';
end $$;
rollback;

-- =============================================================================
-- 5. Admin de l'agence 1
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000001"}';
do $$
declare n int;
begin
  update public.profiles set role = 'manager' where id = '10000000-0000-4000-8000-000000000004';
  get diagnostics n = row_count;
  if n <> 1 then raise exception 'ÉCHEC admin : ne peut pas changer un rôle'; end if;
  update public.profiles set role = 'client' where id = '10000000-0000-4000-8000-000000000091';
  get diagnostics n = row_count;
  if n <> 0 then raise exception 'ÉCHEC admin : modifie un profil d''une autre organisation'; end if;
  begin
    update public.profiles set organization_id = '00000000-0000-4000-8000-000000000002'
    where id = '10000000-0000-4000-8000-000000000004';
    raise exception 'ÉCHEC admin : déplace un utilisateur vers une autre organisation';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK  admin : gestion des rôles limitée à son organisation';
end $$;
rollback;

-- =============================================================================
-- 6. Manager de l'autre agence
-- =============================================================================
begin;
set local role authenticated;
set local request.jwt.claims = '{"sub":"10000000-0000-4000-8000-000000000091"}';
do $$
begin
  if (select array_agg(id) from public.brands) is distinct from array['20000000-0000-4000-8000-000000000099'::uuid] then
    raise exception 'ÉCHEC autre agence : marques visibles incorrectes';
  end if;
  if exists (select 1 from public.posts) then raise exception 'ÉCHEC autre agence : voit les publications de l''agence 1'; end if;
  raise notice 'OK  autre organisation : cloisonnement inter-agences';
end $$;
rollback;

-- =============================================================================
-- 7. Anonyme
-- =============================================================================
begin;
set local role anon;
do $$
begin
  begin
    perform 1 from public.brands;
    raise exception 'ÉCHEC anon : lecture des marques';
  exception when insufficient_privilege then null;
  end;
  begin
    perform 1 from public.account_daily_metrics;
    raise exception 'ÉCHEC anon : lecture des métriques';
  exception when insufficient_privilege then null;
  end;
  raise notice 'OK  anonyme : aucun accès';
end $$;
rollback;

\echo 'Tous les tests RLS sont passés.'
