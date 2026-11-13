import { Clock } from "lucide-react";
import { HEAT_STEPS, heatColor } from "./palette";

/**
 * Carte de chaleur jour × heure (valeurs normalisées 0–1, lundi = ligne 0).
 * Infobulle CSS au survol / focus (accessible au clavier).
 */
export function Heatmap({
  values,
  dayLabels,
  cellLabel,
  bestLabel,
  lessLabel,
  moreLabel,
  note,
}: {
  values: number[][];
  /** 7 libellés courts, lundi → dimanche */
  dayLabels: string[];
  /** ex. (jour, heure, %) => « Lun 19h–20h · 82 % du pic » */
  cellLabel: (day: string, hour: number, value: number) => string;
  bestLabel: (day: string, hour: number) => string;
  lessLabel: string;
  moreLabel: string;
  note?: string;
}) {
  let best = { v: -1, d: 0, h: 0 };
  values.forEach((row, d) => row.forEach((v, h) => v > best.v && (best = { v, d, h })));
  return (
    <div>
      <div className="overflow-x-auto pb-1">
        <div className="grid min-w-[520px] grid-cols-[36px_repeat(24,minmax(0,1fr))] gap-[3px] text-[10px] text-ink-3">
          <div />
          {Array.from({ length: 24 }, (_, h) => (
            <div key={h} className="text-center tabular">{h % 3 === 0 ? `${h}h` : ""}</div>
          ))}
          {values.map((row, d) => (
            <div key={d} className="contents">
              <div className="flex items-center pr-1 text-[11px] font-medium text-ink-2">{dayLabels[d]}</div>
              {row.map((v, h) => {
                const label = cellLabel(dayLabels[d], h, v);
                return (
                  <div
                    key={h}
                    tabIndex={0}
                    aria-label={label}
                    className="group relative aspect-square rounded-[4px] outline-none transition-transform duration-150 hover:z-10 hover:scale-125 focus-visible:z-10 focus-visible:scale-125 focus-visible:ring-2 focus-visible:ring-orbit-500"
                    style={{ background: heatColor(v) }}
                  >
                    <span className="pointer-events-none absolute bottom-full left-1/2 z-20 mb-1.5 hidden -translate-x-1/2 rounded-lg bg-ink px-2 py-1 text-[11px] whitespace-nowrap text-white shadow-pop group-hover:block group-focus-visible:block">
                      {label}
                    </span>
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-xs text-ink-2">
        <span className="inline-flex items-center gap-1.5 rounded-pill bg-orbit-50 px-2.5 py-1 font-medium text-orbit-700">
          <Clock size={13} aria-hidden />
          {bestLabel(dayLabels[best.d], best.h)}
        </span>
        <span className="inline-flex items-center gap-1.5">
          {lessLabel}
          {HEAT_STEPS.map((c) => (
            <i key={c} className="inline-block h-2.5 w-3.5 rounded-[3px]" style={{ background: c }} />
          ))}
          {moreLabel}
        </span>
      </div>
      {note && <p className="mt-2 text-xs text-ink-3">{note}</p>}
    </div>
  );
}
