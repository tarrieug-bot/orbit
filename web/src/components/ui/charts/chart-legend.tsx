import type { Network } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { NetworkIcon } from "../network-icon";

export interface ChartLegendItem {
  key: string;
  label: React.ReactNode;
  color: string;
  /** affiche le logo du réseau à côté de la pastille */
  network?: Network;
  /** valeur résumée (ex. total de la période) */
  value?: React.ReactNode;
  /** série en pointillés (période précédente) */
  dashed?: boolean;
}

/** Légende HTML (hors SVG) : pastille + libellé, valeur optionnelle. */
export function ChartLegend({ items, className, onToggle, hidden }: { items: ChartLegendItem[]; className?: string; onToggle?: (key: string) => void; hidden?: string[] }) {
  return (
    <ul className={cn("flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs", className)}>
      {items.map((it) => {
        const off = hidden?.includes(it.key);
        const inner = (
          <>
            {it.dashed ? (
              <span aria-hidden className="h-0 w-3.5 border-t-2 border-dashed" style={{ borderColor: it.color }} />
            ) : (
              <span aria-hidden className="h-2.5 w-2.5 rounded-[3px]" style={{ background: it.color }} />
            )}
            {it.network && <NetworkIcon network={it.network} size={12} />}
            <span className="text-ink-2">{it.label}</span>
            {it.value != null && <span className="tabular font-semibold text-ink">{it.value}</span>}
          </>
        );
        return (
          <li key={it.key} className={cn(off && "opacity-40")}>
            {onToggle ? (
              <button type="button" aria-pressed={!off} onClick={() => onToggle(it.key)} className="inline-flex items-center gap-1.5 rounded-[6px] px-1 py-0.5 hover:bg-surface-3">
                {inner}
              </button>
            ) : (
              <span className="inline-flex items-center gap-1.5">{inner}</span>
            )}
          </li>
        );
      })}
    </ul>
  );
}
