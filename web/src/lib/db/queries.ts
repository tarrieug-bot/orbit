import "server-only";
import { cache } from "react";
import {
  addDays,
  buildDailySeries,
  computeTotals,
  detectAlerts,
  normalizeDailyRow,
  spanWithPrevious,
  todayISO,
  type Alert,
  type DailyMetrics,
  type DateRange,
  type Filters,
  type MetricTotals,
  type SeriesPoint,
} from "@/lib/metrics";
import { getDataSource } from "./source";
import type { SessionUser } from "./source/types";
import type {
  AccountStatus,
  AppLocale,
  AudienceDemographics,
  BrandSection,
  CampaignRow,
  ISODate,
  ISOTimestamp,
  Network,
  PostFormat,
  ReportScheduleRow,
  SyncRunRow,
} from "./types";
import { BRAND_SECTIONS } from "./types";

// =============================================================================
// Interfaces publiques (STABLES — le front s'appuie dessus ; toute évolution
// doit rester rétrocompatible ou être coordonnée par le lead)
// =============================================================================

export interface AccountSummary {
  id: string;
  brandId: string;
  network: Network;
  externalId: string;
  handle: string | null;
  name: string | null;
  /** photo de profil de la Page / du compte (rafraîchie à chaque synchro) */
  avatarUrl: string | null;
  followersCount: number | null;
  status: AccountStatus;
  statusMessage: string | null;
  lastSyncedAt: ISOTimestamp | null;
  tokenExpiresAt: ISOTimestamp | null;
}

export interface BrandSummary {
  id: string;
  name: string;
  slug: string;
  sector: string | null;
  color: string;
  /** photo de la marque, sinon celle du premier compte, sinon null (→ initiales) */
  avatarUrl: string | null;
  accounts: AccountSummary[];
  /** réseaux distincts des comptes (pour les pastilles) */
  networks: Network[];
  /** rubriques visibles pour l'utilisateur courant */
  sections: BrandSection[];
}

export interface PeriodComparison {
  totals: MetricTotals;
  /** null si comparaison désactivée */
  previous: MetricTotals | null;
}

export interface OverviewAccountRow extends PeriodComparison {
  account: AccountSummary;
  /** portée quotidienne sur les 30 derniers jours de la période (sparkline) */
  reachTrend: number[];
  lastPostDate: ISODate | null;
}

export interface OverviewBrandRow extends PeriodComparison {
  brand: BrandSummary;
  reachTrend: number[];
  accounts: OverviewAccountRow[];
}

export interface OverviewData extends PeriodComparison {
  range: DateRange;
  /** série quotidienne agrégée de toutes les marques (sparklines des KPI) */
  series: SeriesPoint[];
  previousRange: DateRange | null;
  brands: OverviewBrandRow[];
  alerts: Alert[];
}

export interface NetworkBreakdown extends PeriodComparison {
  network: Network;
  accounts: AccountSummary[];
}

export interface BrandMetricsData extends PeriodComparison {
  brand: BrandSummary;
  range: DateRange;
  previousRange: DateRange | null;
  /** comptes retenus (filtre réseaux appliqué) */
  accounts: AccountSummary[];
  /** un point par jour de la période (somme des comptes) */
  series: SeriesPoint[];
  /** série de la période de comparaison, alignée jour à jour (même longueur) */
  previousSeries: SeriesPoint[] | null;
  byNetwork: NetworkBreakdown[];
  /** lignes brutes normalisées (période + comparaison), pour des calculs spécifiques */
  rows: DailyMetrics[];
}

export interface PostMetricsSummary {
  reach: number | null;
  views: number | null;
  interactions: number;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  videoViews: number | null;
  /** interactions ÷ portée, sinon ÷ abonnés du compte, sinon null */
  engagementRate: number | null;
  /** snapshot utilisé : J+1, J+7 ou J+28 */
  snapshotDay: 1 | 7 | 28 | null;
}

