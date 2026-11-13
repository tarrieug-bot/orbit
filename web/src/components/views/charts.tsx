"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { activeDot, axisProps, barProps, chartMargin, ChartTooltipContent, cursorBar, cursorLine, gridProps, xAxisProps } from "@/components/ui";
import type { AppLocale } from "@/lib/db/types";
import { formatBucketLabel, formatCompact, formatNumber, formatPercent, type Granularity } from "@/lib/metrics";

export type ValueFormat = "number" | "compact" | "percent" | "absNumber";

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  /** séries empilées partageant le même identifiant */
  stackId?: string;
}

export interface MetricChartProps {
  /** lignes { key, <série>: number|null } */
  data: Record<string, string | number | null>[];
  series: ChartSeries[];
  type?: "line" | "bar";
  /** bucket : key = date ISO formatée selon la granularité ; category : libellé tel quel */
  xKind?: "bucket" | "category";
  granularity?: Granularity;
  format?: ValueFormat;
  locale?: AppLocale;
  height?: number;
  /** barres horizontales (catégories en ordonnée) */
  horizontal?: boolean;
  yDomain?: "zero" | "auto";
  /** ligne de zéro marquée (barres gagnés / perdus) */
  zeroLine?: boolean;
  /** légende masquée (série unique) */
  hideLegend?: boolean;
}


export function makeFormatter(format: ValueFormat, locale: AppLocale, digits = 2) {
  return (v: number) =>
    format === "percent"
      ? formatPercent(v, locale, digits)
      : format === "number"
        ? formatNumber(v, locale)
        : format === "absNumber"
          ? formatNumber(Math.abs(v), locale)
          : formatCompact(v, locale);
}

/**
 * Graphique Recharts générique aux couleurs Orbit (lignes ou barres, verticales ou
 * horizontales, groupées ou empilées). Ne reçoit que des données sérialisables.
 */
export function MetricChart({
  data,
  series,
  type = "line",
  xKind = "bucket",
  granularity = "day",
  format = "compact",
  locale = "fr",
  height = 260,
  horizontal,
  yDomain = "zero",
  zeroLine,
  hideLegend,
}: MetricChartProps) {
  const fmt = makeFormatter(format, locale);
  const axisFmt = makeFormatter(format === "percent" ? "percent" : format === "absNumber" ? "absNumber" : "compact", locale, 1);
  const xLabel = (v: string) => (xKind === "bucket" ? formatBucketLabel(v, granularity, locale) : v);
  const labelOf = (name: unknown) => series.find((s) => s.key === name)?.label ?? String(name);
  const legend = !hideLegend && series.length > 1 && (
    <Legend itemSorter={null} iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12, paddingTop: 8 }} formatter={(v: string) => <span className="text-ink-2">{labelOf(v)}</span>} />
  );
  const tooltip = (
    <Tooltip
      cursor={type === "bar" ? cursorBar : cursorLine}
      content={(p) => <ChartTooltipContent {...p} labelFormatter={(l) => xLabel(l)} valueFormatter={(v) => fmt(v)} nameFormatter={(k) => labelOf(k)} />}
    />
  );

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={data} stackOffset="sign" layout={horizontal ? "vertical" : "horizontal"} margin={{ ...chartMargin, right: 12, left: horizontal ? 8 : 0 }} barGap={2}>
            <CartesianGrid {...gridProps} vertical={!!horizontal} horizontal={!horizontal} />
            {horizontal ? (
              <>
                <XAxis type="number" {...axisProps} tickFormatter={axisFmt} />
                <YAxis type="category" dataKey="key" {...axisProps} width={120} tick={{ ...axisProps.tick, fill: "var(--color-ink)", fontSize: 12 }} />
              </>
            ) : (
              <>
                <XAxis dataKey="key" {...xAxisProps} tickFormatter={xLabel} minTickGap={16} />
                <YAxis {...axisProps} width={52} tickFormatter={axisFmt} />
              </>
            )}
            {zeroLine && <ReferenceLine y={0} stroke="var(--color-line-strong)" />}
            {tooltip}
            {legend}
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                stackId={s.stackId}
                radius={s.stackId ? 0 : horizontal ? [0, 4, 4, 0] : barProps.radius}
                maxBarSize={horizontal ? 18 : barProps.maxBarSize}
                stroke="var(--color-surface)"
                strokeWidth={s.stackId ? 1 : 0}
                animationDuration={600}
              />
            ))}
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ ...chartMargin, right: 12 }}>
            <CartesianGrid {...gridProps} />
            <XAxis dataKey="key" {...xAxisProps} tickFormatter={xLabel} minTickGap={24} />
            <YAxis {...axisProps} width={52} tickFormatter={axisFmt} domain={yDomain === "auto" ? ["auto", "auto"] : [0, "auto"]} />
            {tooltip}
            {legend}
            {series.map((s) => (
              <Line
                key={s.key}
                type="monotone"
                dataKey={s.key}
                stroke={s.color}
                strokeWidth={2}
                dot={false}
                activeDot={activeDot}
                connectNulls
                animationDuration={700}
              />
            ))}
          </LineChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
