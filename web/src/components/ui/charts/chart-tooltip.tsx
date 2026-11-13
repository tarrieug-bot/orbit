"use client";

import { cn } from "@/lib/utils";

export interface ChartTooltipEntry {
  name?: string | number;
  value?: unknown;
  color?: string;
  stroke?: string;
  fill?: string;
  dataKey?: unknown;
}

export interface ChartTooltipContentProps {
  active?: boolean;
  payload?: ReadonlyArray<ChartTooltipEntry>;
  label?: unknown;
  /** formate le titre (date du point) */
  labelFormatter?: (label: string) => React.ReactNode;
  /** formate une valeur */
  valueFormatter?: (value: number, key: string) => React.ReactNode;
  /** libellé affiché pour une clé de série */
  nameFormatter?: (key: string) => React.ReactNode;
  /** ligne de total en pied (ex. somme des réseaux) */
  total?: { label: React.ReactNode; format?: (sum: number) => React.ReactNode };
  className?: string;
}

/**
 * Infobulle soignée pour Recharts :
 * <Tooltip content={(p) => <ChartTooltipContent {...p} valueFormatter={…} />} />
 */
export function ChartTooltipContent({ active, payload, label, labelFormatter, valueFormatter, nameFormatter, total, className }: ChartTooltipContentProps) {
  if (!active || !payload?.length) return null;
  const rows = payload.filter((p) => p.value != null);
  const sum = rows.reduce((s, p) => s + (typeof p.value === "number" ? p.value : 0), 0);
  return (
    <div className={cn("min-w-40 rounded-[12px] border border-line bg-surface/95 px-3 py-2.5 text-xs shadow-pop backdrop-blur-md", className)}>
      {label != null && <div className="mb-1.5 font-semibold text-ink">{labelFormatter ? labelFormatter(String(label)) : String(label)}</div>}
      <ul className="space-y-1">
        {rows.map((p) => {
          const key = String(p.dataKey ?? p.name ?? "");
          const color = p.color ?? p.stroke ?? p.fill;
          return (
            <li key={key} className="flex items-center gap-2">
              <span aria-hidden className="h-2 w-2 shrink-0 rounded-[3px]" style={{ background: color }} />
              <span className="min-w-0 flex-1 truncate text-ink-2">{nameFormatter ? nameFormatter(key) : String(p.name ?? key)}</span>
              <span className="tabular font-semibold text-ink">{typeof p.value === "number" ? (valueFormatter ? valueFormatter(p.value, key) : p.value.toLocaleString()) : "—"}</span>
            </li>
          );
        })}
      </ul>
      {total && rows.length > 1 && (
        <div className="mt-1.5 flex items-center justify-between border-t border-line pt-1.5">
          <span className="text-ink-2">{total.label}</span>
          <span className="tabular font-semibold text-ink">{total.format ? total.format(sum) : sum.toLocaleString()}</span>
        </div>
      )}
    </div>
  );
}
