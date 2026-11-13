import { getLocale, getTranslations } from "next-intl/server";
import { KpiTile } from "@/components/ui";
import type { AppLocale } from "@/lib/db/types";
import {
  computeDelta,
  computeRateDelta,
  formatCompact,
  formatNumber,
  formatPercent,
  formatPoints,
  formatSignedNumber,
  formatSignedPercent,
  getKpiDefinition,
  type KpiKey,
  type MetricTotals,
  type SeriesPoint,
} from "@/lib/metrics";

/**
 * Grille de tuiles KPI (point de départ — propriété : front).
 * Abonnés : évolution sur la période ; autres : variation vs période précédente.
 */
export async function KpiGrid({ totals, previous, series, keys, color = "#6366F1" }: { totals: MetricTotals; previous: MetricTotals | null; series?: SeriesPoint[]; keys: KpiKey[]; color?: string }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const fmt = (v: number, f: "number" | "compact" | "percent") => (f === "percent" ? formatPercent(v, locale, 2) : f === "compact" ? formatCompact(v, locale) : formatNumber(v, locale));

  return (
    <div className="grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-4">
      {keys.map((key) => {
        const def = getKpiDefinition(key);
        const value = totals[key];
        const unavailable = key in totals.available && !totals.available[key as keyof MetricTotals["available"]];
        let delta = null;
        if (key === "followers") {
          delta = {
            trend: totals.followersNet > 0 ? ("up" as const) : totals.followersNet < 0 ? ("down" as const) : ("flat" as const),
            label: formatSignedNumber(totals.followersNet, locale),
            caption: `${t("kpi.overPeriod")} (${formatSignedPercent(totals.followersGrowth, locale, 2)})`,
          };
        } else if (previous) {
          const d = def.delta === "points" ? computeRateDelta(value, previous[key]) : computeDelta(value, previous[key]);
          delta = {
            trend: d.trend,
            label: def.delta === "points" ? formatPoints(d.diff ?? 0, locale) : d.ratio != null ? formatSignedPercent(d.ratio, locale) : "—",
            higherIsBetter: def.higherIsBetter,
            caption: t("common.vsPrevious", { value: fmt(previous[key], def.format) }),
          };
        }
        const spark = def.sparkline && series ? series.map((p) => p[def.sparkline!] ?? 0) : undefined;
        return (
          <KpiTile
            key={key}
            label={t(`${def.i18nKey}.label`)}
            help={t(`${def.i18nKey}.help`)}
            value={unavailable ? "—" : fmt(value, def.format)}
            unavailable={unavailable}
            delta={unavailable ? null : delta}
            sparkline={spark}
            sparklineColor={color}
          />
        );
      })}
    </div>
  );
}
