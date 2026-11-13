import type { Delta, Trend } from "./types";

/** Seuil sous lequel une variation est considérée stable (0,5 %). */
const FLAT_RATIO = 0.005;
/** Seuil en points pour les taux (0,05 pt). */
const FLAT_POINTS = 0.0005;

/** Variation relative d'une métrique entre deux périodes (▲ ▼ ■). */
export function computeDelta(current: number, previous: number | null | undefined): Delta {
  if (previous == null || !Number.isFinite(previous)) {
    return { current, previous: null, diff: null, ratio: null, trend: "flat" };
  }
  const diff = current - previous;
  const ratio = previous === 0 ? null : diff / Math.abs(previous);
  const trend: Trend = ratio == null ? (diff > 0 ? "up" : diff < 0 ? "down" : "flat") : Math.abs(ratio) < FLAT_RATIO ? "flat" : ratio > 0 ? "up" : "down";
  return { current, previous, diff, ratio, trend };
}

/** Variation d'un taux (ex. taux d'engagement) exprimée en points : diff = 0.004 → +0,4 pt. */
export function computeRateDelta(current: number, previous: number | null | undefined): Delta {
  if (previous == null || !Number.isFinite(previous)) {
    return { current, previous: null, diff: null, ratio: null, trend: "flat" };
  }
  const diff = current - previous;
  return {
    current,
    previous,
    diff,
    ratio: previous ? diff / previous : null,
    trend: Math.abs(diff) < FLAT_POINTS ? "flat" : diff > 0 ? "up" : "down",
  };
}

/** Pour les métriques où une hausse est mauvaise (ex. désabonnements). */
export function isPositiveTrend(trend: Trend, higherIsBetter = true): boolean | null {
  if (trend === "flat") return null;
  return (trend === "up") === higherIsBetter;
}
