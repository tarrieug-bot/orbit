import type { AccountDailyMetricsRow, Network } from "@/lib/db/types";
import { eachDay, inRange, rangeLength } from "./dates";
import { SUMMABLE_KEYS, type DailyMetrics, type DateRange, type MetricKey, type MetricTotals, type SeriesPoint, type SummableKey } from "./types";

/** Convertit une ligne SQL en DailyMetrics (interactions complétées si absentes). */
export function normalizeDailyRow(row: AccountDailyMetricsRow, network: Network): DailyMetrics {
  const parts = [row.likes, row.comments, row.shares, row.saves];
  const interactions =
    row.interactions ?? (parts.some((v) => v != null) ? parts.reduce<number>((t, v) => t + (v ?? 0), 0) : null);
  return {
    accountId: row.account_id,
    network,
    date: row.date,
    followers: row.followers,
    followersGained: row.followers_gained,
    followersLost: row.followers_lost,
    reach: num(row.reach),
    views: num(row.views),
    interactions,
    likes: row.likes,
    comments: row.comments,
    shares: row.shares,
    saves: row.saves,
    profileVisits: row.profile_visits,
    linkClicks: row.link_clicks,
    posts: row.posts_count,
    videoViews: num(row.video_views),
  };
}

// bigint renvoyé en string par certains drivers
function num(v: number | string | null): number | null {
  return v == null ? null : Number(v);
}

const emptyAvailability = (): Record<MetricKey, boolean> =>
  Object.fromEntries((["followers", ...SUMMABLE_KEYS] as MetricKey[]).map((k) => [k, false])) as Record<MetricKey, boolean>;

/**
 * Totaux d'une période. `rows` peut couvrir plus large que `range` (idéalement depuis
 * la veille du début) : les lignes antérieures servent à trouver les abonnés de départ.
 */
export function computeTotals(rows: DailyMetrics[], range: DateRange): MetricTotals {
  const sums = Object.fromEntries(SUMMABLE_KEYS.map((k) => [k, 0])) as Record<SummableKey, number>;
  const available = emptyAvailability();
  const byAccount = new Map<string, DailyMetrics[]>();

  for (const r of rows) {
    if (r.date > range.to) continue;
    const list = byAccount.get(r.accountId) ?? [];
    list.push(r);
    byAccount.set(r.accountId, list);
    if (!inRange(r.date, range)) continue;
    for (const k of SUMMABLE_KEYS) {
      const v = r[k];
      if (v != null) {
        sums[k] += v;
        available[k] = true;
      }
    }
  }

  let followers = 0;
  let followersStart = 0;
  for (const list of byAccount.values()) {
    list.sort((a, b) => (a.date < b.date ? -1 : 1));
    let end: number | null = null;
    let start: number | null = null;
    let netInRange = 0;
    for (const r of list) {
      if (r.followers != null) {
        if (r.date < range.from) start = r.followers;
        else {
          end = r.followers;
          available.followers = true;
        }
      }
      if (inRange(r.date, range)) netInRange += (r.followersGained ?? 0) - (r.followersLost ?? 0);
    }
    if (end == null) end = start ?? 0;
    // pas d'historique avant la période : on reconstitue depuis les gains/pertes (comme la version d'essai)
    if (start == null) start = Math.max(0, end - netInRange);
    followers += end;
    followersStart += start;
  }

  const followersNet = followers - followersStart;
  return {
    ...sums,
    followers,
    followersStart,
    followersNet,
    followersGrowth: followersStart ? followersNet / followersStart : 0,
    engagementRate: sums.reach ? sums.interactions / sums.reach : 0,
    engagementRateFollowers: followers ? sums.interactions / followers : 0,
    interactionsPerPost: sums.posts ? sums.interactions / sums.posts : 0,
    days: rangeLength(range),
    available,
  };
}

/**
 * Série quotidienne (somme des comptes) sur la période, un point par jour même sans donnée.
 * followers : dernière valeur connue de chaque compte (report à nouveau).
 */
export function buildDailySeries(rows: DailyMetrics[], range: DateRange): SeriesPoint[] {
  const days = eachDay(range);
  const index = new Map<string, DailyMetrics>();
  const accounts = new Set<string>();
  for (const r of rows) {
    index.set(`${r.accountId}|${r.date}`, r);
    accounts.add(r.accountId);
  }
  // abonnés connus avant la période
  const lastFollowers = new Map<string, number>();
  for (const r of [...rows].sort((a, b) => (a.date < b.date ? -1 : 1))) {
    if (r.date < range.from && r.followers != null) lastFollowers.set(r.accountId, r.followers);
  }

  return days.map((date) => {
    const point = { date, followers: null } as SeriesPoint;
    for (const k of SUMMABLE_KEYS) point[k] = null;
    let fTotal: number | null = null;
    for (const acc of accounts) {
      const r = index.get(`${acc}|${date}`);
      if (r?.followers != null) lastFollowers.set(acc, r.followers);
      const f = lastFollowers.get(acc);
      if (f != null) fTotal = (fTotal ?? 0) + f;
      if (!r) continue;
      for (const k of SUMMABLE_KEYS) {
        const v = r[k];
        if (v != null) point[k] = (point[k] ?? 0) + v;
      }
    }
    point.followers = fTotal;
    return point;
  });
}

/** Filtre les lignes par comptes (ex. réseaux sélectionnés). */
export function filterRows(rows: DailyMetrics[], accountIds: Iterable<string>): DailyMetrics[] {
  const set = new Set(accountIds);
  return rows.filter((r) => set.has(r.accountId));
}
