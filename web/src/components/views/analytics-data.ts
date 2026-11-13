import type { AccountSummary, PostItem } from "@/lib/db";
import type { Network, PostFormat } from "@/lib/db/types";
import { bucketSeries, buildDailySeries, computeTotals, filterRows, type Bucket, type DailyMetrics, type DateRange, type MetricKey } from "@/lib/metrics";

/**
 * Préparation des données de graphiques (pur, sans I/O) à partir des sorties de
 * @/lib/db — tous les calculs de KPI passent par @/lib/metrics.
 */

export type ChartRow = Record<string, string | number | null>;

/** Une colonne par compte : `${metric}:${accountId}`. */
export function perAccountChart(rows: DailyMetrics[], accounts: AccountSummary[], range: DateRange, buckets: Bucket[], metrics: MetricKey[]): ChartRow[] {
  const cols = accounts.flatMap((a) => {
    const series = buildDailySeries(filterRows(rows, [a.id]), range);
    return metrics.map((m) => [`${m}:${a.id}`, bucketSeries(series, buckets, m)] as const);
  });
  return buckets.map((b, i) => {
    const row: ChartRow = { key: b.key };
    for (const [k, v] of cols) row[k] = v[i];
    return row;
  });
}

/** Taux d'engagement par regroupement et par compte (computeTotals sur chaque bucket). */
export function engagementChart(rows: DailyMetrics[], accounts: AccountSummary[], buckets: Bucket[]): ChartRow[] {
  return buckets.map((b) => {
    const row: ChartRow = { key: b.key };
    for (const a of accounts) {
      const tot = computeTotals(filterRows(rows, [a.id]), b);
      row[`er:${a.id}`] = tot.available.reach && tot.reach ? tot.engagementRate : null;
    }
    return row;
  });
}

/** Jour (lundi = 0) et heure locale (Martinique) d'un horodatage. */
export function localSlot(iso: string): { day: number; hour: number } {
  const parts = new Intl.DateTimeFormat("en-GB", { timeZone: "America/Martinique", weekday: "short", hour: "2-digit", hourCycle: "h23" }).formatToParts(new Date(iso));
  const wd = parts.find((p) => p.type === "weekday")?.value ?? "Mon";
  const hour = Number(parts.find((p) => p.type === "hour")?.value ?? 0);
  return { day: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].indexOf(wd), hour };
}

/**
 * Repli quand Meta ne fournit pas les abonnés en ligne : interactions moyennes des
 * publications par créneau jour × heure, lissées sur ±1 h puis normalisées (0–1).
 */
export function postsHeatmap(posts: PostItem[]): number[][] | null {
  if (posts.length < 5) return null;
  const sum = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  const cnt = Array.from({ length: 7 }, () => Array<number>(24).fill(0));
  for (const p of posts) {
    const { day, hour } = localSlot(p.publishedAt);
    if (day < 0) continue;
    for (const dh of [-1, 0, 1]) {
      const h = (hour + dh + 24) % 24;
      const w = dh === 0 ? 1 : 0.5;
      sum[day][h] += p.metrics.interactions * w;
      cnt[day][h] += w;
    }
  }
  const avg = sum.map((r, d) => r.map((v, h) => (cnt[d][h] ? v / cnt[d][h] : 0)));
  const max = Math.max(...avg.flat());
  return max > 0 ? avg.map((r) => r.map((v) => v / max)) : null;
}

export interface FormatPerf {
  network: Network;
  format: PostFormat;
  count: number;
  avgReach: number;
  avgInteractions: number;
  /** Σ interactions ÷ Σ portée */
  engagementRate: number;
}

/** Performance moyenne par format et par réseau, triée par taux d'engagement. */
export function formatPerformance(posts: PostItem[]): FormatPerf[] {
  const groups = new Map<string, { network: Network; format: PostFormat; n: number; reach: number; inter: number; reachN: number }>();
  for (const p of posts) {
    const k = `${p.network}|${p.format}`;
    const g = groups.get(k) ?? { network: p.network, format: p.format, n: 0, reach: 0, inter: 0, reachN: 0 };
    g.n++;
    g.inter += p.metrics.interactions;
    if (p.metrics.reach != null) {
      g.reach += p.metrics.reach;
      g.reachN++;
    }
    groups.set(k, g);
  }
  return [...groups.values()]
    .map((g) => ({
      network: g.network,
      format: g.format,
      count: g.n,
      avgReach: g.reachN ? g.reach / g.reachN : 0,
      avgInteractions: g.inter / g.n,
      engagementRate: g.reach ? g.inter / g.reach : 0,
    }))
    .sort((a, b) => b.engagementRate - a.engagementRate);
}

/** Top N par taux d'engagement (publications avec portée connue). */
export function topPosts(posts: PostItem[], n = 5): PostItem[] {
  return [...posts].filter((p) => p.metrics.engagementRate != null).sort((a, b) => (b.metrics.engagementRate ?? 0) - (a.metrics.engagementRate ?? 0)).slice(0, n);
}
