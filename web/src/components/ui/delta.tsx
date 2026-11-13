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
  /** apparence : pastille (défaut) ou texte seul */
  variant?: "pill" | "text";
  className?: string;
}

function Arrow({ trend }: { trend: Trend }) {
  if (trend === "flat")
    return (
      <svg aria-hidden width="8" height="8" viewBox="0 0 8 8">
        <rect x="1" y="3" width="6" height="2" rx="1" fill="currentColor" />
      </svg>
    );
  return (
    <svg aria-hidden width="8" height="8" viewBox="0 0 8 8" className={trend === "down" ? "rotate-180" : undefined}>
      <path d="M4 1.2 7.2 6.4H.8z" fill="currentColor" strokeLinejoin="round" />
    </svg>
  );
}

/** Variation ▲ ▼ ■ colorée selon qu'elle est bonne ou mauvaise (toujours avec le texte). */
export function Delta({ trend, label, higherIsBetter = true, caption, variant = "pill", className }: DeltaProps) {
  const good = trend === "flat" ? null : (trend === "up") === higherIsBetter;
  return (
    <span className={cn("inline-flex items-center gap-1.5 text-xs", className)}>
      <span
        className={cn(
          "tabular inline-flex items-center gap-1 font-semibold",
          variant === "pill" && "rounded-pill px-1.5 py-0.5",
          good === null ? (variant === "pill" ? "bg-surface-3 text-ink-2" : "text-ink-2") : good ? cn("text-positive", variant === "pill" && "bg-positive-soft") : cn("text-negative", variant === "pill" && "bg-negative-soft"),
        )}
      >
        <Arrow trend={trend} />
        {label}
      </span>
      {caption && <span className="text-ink-3">{caption}</span>}
    </span>
  );
}
