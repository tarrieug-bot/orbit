"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, Tabs } from "@/components/ui";
import { MetricChart, type MetricChartProps } from "./charts";

export interface ChartOption extends Omit<MetricChartProps, "locale" | "granularity" | "height"> {
  value: string;
  label: string;
}

/** Carte graphique avec sélecteur de métrique (onglets « pilule »). */
export function SwitchableChartCard({
  title,
  description,
  options,
  locale,
  granularity,
  height = 260,
  className,
}: {
  title: string;
  description?: string;
  options: ChartOption[];
  locale: MetricChartProps["locale"];
  granularity?: MetricChartProps["granularity"];
  height?: number;
  className?: string;
}) {
  const [value, setValue] = useState(options[0]?.value);
  const current = options.find((o) => o.value === value) ?? options[0];
  return (
    <Card className={className}>
      <CardHeader title={title} description={description} />
      <CardContent>
        <div className="-mx-1 mb-3 overflow-x-auto px-1">
          <Tabs variant="pill" value={current.value} onValueChange={setValue} items={options.map((o) => ({ value: o.value, label: o.label }))} className="text-xs" />
        </div>
        <MetricChart key={current.value} {...current} locale={locale} granularity={granularity} height={height} />
      </CardContent>
    </Card>
  );
}