export interface PostItem {
  id: string;
  accountId: string;
  brandId: string;
  network: Network;
  externalId: string;
  publishedAt: ISOTimestamp;
  format: PostFormat;
  /** légende dans sa langue d'origine (jamais traduite) */
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  campaignId: string | null;
  account: Pick<AccountSummary, "handle" | "name" | "avatarUrl">;
  metrics: PostMetricsSummary;
}

export type PostSortKey = "date" | "reach" | "views" | "interactions" | "engagementRate";

export interface PostQuery {
  range: DateRange;
  networks?: Network[];
  formats?: PostFormat[];
  campaignId?: string | null;
  sort?: PostSortKey;
  direction?: "asc" | "desc";
  limit?: number;
}

export interface AudienceShare {
  key: string;
  value: number;
  /** part du total (0–1) */
  share: number;
}

export interface AudienceData {
  account: AccountSummary;
  date: ISODate;
  /** tranches d'âge triées, avec part femmes / hommes / non précisé (0–1 du total) */
  ageGender: { age: string; female: number; male: number; unknown: number }[];
  genderShares: { female: number; male: number; unknown: number };
  cities: AudienceShare[];
  /** key = code pays ISO alpha-2 (à traduire via Intl.DisplayNames) */
  countries: AudienceShare[];
  /** moyenne normalisée (0–1) des abonnés en ligne, [jour lundi=0..6][heure 0..23] ; null si indisponible */
  onlineHeatmap: number[][] | null;
  raw: AudienceDemographics;
}

export interface CampaignItem {
  id: string;
  brandId: string;
  name: string;
  description: string | null;
  range: DateRange;
  hashtags: string[];
  color: string | null;
  status: "upcoming" | "running" | "finished";
}

export interface ConnectedAccountItem extends AccountSummary {
  brand: Pick<BrandSummary, "id" | "name" | "color" | "avatarUrl">;
  lastRun: Pick<SyncRunRow, "status" | "started_at" | "finished_at" | "details" | "error"> | null;
}

export interface ClientAccessItem {
  userId: string;
  email: string;
  fullName: string | null;
  locale: AppLocale;
  lastSeenAt: ISOTimestamp | null;
  brandId: string;
  brandName: string;
  sections: BrandSection[];
}

// =============================================================================
// Session
// =============================================================================

/** Utilisateur connecté (null si non connecté). Mémoïsé par requête. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const ds = await getDataSource();
  return ds.getSessionUser();
});

/** Date du jour dans le fuseau de l'agence. */
export { todayISO };

// =============================================================================
// Marques et comptes
// =============================================================================

function toAccountSummary(a: Awaited<ReturnType<Awaited<ReturnType<typeof getDataSource>>["listAccounts"]>>[number]): AccountSummary {
  return {
    id: a.id,
    brandId: a.brand_id,
    network: a.network,
    externalId: a.external_id,
    handle: a.handle,
    name: a.name,
    avatarUrl: a.avatar_url,
    followersCount: a.followers_count,
    status: a.status,
    statusMessage: a.status_message,
    lastSyncedAt: a.last_synced_at,
    tokenExpiresAt: a.token_expires_at,
  };
}

const NETWORK_ORDER: Network[] = ["ig", "fb", "tt", "li", "yt"];

/** Marques visibles par l'utilisateur, avec leurs comptes. Mémoïsé par requête. */
export const listBrands = cache(async (): Promise<BrandSummary[]> => {
  const ds = await getDataSource();
  const [user, brands, accounts] = await Promise.all([ds.getSessionUser(), ds.listBrands(), ds.listAccounts()]);
  return brands.map((b) => {
    const accs = accounts
      .filter((a) => a.brand_id === b.id)
      .sort((x, y) => NETWORK_ORDER.indexOf(x.network) - NETWORK_ORDER.indexOf(y.network))
      .map(toAccountSummary);
    const sections = user?.isAgency
      ? [...BRAND_SECTIONS]
      : user?.clientAccess.find((c) => c.brandId === b.id)?.sections ?? [];
    return {
      id: b.id,
      name: b.name,
      slug: b.slug,
      sector: b.sector,
      color: b.color,
      avatarUrl: b.avatar_url ?? accs.find((a) => a.avatarUrl)?.avatarUrl ?? null,
      accounts: accs,
      networks: [...new Set(accs.map((a) => a.network))],
      sections,
    };
  });
});

