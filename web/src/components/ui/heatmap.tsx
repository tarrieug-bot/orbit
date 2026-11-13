"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";
import { SEQ_VARS } from "@/styles/tokens";

export interface HeatmapProps {
  /** valeurs [ligne][colonne] (ex. jour lundi=0..6 × heure 0..23) ; null = indisponible */
  data: (number | null)[][];
  /** libellés des lignes (ex. « Lun », « Mar »…) — fournis traduits */
  rowLabels: string[];
  /** libellés des colonnes ; défaut : 0..23 (heures) */
  colLabels?: string[];
  /** n'afficher qu'un libellé de colonne sur N (défaut 3) */
  colLabelEvery?: number;
  /** formate une valeur pour l'infobulle */
  valueFormatter?: (v: number) => string;
  /** texte de l'infobulle : (ligne, colonne, valeur formatée) */
  describe?: (row: string, col: string, value: string) => string;
  /** légende de l'échelle (ex. { low: "Moins", high: "Plus" }) */
  legend?: { low: string; high: string };
  /** met en évidence la cellule maximale (anneau) */
  highlightMax?: boolean;
  /** hauteur d'une cellule (px) */
  cellHeight?: number;
  className?: string;
}

const STEPS = SEQ_VARS.length - 1; // 7 classes au-dessus de 0

/** Carte de chaleur jour × heure, échelle séquentielle à une teinte (clair → foncé). */
export function Heatmap({ data, rowLabels, colLabels, colLabelEvery = 3, valueFormatter = (v) => String(Math.round(v * 100) / 100), describe, legend, highlightMax = true, cellHeight = 22, className }: HeatmapProps) {
  const cols = colLabels ?? Array.from({ length: data[0]?.length ?? 24 }, (_, i) => `${i}h`);
  const flat = data.flat().filter((v): v is number => v != null);
  const min = flat.length ? Math.min(...flat) : 0;
  const max = flat.length ? Math.max(...flat) : 1;
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);

  const bin = (v: number) => (max === min ? STEPS : 1 + Math.min(STEPS - 1, Math.floor(((v - min) / (max - min)) * STEPS)));
  let maxKey = "";
  if (highlightMax && flat.length) {
    outer: for (let r = 0; r < data.length; r++)
      for (let c = 0; c < data[r].length; c++)
        if (data[r][c] === max) {
          maxKey = `${r}:${c}`;
          break outer;
        }
  }
  const hv = hover ? data[hover.r]?.[hover.c] : null;
  const tip = hover ? (describe ? describe(rowLabels[hover.r], cols[hover.c], hv == null ? "—" : valueFormatter(hv)) : `${rowLabels[hover.r]} · ${cols[hover.c]} : ${hv == null ? "—" : valueFormatter(hv)}`) : null;

  return (
    <div className={cn("w-full", className)}>
      <div className="relative overflow-x-auto">
        <div className="grid min-w-[520px] gap-[3px]" style={{ gridTemplateColumns: `2.5rem repeat(${cols.length}, minmax(0, 1fr))` }} onMouseLeave={() => setHover(null)}>
          {data.map((row, r) => (
            <div key={r} className="contents">
              <div className="flex items-center pr-2 text-[11px] font-medium text-ink-3">{rowLabels[r]}</div>
              {row.map((v, c) => {
                const isMax = maxKey === `${r}:${c}`;
                const label = describe ? describe(rowLabels[r], cols[c], v == null ? "—" : valueFormatter(v)) : `${rowLabels[r]} ${cols[c]} : ${v == null ? "—" : valueFormatter(v)}`;
                return (
                  <div
                    key={c}
                    role="img"
                    aria-label={label}
                    tabIndex={-1}
                    onMouseEnter={() => setHover({ r, c })}
                    className={cn(
                      "rounded-[4px] transition-[transform,box-shadow] duration-100",
                      v == null && "bg-[repeating-linear-gradient(45deg,var(--color-surface-3)_0_3px,transparent_3px_6px)]",
                      hover?.r === r && hover?.c === c && "relative z-10 scale-110 shadow-[0_0_0_2px_var(--color-surface),0_0_0_3.5px_var(--color-ink)]",
                      isMax && !(hover?.r === r && hover?.c === c) && "shadow-[0_0_0_1.5px_var(--color-surface),0_0_0_3px_var(--color-orbit-500)]",
                    )}
                    style={{ height: cellHeight, background: v == null ? undefined : SEQ_VARS[bin(v)] }}
                  />
                );
              })}
            </div>
          ))}
          <div />
          {cols.map((c, i) => (
            <div key={c} className="pt-1 text-center text-[10.5px] text-ink-3 tabular">
              {i % colLabelEvery === 0 ? c : ""}
            </div>
          ))}
        </div>
      </div>
      <div className="mt-3 flex min-h-5 flex-wrap items-center justify-between gap-3">
        <p className="text-xs font-medium text-ink-2" aria-live="polite">
          {tip}
        </p>
        {legend && (
          <div className="flex items-center gap-2 text-[11px] text-ink-3">
            <span>{legend.low}</span>
            <span className="flex gap-[2px]">
              {SEQ_VARS.slice(1).map((c) => (
                <span key={c} className="h-2.5 w-4 rounded-[3px]" style={{ background: c }} />
              ))}
            </span>
            <span>{legend.high}</span>
          </div>
        )}
      </div>
    </div>
  );
}
