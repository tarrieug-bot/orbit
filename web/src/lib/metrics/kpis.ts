import type { MetricKey, MetricTotals } from "./types";

export type KpiKey = MetricKey | "engagementRate" | "followersNet";
export type KpiFormat = "number" | "compact" | "percent";
/** relative = ▲ x % ; points = ▲ x pt (taux) ; none = pas de comparaison */
export type KpiDeltaMode = "relative" | "points" | "none";

export interface KpiDefinition {
  key: KpiKey;
  /** clé next-intl : `kpi.<key>.label` et `kpi.<key>.help` */
  i18nKey: string;
  format: KpiFormat;
  delta: KpiDeltaMode;
  /** false pour les métriques où une hausse est mauvaise */
  higherIsBetter: boolean;
  /** métrique de série pour la sparkline */
  sparkline?: MetricKey;
}

/** Tuiles KPI, dans l'ordre de la version d'essai. */
export const KPI_DEFINITIONS: readonly KpiDefinition[] = [
  { key: "followers", i18nKey: "kpi.followers", format: "number", delta: "relative", higherIsBetter: true, sparkline: "followers" },
  { key: "followersGained", i18nKey: "kpi.followersGained", format: "number", delta: "relative", higherIsBetter: true, sparkline: "followersGained" },
  { key: "followersLost", i18nKey: "kpi.followersLost", format: "number", delta: "relative", higherIsBetter: false, sparkline: "followersLost" },
  { key: "reach", i18nKey: "kpi.reach", format: "compact", delta: "relative", higherIsBetter: true, sparkline: "reach" },
  { key: "views", i18nKey: "kpi.views", format: "compact", delta: "relative", higherIsBetter: true, sparkline: "views" },
  { key: "interactions", i18nKey: "kpi.interactions", format: "compact", delta: "relative", higherIsBetter: true, sparkline: "interactions" },
  { key: "engagementRate", i18nKey: "kpi.engagementRate", format: "percent", delta: "points", higherIsBetter: true },
  { key: "posts", i18nKey: "kpi.posts", format: "number", delta: "relative", higherIsBetter: true, sparkline: "posts" },
  { key: "profileVisits", i18nKey: "kpi.profileVisits", format: "compact", delta: "relative", higherIsBetter: true, sparkline: "profileVisits" },
  { key: "linkClicks", i18nKey: "kpi.linkClicks", format: "number", delta: "relative", higherIsBetter: true, sparkline: "linkClicks" },
] as const;

export function kpiValue(t: MetricTotals, key: KpiKey): number {
  return t[key];
}

export function getKpiDefinition(key: KpiKey): KpiDefinition {
  const def = KPI_DEFINITIONS.find((d) => d.key === key);
  if (!def) throw new Error(`KPI inconnu : ${key}`);
  return def;
}
