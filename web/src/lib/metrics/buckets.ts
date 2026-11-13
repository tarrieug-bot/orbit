import type { ISODate } from "@/lib/db/types";
import { addDays, endOfMonth, rangeLength } from "./dates";
import type { DateRange, MetricKey, SeriesPoint } from "./types";

export type Granularity = "day" | "week" | "month";

export interface Bucket extends DateRange {
  /** premier jour du regroupement (sert de libellé, à formater avec formatBucketLabel) */
  key: ISODate;
}

/**
 * Regroupement automatique (version d'essai) : ≤ 62 j → jour, ≤ 210 j → semaine
 * (blocs de 7 jours depuis le début), au-delà → mois calendaire.
 */
export function autoGranularity(r: DateRange): Granularity {
  const len = rangeLength(r);
  if (len <= 62) return "day";
  if (len <= 210) return "week";
  return "month";
}

export function makeBuckets(r: DateRange, granularity: Granularity = autoGranularity(r)): Bucket[] {
  const out: Bucket[] = [];
  if (granularity === "day") {
    for (let d = r.from; d <= r.to; d = addDays(d, 1)) out.push({ key: d, from: d, to: d });
  } else if (granularity === "week") {
    for (let d = r.from; d <= r.to; d = addDays(d, 7)) {
      const end = addDays(d, 6);
      out.push({ key: d, from: d, to: end < r.to ? end : r.to });
    }
  } else {
    let d = r.from;
    while (d <= r.to) {
      const end = endOfMonth(d);
      out.push({ key: d, from: d, to: end < r.to ? end : r.to });
      d = addDays(end, 1);
    }
  }
  return out;
}

/**
 * Agrège une série quotidienne par regroupement : somme pour les flux,
 * valeur de fin de regroupement pour les abonnés.
 */
export function bucketSeries(series: SeriesPoint[], buckets: Bucket[], key: MetricKey): (number | null)[] {
  return buckets.map((b) => {
    const pts = series.filter((p) => p.date >= b.from && p.date <= b.to);
    if (key === "followers") {
      for (let i = pts.length - 1; i >= 0; i--) if (pts[i].followers != null) return pts[i].followers;
      return null;
    }
    let total: number | null = null;
    for (const p of pts) if (p[key] != null) total = (total ?? 0) + (p[key] as number);
    return total;
  });
}

/** Données prêtes pour Recharts : [{ key, from, to, reach: 123, views: 456 }, …] */
export function toChartData(series: SeriesPoint[], buckets: Bucket[], keys: MetricKey[]) {
  const cols = keys.map((k) => [k, bucketSeries(series, buckets, k)] as const);
  return buckets.map((b, i) => {
    const row: Record<string, number | string | null> = { key: b.key, from: b.from, to: b.to };
    for (const [k, vals] of cols) row[k] = vals[i];
    return row;
  });
}
