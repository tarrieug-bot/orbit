"use client";

import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { useId } from "react";

export interface SparklineProps {
  values: number[];
  /** hex ou var(--color-…) */
  color?: string;
  height?: number;
  width?: number;
  /** remplissage dégradé sous la courbe (défaut : oui) */
  fill?: boolean;
}

/** Mini-courbe sans axes (tuiles KPI, tableau de la vue d'ensemble). */
export function Sparkline({ values, color = "var(--color-orbit-500)", height = 32, width, fill = true }: SparklineProps) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return <div style={{ height, width }} />;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div style={{ height, width: width ?? "100%" }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%" minWidth={0} initialDimension={{ width: width ?? 120, height }}>
        <AreaChart data={data} margin={{ top: 3, right: 0, bottom: 1, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: color, stopOpacity: 0.24 }} />
              <stop offset="100%" style={{ stopColor: color, stopOpacity: 0 }} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={fill ? `url(#spark-${id})` : "none"} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
