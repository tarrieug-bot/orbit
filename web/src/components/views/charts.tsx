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

const AXIS = { stroke: "#94A3B8", fontSize: 11, tickLine: false, axisLine: false } as const;
const TOOLTIP_STYLE = {
  borderRadius: 12,
  border: "1px solid #E7E9F0",
  boxShadow: "0 12px 32px -8px rgba(15,23,42,.18)",
  fontSize: 12,
  padding: "8px 12px",
} as const;

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
      cursor={type === "bar" ? { fill: "rgba(99,102,241,0.06)" } : { stroke: "#C7D2FE" }}
      contentStyle={TOOLTIP_STYLE}
      labelStyle={{ color: "#0F172A", fontWeight: 600, marginBottom: 4 }}
      labelFormatter={(v) => xLabel(String(v))}
      formatter={(v, name) => [typeof v === "number" ? fmt(v) : "—", labelOf(name)]}
    />
  );

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={data} stackOffset="sign" layout={horizontal ? "vertical" : "horizontal"} margin={{ top: 8, right: 12, bottom: 0, left: horizontal ? 8 : 0 }} barGap={2}>
            <CartesianGrid vertical={!!horizontal} horizontal={!horizontal} stroke="#EEF0F5" />
            {horizontal ? (
              <>
                <XAxis type="number" {...AXIS} tickFormatter={axisFmt} />
                <YAxis type="category" dataKey="key" {...AXIS} width={120} tick={{ fill: "#0F172A", fontSize: 12 }} />
              </>
            ) : (
              <>
                <XAxis dataKey="key" {...AXIS} tickFormatter={xLabel} minTickGap={16} />
                <YAxis {...AXIS} width={52} tickFormatter={axisFmt} />
              </>
            )}
            {zeroLine && <ReferenceLine y={0} stroke="#CBD5E1" />}
            {tooltip}
            {legend}
            {series.map((s) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                fill={s.color}
                stackId={s.stackId}
                radius={s.stackId ? 0 : horizontal ? [0, 4, 4, 0] : [4, 4, 0, 0]}
                maxBarSize={horizontal ? 18 : 28}
                stroke="#fff"
                strokeWidth={s.stackId ? 1 : 0}
                animationDuration={600}
              />
            ))}
          </BarChart>
        ) : (
          <LineChart data={data} margin={{ top: 8, right: 12, bottom: 0, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#EEF0F5" />
            <XAxis dataKey="key" {...AXIS} tickFormatter={xLabel} minTickGap={24} />
            <YAxis {...AXIS} width={52} tickFormatter={axisFmt} domain={yDomain === "auto" ? ["auto", "auto"] : [0, "auto"]} />
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
                activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }}
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