/** Une marque (null si inexistante OU non autorisée — ne pas distinguer les deux). */
export async function getBrand(brandId: string): Promise<BrandSummary | null> {
  return (await listBrands()).find((b) => b.id === brandId) ?? null;
}

// =============================================================================
// Métriques
// =============================================================================

async function loadRows(accounts: AccountSummary[], range: DateRange): Promise<DailyMetrics[]> {
  const ds = await getDataSource();
  const net = new Map(accounts.map((a) => [a.id, a.network]));
  // un jour avant le début pour connaître les abonnés de départ
  const rows = await ds.listDailyMetrics([...net.keys()], { from: addDays(range.from, -1), to: range.to });
  return rows.map((r) => normalizeDailyRow(r, net.get(r.account_id)!));
}

function compare(rows: DailyMetrics[], f: Pick<Filters, "range" | "previous">): PeriodComparison {
  return { totals: computeTotals(rows, f.range), previous: f.previous ? computeTotals(rows, f.previous) : null };
}

function rowsOf(rows: DailyMetrics[], accountIds: string[]): DailyMetrics[] {
  const s = new Set(accountIds);
  return rows.filter((r) => s.has(r.accountId));
}

function trend(rows: DailyMetrics[], range: DateRange): number[] {
  const from = addDays(range.to, -29) > range.from ? addDays(range.to, -29) : range.from;
  return buildDailySeries(rows, { from, to: range.to }).map((p) => p.reach ?? 0);
}

/**
 * Vue d'ensemble multi-marques (agence) : KPI agrégés, tableau marques × comptes,
 * tendances et points d'attention.
 */
export async function getOverview(filters: Pick<Filters, "range" | "previous" | "networks">): Promise<OverviewData> {
  const ds = await getDataSource();
  const brands = await listBrands();
  const accounts = brands.flatMap((b) => b.accounts).filter((a) => filters.networks.includes(a.network));
  const span = spanWithPrevious(filters.range, filters.previous);
  const [rows, lastPosts] = await Promise.all([
    loadRows(accounts, span),
    ds.lastPostDates(accounts.map((a) => a.id), filters.range.to),
  ]);

  const alerts: Alert[] = [];
  const brandRows: OverviewBrandRow[] = brands
    .map((brand): OverviewBrandRow | null => {
      const accs = brand.accounts.filter((a) => filters.networks.includes(a.network));
      if (!accs.length) return null;
      const bRows = rowsOf(rows, accs.map((a) => a.id));
      const accountRows = accs.map((account): OverviewAccountRow => {
        const aRows = rowsOf(bRows, [account.id]);
        const cmp = compare(aRows, filters);
        const lastPostDate = lastPosts[account.id] ?? null;
        alerts.push(
          ...detectAlerts({
            brandId: brand.id, accountId: account.id, network: account.network,
            current: cmp.totals, previous: cmp.previous, lastPostDate, rangeEnd: filters.range.to,
          }),
        );
        return { account, ...cmp, reachTrend: trend(aRows, filters.range), lastPostDate };
      });
      return { brand, ...compare(bRows, filters), reachTrend: trend(bRows, filters.range), accounts: accountRows };
    })
    .filter((x): x is OverviewBrandRow => x !== null);

  return {
    range: filters.range,
    previousRange: filters.previous,
    ...compare(rows, filters),
    series: buildDailySeries(rows, filters.range),
    brands: brandRows,
    alerts,
  };
}

/** Analytics d'une marque (null si la marque n'est pas accessible). */
export async function getBrandMetrics(
  brandId: string,
  filters: Pick<Filters, "range" | "previous" | "networks">,
): Promise<BrandMetricsData | null> {
  const brand = await getBrand(brandId);
  if (!brand) return null;
  const accounts = brand.accounts.filter((a) => filters.networks.includes(a.network));
  const rows = await loadRows(accounts, spanWithPrevious(filters.range, filters.previous));
  const networks = [...new Set(accounts.map((a) => a.network))];
  return {
    brand,
    range: filters.range,
    previousRange: filters.previous,
    accounts,
    ...compare(rows, filters),
    series: buildDailySeries(rows, filters.range),
    previousSeries: filters.previous ? buildDailySeries(rows, filters.previous) : null,
    byNetwork: networks.map((network) => {
      const accs = accounts.filter((a) => a.network === network);
      return { network, accounts: accs, ...compare(rowsOf(rows, accs.map((a) => a.id)), filters) };
    }),
    rows,
  };
}

