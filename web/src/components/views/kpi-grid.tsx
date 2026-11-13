import { getLocale, getTranslations } from "next-intl/server";
import { KpiTile } from "@/components/ui";
import type { AppLocale } from "@/lib/db/types";
import { cn } from "@/lib/utils";
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
 * Grille de tuiles KPI (propriété : front).
 * Abonnés : évolution sur la période ; autres : variation vs période précédente.
 */
export async function KpiGrid({
  totals,
  previous,
  series,
  keys,
  color = "var(--color-orbit-500)",
  columns = 4,
  locale: forcedLocale,
}: {
  totals: MetricTotals;
  previous: MetricTotals | null;
  series?: SeriesPoint[];
  keys: KpiKey[];
  color?: string;
  /** colonnes sur grand écran */
  columns?: 4 | 5;
  /** langue imposée (aperçu de rapport) */
  locale?: AppLocale;
}) {
  const locale = forcedLocale ?? ((await getLocale()) as AppLocale);
  const t = await getTranslations({ locale });
  const fmt = (v: number, f: "number" | "compact" | "percent") => (f === "percent" ? formatPercent(v, locale, 2) : f === "compact" ? formatCompact(v, locale) : formatNumber(v, locale));

  return (
    <div className="@container">
    <div className={cn("grid grid-cols-2 gap-3 @xl:grid-cols-3 @xl:gap-4 @3xl:grid-cols-4", columns === 5 && "@5xl:grid-cols-5")}>
      {keys.map((key, i) => {
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
          <div key={key} className="flex transition duration-500 starting:translate-y-1.5 starting:opacity-0 [&>*]:flex-1" style={{ transitionDelay: `${i * 35}ms` }}>
          <KpiTile
            label={t(`${def.i18nKey}.label`)}
            help={t(`${def.i18nKey}.help`)}
            value={unavailable ? "—" : fmt(value, def.format)}
            unavailable={unavailable}
            delta={unavailable ? null : delta}
            sparkline={spark}
            sparklineColor={color}
          />
          </div>
        );
      })}
    </div>
    </div>
  );
}
