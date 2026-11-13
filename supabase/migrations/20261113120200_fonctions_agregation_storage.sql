-- =============================================================================
-- Orbit V1 — fonctions d'agrégation (SECURITY INVOKER : la RLS s'applique)
-- et bucket de stockage des exports.
-- =============================================================================

-- Séries quotidiennes d'une marque, sommées par réseau.
-- followers = somme des abonnés de fin de journée des comptes du réseau.
create or replace function public.brand_metrics(
  p_brand_id uuid,
  p_from date,
  p_to date,
  p_networks public.network[] default null
)
returns table (
  date              date,
  network           public.network,
  followers         bigint,
  followers_gained  bigint,
  followers_lost    bigint,
  reach             bigint,
  views             bigint,
  interactions      bigint,
  likes             bigint,
  comments          bigint,
  shares            bigint,
  saves             bigint,
  profile_visits    bigint,
  link_clicks       bigint,
  posts_count       bigint,
  video_views       bigint
)
language sql stable security invoker set search_path = ''
as $$
  select
    m.date,
    a.network,
    sum(m.followers)::bigint,
    sum(m.followers_gained)::bigint,
    sum(m.followers_lost)::bigint,
    sum(m.reach)::bigint,
    sum(m.views)::bigint,
    sum(coalesce(m.interactions,
                 coalesce(m.likes, 0) + coalesce(m.comments, 0) + coalesce(m.shares, 0) + coalesce(m.saves, 0)))::bigint,
    sum(m.likes)::bigint,
    sum(m.comments)::bigint,
    sum(m.shares)::bigint,
    sum(m.saves)::bigint,
    sum(m.profile_visits)::bigint,
    sum(m.link_clicks)::bigint,
    sum(m.posts_count)::bigint,
    sum(m.video_views)::bigint
  from public.account_daily_metrics m
  join public.social_accounts a on a.id = m.account_id
  where a.brand_id = p_brand_id
    and m.date between p_from and p_to
    and (p_networks is null or a.network = any (p_networks))
  group by m.date, a.network
  order by m.date, a.network;
$$;

-- Totaux d'une période par compte (vue d'ensemble, rapports).
-- followers_start = abonnés la veille du début (dernière valeur connue < p_from)
-- followers_end   = dernière valeur connue <= p_to
create or replace function public.account_period_totals(
  p_from date,
  p_to date,
  p_brand_ids uuid[] default null,
  p_networks public.network[] default null
)
returns table (
  account_id        uuid,
  brand_id          uuid,
  network           public.network,
  followers_start   integer,
  followers_end     integer,
  followers_gained  bigint,
  followers_lost    bigint,
  reach             bigint,
  views             bigint,
  interactions      bigint,
  likes             bigint,
  comments          bigint,
  shares            bigint,
  saves             bigint,
  profile_visits    bigint,
  link_clicks       bigint,
  posts_count       bigint,
  video_views       bigint,
  last_post_at      timestamptz
)
language sql stable security invoker set search_path = ''
as $$
  select
    a.id,
    a.brand_id,
    a.network,
    (select m0.followers from public.account_daily_metrics m0
      where m0.account_id = a.id and m0.date < p_from and m0.followers is not null
      order by m0.date desc limit 1),
    (select m1.followers from public.account_daily_metrics m1
      where m1.account_id = a.id and m1.date <= p_to and m1.followers is not null
      order by m1.date desc limit 1),
    sum(m.followers_gained)::bigint,
    sum(m.followers_lost)::bigint,
    sum(m.reach)::bigint,
    sum(m.views)::bigint,
    sum(coalesce(m.interactions,
                 coalesce(m.likes, 0) + coalesce(m.comments, 0) + coalesce(m.shares, 0) + coalesce(m.saves, 0)))::bigint,
    sum(m.likes)::bigint,
    sum(m.comments)::bigint,
    sum(m.shares)::bigint,
    sum(m.saves)::bigint,
    sum(m.profile_visits)::bigint,
    sum(m.link_clicks)::bigint,
    sum(m.posts_count)::bigint,
    sum(m.video_views)::bigint,
    (select max(p.published_at) from public.posts p
      where p.account_id = a.id and p.published_at < (p_to + 1))
  from public.social_accounts a
  left join public.account_daily_metrics m
    on m.account_id = a.id and m.date between p_from and p_to
  where (p_brand_ids is null or a.brand_id = any (p_brand_ids))
    and (p_networks is null or a.network = any (p_networks))
  group by a.id, a.brand_id, a.network;
$$;

grant execute on function public.brand_metrics(uuid, date, date, public.network[]) to authenticated, service_role;
grant execute on function public.account_period_totals(date, date, uuid[], public.network[]) to authenticated, service_role;
revoke execute on function public.brand_metrics(uuid, date, date, public.network[]) from public, anon;
revoke execute on function public.account_period_totals(date, date, uuid[], public.network[]) from public, anon;

-- -----------------------------------------------------------------------------
-- Stockage des exports (Supabase Storage) : bucket privé « exports »,
-- chemins « <brand_id>/<export_id>.<format> ». Ignoré hors Supabase (tests).
-- -----------------------------------------------------------------------------
do $$
begin
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('exports', 'exports', false)
    on conflict (id) do nothing;

    execute $p$
      create policy "exports_read_by_brand" on storage.objects
        for select to authenticated
        using (
          bucket_id = 'exports'
          and public.can_read_brand(((storage.foldername(name))[1])::uuid)
          and 'reports' = any (public.brand_sections(((storage.foldername(name))[1])::uuid))
        )
    $p$;
  end if;
end;
$$;