// =============================================================================
// Publications
// =============================================================================

export async function getPosts(brandId: string, q: PostQuery): Promise<PostItem[]> {
  const brand = await getBrand(brandId);
  if (!brand) return [];
  const accounts = brand.accounts.filter((a) => !q.networks || q.networks.includes(a.network));
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const ds = await getDataSource();
  const raw = await ds.listPosts([...byId.keys()], q.range, { limit: q.limit ?? 500 });
  const items: PostItem[] = raw
    .filter((p) => (!q.formats || q.formats.includes(p.format)) && (!q.campaignId || p.campaign_id === q.campaignId))
    .map((p) => {
      const acc = byId.get(p.account_id)!;
      const m = p.metrics;
      const interactions = m?.interactions ?? (m?.likes ?? 0) + (m?.comments ?? 0) + (m?.shares ?? 0) + (m?.saves ?? 0);
      const reach = m?.reach != null ? Number(m.reach) : null;
      return {
        id: p.id,
        accountId: p.account_id,
        brandId: brand.id,
        network: p.network,
        externalId: p.external_id,
        publishedAt: p.published_at,
        format: p.format,
        caption: p.caption,
        permalink: p.permalink,
        thumbnailUrl: p.thumbnail_url,
        campaignId: p.campaign_id,
        account: { handle: acc.handle, name: acc.name, avatarUrl: acc.avatarUrl },
        metrics: {
          reach,
          views: m?.views != null ? Number(m.views) : null,
          interactions,
          likes: m?.likes ?? null,
          comments: m?.comments ?? null,
          shares: m?.shares ?? null,
          saves: m?.saves ?? null,
          videoViews: m?.video_views != null ? Number(m.video_views) : null,
          engagementRate: reach ? interactions / reach : acc.followersCount ? interactions / acc.followersCount : null,
          snapshotDay: m?.snapshot_day ?? null,
        },
      };
    });
  const dir = q.direction === "asc" ? 1 : -1;
  const sort = q.sort ?? "date";
  const val = (p: PostItem): number | string =>
    sort === "date" ? p.publishedAt : sort === "interactions" ? p.metrics.interactions : (p.metrics[sort] ?? -1);
  return items.sort((a, b) => (val(a) < val(b) ? -dir : val(a) > val(b) ? dir : 0));
}

// =============================================================================
// Audience
// =============================================================================

function shares(rows: { key: string; value: number }[] | undefined, n: number): AudienceShare[] {
  if (!rows?.length) return [];
  const total = rows.reduce((t, r) => t + r.value, 0) || 1;
  return [...rows]
    .sort((a, b) => b.value - a.value)
    .slice(0, n)
    .map((r) => ({ key: r.key, value: r.value, share: r.value / total }));
}

