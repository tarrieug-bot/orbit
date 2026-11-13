"use client";

import { Area, AreaChart, Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { AppLocale } from "@/lib/db/types";
import { formatBucketLabel, formatCompact, formatNumber, formatPercent, type Granularity } from "@/lib/metrics";

export interface TrendSeries {
  key: string;
  label: string;
  color: string;
}

export interface TrendChartProps {
  /** lignes { key: "YYYY-MM-DD", <série>: number|null } — cf. toChartData() */
  data: Record<string, string | number | null>[];
  series: TrendSeries[];
  type?: "area" | "bar";
  granularity?: Granularity;
  format?: "number" | "compact" | "percent";
  locale?: AppLocale;
  height?: number;
  stacked?: boolean;
  /** "auto" : l'axe Y suit les données (ex. abonnés) ; "zero" : part de 0 (défaut) */
  yDomain?: "zero" | "auto";
}

/** Graphique de tendance générique (Recharts) aux couleurs Orbit. */
export function TrendChart({ data, series, type = "area", granularity = "day", format = "compact", locale = "fr", height = 260, stacked, yDomain = "zero" }: TrendChartProps) {
  const fmt = (v: number) => (format === "percent" ? formatPercent(v, locale) : format === "number" ? formatNumber(v, locale) : formatCompact(v, locale));
  const axis = { stroke: "#94A3B8", fontSize: 11, tickLine: false, axisLine: false } as const;
  const common = (
    <>
      <CartesianGrid vertical={false} stroke="#E7E9F0" />
      <XAxis dataKey="key" {...axis} tickFormatter={(v: string) => formatBucketLabel(v, granularity, locale)} minTickGap={24} />
      <YAxis {...axis} width={48} tickFormatter={(v: number) => fmt(v)} domain={yDomain === "auto" ? ["auto", "auto"] : [0, "auto"]} />
      <Tooltip
        cursor={{ stroke: "#C7D2FE", fill: "rgba(99,102,241,0.06)" }}
        contentStyle={{ borderRadius: 12, border: "1px solid #E7E9F0", boxShadow: "0 12px 32px -8px rgba(15,23,42,.18)", fontSize: 12 }}
        labelFormatter={(v) => formatBucketLabel(String(v), granularity, locale)}
        formatter={(v, name) => [typeof v === "number" ? fmt(v) : "—", series.find((s) => s.key === name)?.label ?? String(name)]}
      />
      {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 12 }} formatter={(v: string) => series.find((s) => s.key === v)?.label ?? v} />}
    </>
  );
  return (
    <div style={{ height }}>
      <ResponsiveContainer width="100%" height="100%">
        {type === "bar" ? (
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            {common}
            {series.map((s) => (
              <Bar key={s.key} dataKey={s.key} fill={s.color} radius={[4, 4, 0, 0]} maxBarSize={28} stackId={stacked ? "s" : undefined} />
            ))}
          </BarChart>
        ) : (
          <AreaChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
            <defs>
              {series.map((s) => (
                <linearGradient key={s.key} id={`trend-${s.key}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={s.color} stopOpacity={0.22} />
                  <stop offset="100%" stopColor={s.color} stopOpacity={0} />
                </linearGradient>
              ))}
            </defs>
            {common}
            {series.map((s) => (
              <Area key={s.key} type="monotone" dataKey={s.key} stroke={s.color} strokeWidth={2} fill={`url(#trend-${s.key})`} dot={false} activeDot={{ r: 4, strokeWidth: 2, stroke: "#fff" }} connectNulls stackId={stacked ? "s" : undefined} />
            ))}
          </AreaChart>
        )}
      </ResponsiveContainer>
    </div>
  );
}
