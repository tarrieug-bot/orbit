"use client";

import { Area, AreaChart, ResponsiveContainer, YAxis } from "recharts";
import { useId } from "react";

/** Mini-courbe sans axes (tuiles KPI, tableau de la vue d'ensemble). */
export function Sparkline({ values, color = "#6366F1", height = 32, width }: { values: number[]; color?: string; height?: number; width?: number }) {
  const id = useId().replace(/:/g, "");
  if (values.length < 2) return <div style={{ height, width }} />;
  const data = values.map((v, i) => ({ i, v }));
  return (
    <div style={{ height, width: width ?? "100%" }} aria-hidden>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
          <defs>
            <linearGradient id={`spark-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} stopOpacity={0.28} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <YAxis hide domain={["dataMin", "dataMax"]} />
          <Area type="monotone" dataKey="v" stroke={color} strokeWidth={1.75} fill={`url(#spark-${id})`} isAnimationActive={false} dot={false} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
