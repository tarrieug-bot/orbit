import { cn } from "@/lib/utils";

type Tone = "neutral" | "positive" | "negative" | "warning" | "info" | "brand";
const TONES: Record<Tone, string> = {
  neutral: "bg-ink/5 text-ink-2",
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  brand: "bg-orbit-50 text-orbit-700",
};

export function Badge({ tone = "neutral", dot, className, children }: { tone?: Tone; dot?: boolean; className?: string; children: React.ReactNode }) {
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-pill px-2 py-0.5 text-[11px] font-medium whitespace-nowrap", TONES[tone], className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  );
}
