import { Info } from "lucide-react";
import { cn } from "@/lib/utils";
import { Delta, type DeltaProps } from "./delta";
import { Skeleton } from "./skeleton";
import { Sparkline } from "./sparkline";

export interface KpiTileProps {
  label: string;
  /** valeur formatée (« 12,4 k », « 3,45 % ») */
  value: string;
  delta?: DeltaProps | null;
  /** texte affiché à la place du delta (ex. « pas de période de comparaison ») */
  note?: string;
  sparkline?: number[];
  /** couleur de la sparkline (hex ou var(--color-…)) ; défaut : accent Orbit */
  sparklineColor?: string;
  help?: string;
  icon?: React.ReactNode;
  /** métrique indisponible : valeur grisée */
  unavailable?: boolean;
  /** valeur secondaire sous le chiffre (ex. « 412 gagnés · 38 perdus ») */
  sub?: React.ReactNode;
  /** chargement : squelette */
  loading?: boolean;
  /** mise en avant (KPI principal) */
  emphasis?: boolean;
  className?: string;
}

/** Tuile KPI : libellé, grande valeur, variation ▲▼ colorée (avec texte) et sparkline. */
export function KpiTile({ label, value, delta, note, sparkline, sparklineColor = "var(--color-orbit-500)", help, icon, unavailable, sub, loading, emphasis, className }: KpiTileProps) {
  return (
    <div
      className={cn(
        "group relative flex flex-col overflow-hidden rounded-card border border-line bg-surface p-4 shadow-card transition-[box-shadow,border-color] duration-200 hover:border-line-strong hover:shadow-raised",
        emphasis && "border-orbit-200 bg-[linear-gradient(165deg,var(--color-orbit-50),var(--color-surface)_55%)]",
        className,
      )}
    >
      <div className="flex items-center gap-1.5 text-[12.5px] font-medium text-ink-2">
        {icon && <span className="flex h-6 w-6 items-center justify-center rounded-[7px] bg-surface-3 text-ink-2 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}</span>}
        <span className="truncate">{label}</span>
        {help && (
          <span title={help} className="ml-auto text-ink-3 opacity-60 transition-opacity group-hover:opacity-100">
            <Info size={13} aria-label={help} />
          </span>
        )}
      </div>
      {loading ? (
        <>
          <Skeleton className="mt-2.5 h-7 w-24" />
          <Skeleton className="mt-2.5 h-4 w-16" />
        </>
      ) : (
        <>
          <div className={cn("tabular mt-2 text-[28px] leading-8 font-semibold tracking-[-0.025em]", unavailable ? "text-ink-3" : "text-ink")}>{value}</div>
          {sub && <div className="mt-0.5 text-xs text-ink-3">{sub}</div>}
          <div className="mt-2 min-h-5">{delta ? <Delta {...delta} /> : note ? <span className="text-xs text-ink-3">{note}</span> : null}</div>
        </>
      )}
      {sparkline && sparkline.length > 1 && !loading && (
        <div className="-mx-4 -mb-4 mt-2 opacity-80 transition-opacity group-hover:opacity-100">
          <Sparkline values={sparkline} color={sparklineColor} height={40} />
        </div>
      )}
    </div>
  );
}
