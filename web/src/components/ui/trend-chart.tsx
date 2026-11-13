"use client";

import { useId } from "react";
import { Area, AreaChart, Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AppLocale } from "@/lib/db/types";
import { formatBucketLabel, formatCompact, formatNumber, formatPercent, type Granularity } from "@/lib/metrics";
import { activeDot, axisProps, barProps, chartMargin, cursorBar, cursorLine, gridProps, xAxisProps } from "./charts/theme";
import { ChartTooltipContent } from "./charts/chart-tooltip";
import { ChartLegend } from "./charts/chart-legend";

export interface TrendSeries {
  key: string;
  label: string;
  /** hex ou var(--color-chart-n) */
  color: string;
  /** trait pointillé, sans remplissage (période précédente) */
  dashed?: boolean;
}

export interface TrendChartProps {
  /** lignes { key: "YYYY-MM-DD", <série>: number|null } — cf. toChartData() */
  data: Record<string, string | number | null>[];
  series: TrendSeries[];
  type?: "area" | "bar" | "line";
  granularity?: Granularity;
  format?: "number" | "compact" | "percent";
  locale?: AppLocale;
  height?: number;
  stacked?: boolean;
  /** "auto" : l'axe Y suit les données (ex. abonnés) ; "zero" : part de 0 (défaut) */
  yDomain?: "zero" | "auto";
  /** légende HTML au-dessus du graphique (défaut : si plusieurs séries) */
  legend?: boolean;
  /** libellé de la ligne « Total » de l'infobulle (séries empilées) */
  totalLabel?: string;
}

/** Graphique de tendance générique (Recharts) au thème Orbit (clair / sombre). */
export function TrendChart({ data, series, type = "area", granularity = "day", format = "compact", locale = "fr", height = 260, stacked, yDomain = "zero", legend, totalLabel }: TrendChartProps) {
  const uid = useId().replace(/:/g, "");
  const fmt = (v: number) => (format === "percent" ? formatPercent(v, locale) : format === "number" ? formatNumber(v, locale) : formatCompact(v, locale));
  const showLegend = legend ?? series.length > 1;
  const label = (key: string) => series.find((s) => s.key === key)?.label ?? key;

  const common = (
    <>
      <CartesianGrid {...gridProps} />
      <XAxis dataKey="key" {...xAxisProps} tickFormatter={(v: string) => formatBucketLabel(v, granularity, locale)} minTickGap={28} />
      <YAxis {...axisProps} width={44} tickFormatter={(v: number) => fmt(v)} domain={yDomain === "auto" ? ["auto", "auto"] : [0, "auto"]} />
      <Tooltip
        cursor={type === "bar" ? cursorBar : cursorLine}
        content={(p) => (
          <ChartTooltipContent
            active={p.active}
            payload={p.payload}
            label={p.label}
            labelFormatter={(v) => formatBucketLabel(v, granularity, locale)}
            valueFormatter={(v) => fmt(v)}
            nameFormatter={label}
            total={stacked && totalLabel ? { label: totalLabel, format: fmt } : undefined}
          />
        )}
      />
    </>
  );

  return (
    <div>
      {showLegend && <ChartLegend className="mb-3 px-1" items={series.map((s) => ({ key: s.key, label: s.label, color: s.color, dashed: s.dashed }))} />}
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: 600, height }}>
          {type === "bar" ? (
            <BarChart data={data} margin={chartMargin} barGap={2}>
              {common}
              {series.map((s, i) => (
                <Bar
                  key={s.key}
                  dataKey={s.key}
                  fill={s.color}
                  {...barProps}
                  radius={stacked && i < series.length - 1 ? [0, 0, 0, 0] : barProps.radius}
                  stackId={stacked ? "s" : undefined}
                  stroke={stacked ? "var(--color-surface)" : undefined}
                  strokeWidth={stacked ? 1 : 0}
                  fillOpacity={s.dashed ? 0.35 : 1}
                />
              ))}
            </BarChart>
          ) : type === "line" ? (
            <LineChart data={data} margin={chartMargin}>
              {common}
              {series.map((s) => (
                <Line key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} strokeDasharray={s.dashed ? "4 4" : undefined} dot={false} activeDot={{ ...activeDot, fill: s.color }} connectNulls />
              ))}
            </LineChart>
          ) : (
            <AreaChart data={data} margin={chartMargin}>
              <defs>
                {series.map((s) => (
                  <linearGradient key={s.key} id={`trend-${uid}-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" style={{ stopColor: s.color, stopOpacity: stacked ? 0.5 : 0.2 }} />
                    <stop offset="100%" style={{ stopColor: s.color, stopOpacity: stacked ? 0.15 : 0 }} />
                  </linearGradient>
                ))}
              </defs>
              {common}
              {series.map((s) => (
                <Area
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={s.color}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? "4 4" : undefined}
                  fill={s.dashed ? "none" : `url(#trend-${uid}-${s.key})`}
                  dot={false}
                  activeDot={{ ...activeDot, fill: s.color }}
                  connectNulls
                  stackId={stacked ? "s" : undefined}
                />
              ))}
            </AreaChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
}
