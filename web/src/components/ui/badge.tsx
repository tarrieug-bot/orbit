import { AlertTriangle, CheckCircle2, Info, OctagonAlert } from "lucide-react";
import { cn } from "@/lib/utils";

export type BadgeTone = "neutral" | "positive" | "negative" | "warning" | "info" | "brand" | "outline";
const TONES: Record<BadgeTone, string> = {
  neutral: "bg-surface-3 text-ink-2",
  positive: "bg-positive-soft text-positive",
  negative: "bg-negative-soft text-negative",
  warning: "bg-warning-soft text-warning",
  info: "bg-info-soft text-info",
  brand: "bg-orbit-50 text-orbit-700",
  outline: "border border-line bg-surface text-ink-2",
};

export interface BadgeProps {
  tone?: BadgeTone;
  /** pastille de couleur avant le texte */
  dot?: boolean;
  /** icône lucide (ou autre) avant le texte */
  icon?: React.ReactNode;
  size?: "sm" | "md";
  className?: string;
  children: React.ReactNode;
}

export function Badge({ tone = "neutral", dot, icon, size = "sm", className, children }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-pill font-medium whitespace-nowrap",
        size === "sm" ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-1 text-xs",
        TONES[tone],
        className,
      )}
    >
      {dot && <span aria-hidden className="mr-0.5 h-1.5 w-1.5 rounded-full bg-current" />}
      {icon && <span aria-hidden className="inline-flex [&>svg]:h-3 [&>svg]:w-3">{icon}</span>}
      {children}
    </span>
  );
}

export type StatusKind = "success" | "warning" | "critical" | "info";
const STATUS: Record<StatusKind, { tone: BadgeTone; Icon: typeof Info }> = {
  success: { tone: "positive", Icon: CheckCircle2 },
  warning: { tone: "warning", Icon: AlertTriangle },
  critical: { tone: "negative", Icon: OctagonAlert },
  info: { tone: "info", Icon: Info },
};

/** Statut toujours accompagné d'une icône ET d'un texte (jamais la couleur seule). */
export function StatusBadge({ status, children, size, className }: { status: StatusKind; children: React.ReactNode; size?: "sm" | "md"; className?: string }) {
  const { tone, Icon } = STATUS[status];
  return (
    <Badge tone={tone} size={size} icon={<Icon strokeWidth={2.25} />} className={className}>
      {children}
    </Badge>
  );
}

/** Encadré d'information / d'alerte avec icône. */
export function Callout({ status = "info", title, children, action, className }: { status?: StatusKind; title?: React.ReactNode; children?: React.ReactNode; action?: React.ReactNode; className?: string }) {
  const { Icon } = STATUS[status];
  const tones: Record<StatusKind, string> = {
    success: "bg-positive-soft text-positive",
    warning: "bg-warning-soft text-warning",
    critical: "bg-negative-soft text-negative",
    info: "bg-info-soft text-info",
  };
  return (
    <div role={status === "critical" ? "alert" : "status"} className={cn("flex items-start gap-3 rounded-control border border-current/10 p-3.5 text-sm", tones[status], className)}>
      <Icon size={18} className="mt-px shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        {title && <p className="font-semibold">{title}</p>}
        {children && <div className={cn("text-ink-2", title && "mt-0.5")}>{children}</div>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
