"use client";

import { useTranslations } from "next-intl";
import { Clock } from "lucide-react";
import { Heatmap } from "@/components/ui";

/**
 * Meilleurs moments (jour × heure, valeurs 0–1, lundi = ligne 0) : Heatmap du
 * design system + badge du meilleur créneau. Textes traduits côté client.
 */
export function BestTimesHeatmap({ values, note }: { values: number[][]; note?: string }) {
  const t = useTranslations();
  const days = t("common.weekdaysShort").split(",");
  let best = { v: -1, d: 0, h: 0 };
  values.forEach((row, d) => row.forEach((v, h) => v > best.v && (best = { v, d, h })));
  return (
    <div>
      <Heatmap
        data={values}
        rowLabels={days}
        valueFormatter={(v) => `${Math.round(v * 100)}`}
        describe={(day, hour, value) => t("heatmap.cell", { day, from: parseInt(hour, 10), to: parseInt(hour, 10) + 1, value })}
        legend={{ low: t("heatmap.less"), high: t("heatmap.more") }}
      />
      <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-orbit-50 px-2.5 py-1 font-medium text-orbit-700">
          <Clock size={13} aria-hidden />
          {t("heatmap.best", { day: days[best.d], hour: best.h })}
        </span>
        {note && <span className="text-ink-3">{note}</span>}
      </div>
    </div>
  );
}
