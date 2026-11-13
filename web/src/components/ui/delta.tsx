import type { Trend } from "@/lib/metrics/types";
import { cn } from "@/lib/utils";

export interface DeltaProps {
  trend: Trend;
  /** texte déjà formaté : « +12,3 % », « −0,40 pt » */
  label: string;
  /** true = hausse souhaitable (défaut) ; false pour les désabonnements */
  higherIsBetter?: boolean;
  /** légende discrète, ex. « vs 12,4 k » */
  caption?: string;
  className?: string;
}

/** Variation ▲ ▼ ■ colorée selon qu'elle est bonne ou mauvaise. */
export function Delta({ trend, label, higherIsBetter = true, caption, className }: DeltaProps) {
  const good = trend === "flat" ? null : (trend === "up") === higherIsBetter;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span
        className={cn(
          "tabular inline-flex items-center gap-0.5 rounded-pill px-1.5 py-0.5 font-semibold",
          good === null ? "bg-ink/5 text-ink-2" : good ? "bg-positive-soft text-positive" : "bg-negative-soft text-negative",
        )}
      >
        <span aria-hidden className="text-[9px]">{trend === "up" ? "▲" : trend === "down" ? "▼" : "■"}</span>
        {label}
      </span>
      {caption && <span className="text-ink-3">{caption}</span>}
    </span>
  );
}
