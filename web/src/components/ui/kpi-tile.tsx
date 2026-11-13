import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Delta, type DeltaProps } from "./delta";
import { Sparkline } from "./sparkline";

export interface KpiTileProps {
  label: string;
  /** valeur formatée (« 12,4 k », « 3,45 % ») */
  value: string;
  delta?: DeltaProps | null;
  /** texte affiché à la place du delta (ex. « pas de période de comparaison ») */
  note?: string;
  sparkline?: number[];
  sparklineColor?: string;
  help?: string;
  icon?: React.ReactNode;
  /** métrique indisponible : valeur grisée */
  unavailable?: boolean;
  className?: string;
}

/** Tuile KPI : libellé, grande valeur, variation ▲▼ colorée et sparkline. */
export function KpiTile({ label, value, delta, note, sparkline, sparklineColor = "#6366F1", help, icon, unavailable, className }: KpiTileProps) {
  return (
    <div className={cn("group relative flex flex-col overflow-hidden rounded-card border border-line/70 bg-surface p-4 shadow-card transition-shadow hover:shadow-pop", className)}>
      <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
        {icon && <span className="text-ink-3">{icon}</span>}
        <span className="truncate">{label}</span>
        {help && (
          <span title={help} className="ml-auto text-ink-3 opacity-0 transition-opacity group-hover:opacity-100">
            <Info size={13} aria-label={help} />
          </span>
        )}
      </div>
      <div className={cn("tabular mt-1.5 text-[26px] leading-tight font-semibold tracking-tight", unavailable ? "text-ink-3" : "text-ink")}>{value}</div>
      <div className="mt-1.5 min-h-5">
        {delta ? <Delta {...delta} /> : note ? <span className="text-xs text-ink-3">{note}</span> : null}
      </div>
      {sparkline && sparkline.length > 1 && (
        <div className="-mx-4 -mb-4 mt-2">
          <Sparkline values={sparkline} color={sparklineColor} height={36} />
        </div>
      )}
    </div>
  );
}