/** Démographie Instagram de la marque (Meta ne fournit pas celle des Pages FB). */
export async function getAudience(brandId: string): Promise<AudienceData | null> {
  const brand = await getBrand(brandId);
  const ig = brand?.accounts.find((a) => a.network === "ig");
  if (!brand || !ig) return null;
  const ds = await getDataSource();
  const [snap] = await ds.latestAudience([ig.id]);
  if (!snap) return null;
  const d = snap.demographics ?? {};
  const ag = d.age_gender ?? [];
  const total = ag.reduce((t, r) => t + r.value, 0) || 1;
  const ages = [...new Set(ag.map((r) => r.age))].sort();
  const sum = (age: string | null, g: "F" | "M" | "U") =>
    ag.filter((r) => (age == null || r.age === age) && r.gender === g).reduce((t, r) => t + r.value, 0) / total;

  let onlineHeatmap: number[][] | null = null;
  const online = snap.online_followers;
  if (online && Object.keys(online).length) {
    const vals = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    const cnt = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
    for (const [date, hours] of Object.entries(online)) {
      const row = (new Date(`${date}T00:00:00Z`).getUTCDay() + 6) % 7;
      for (const [h, v] of Object.entries(hours ?? {})) {
        vals[row][Number(h)] += v;
        cnt[row][Number(h)]++;
      }
    }
    const avg = vals.map((r, i) => r.map((v, h) => (cnt[i][h] ? v / cnt[i][h] : 0)));
    const max = Math.max(...avg.flat()) || 1;
    onlineHeatmap = avg.map((r) => r.map((v) => v / max));
  }

  return {
    account: ig,
    date: snap.date,
    ageGender: ages.map((age) => ({ age, female: sum(age, "F"), male: sum(age, "M"), unknown: sum(age, "U") })),
    genderShares: { female: sum(null, "F"), male: sum(null, "M"), unknown: sum(null, "U") },
    cities: shares(d.cities, 8),
    countries: shares(d.countries, 6),
    onlineHeatmap,
    raw: d,
  };
}

// =============================================================================
// Campagnes, comptes connectés, accès clients, journal
// =============================================================================

function toCampaign(c: CampaignRow, today: ISODate): CampaignItem {
  return {
    id: c.id,
    brandId: c.brand_id,
    name: c.name,
    description: c.description,
    range: { from: c.starts_on, to: c.ends_on },
    hashtags: c.hashtags,
    color: c.color,
    status: today < c.starts_on ? "upcoming" : today > c.ends_on ? "finished" : "running",
  };
}

/** Campagnes (d'une marque, ou de toutes les marques visibles), plus récentes d'abord. */
export async function getCampaigns(brandId?: string): Promise<CampaignItem[]> {
  const ds = await getDataSource();
  const today = todayISO();
  return (await ds.listCampaigns(brandId ? [brandId] : undefined)).map((c) => toCampaign(c, today));
}

/** Comptes connectés + dernier passage de collecte (page Réglages › Comptes, agence). */
export async function getConnectedAccounts(): Promise<ConnectedAccountItem[]> {
  const ds = await getDataSource();
  const brands = await listBrands();
  const runs = await ds.listSyncRuns({ limit: 500 });
  return brands.flatMap((b) =>
    b.accounts.map((a) => {
      const run = runs.find((r) => r.account_id === a.id);
      return {
        ...a,
        brand: { id: b.id, name: b.name, color: b.color, avatarUrl: b.avatarUrl },
        lastRun: run ? { status: run.status, started_at: run.started_at, finished_at: run.finished_at, details: run.details, error: run.error } : null,
      };
    }),
  );
}

/** Utilisateurs clients et leurs accès (page Réglages › Clients, agence). */
export async function getClientAccess(): Promise<ClientAccessItem[]> {
  const ds = await getDataSource();
  const brands = await listBrands();
  const names = new Map(brands.map((b) => [b.id, b.name]));
  return (await ds.listBrandAccess()).map((r) => ({
    userId: r.user_id,
    email: r.profile.email,
    fullName: r.profile.full_name,
    locale: r.profile.locale,
    lastSeenAt: r.profile.last_seen_at,
    brandId: r.brand_id,
    brandName: names.get(r.brand_id) ?? "—",
    sections: r.visible_sections,
  }));
}

/** Journal de collecte (équivalent serveur du « Diagnostic API »), agence uniquement. */
export async function getSyncRuns(opts: { accountIds?: string[]; limit?: number } = {}): Promise<SyncRunRow[]> {
  const ds = await getDataSource();
  return ds.listSyncRuns({ accountIds: opts.accountIds, limit: opts.limit ?? 100 });
}

export async function getReportSchedules(brandId?: string): Promise<ReportScheduleRow[]> {
  const ds = await getDataSource();
  return ds.listReportSchedules(brandId ? [brandId] : undefined);
}

export async function getAccessLogs(limit = 50) {
  const ds = await getDataSource();
  return ds.listAccessLogs({ limit });
}
