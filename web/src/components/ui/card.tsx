import { cn } from "@/lib/utils";

export type CardVariant = "default" | "raised" | "outline" | "inset" | "ghost" | "accent";
const VARIANTS: Record<CardVariant, string> = {
  default: "border border-line bg-surface shadow-card",
  raised: "border border-line bg-surface shadow-raised",
  outline: "border border-line bg-transparent",
  inset: "border border-line/60 bg-surface-2",
  ghost: "bg-transparent",
  accent: "border border-orbit-200 bg-[linear-gradient(160deg,var(--color-orbit-50),var(--color-surface)_60%)] shadow-card",
};

export interface CardProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: CardVariant;
  /** survol : légère élévation (cartes cliquables) */
  interactive?: boolean;
}

export function Card({ className, variant = "default", interactive, ...props }: CardProps) {
  return (
    <div
      className={cn(
        "rounded-card",
        VARIANTS[variant],
        interactive && "transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-px hover:border-line-strong hover:shadow-raised",
        className,
      )}
      {...props}
    />
  );
}

export interface CardHeaderProps {
  className?: string;
  title?: React.ReactNode;
  description?: React.ReactNode;
  action?: React.ReactNode;
  /** icône à gauche du titre */
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

export function CardHeader({ className, title, description, action, icon, children }: CardHeaderProps) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-5 pt-5 pb-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon && <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-control bg-surface-3 text-ink-2 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
        <div className="min-w-0">
          {title && <h3 className="text-[15px] leading-6 font-semibold tracking-[-0.01em] text-ink">{title}</h3>}
          {description && <p className="mt-0.5 text-[13px] text-ink-2">{description}</p>}
          {children}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function CardContent({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("px-5 pb-5", className)} {...props} />;
}

export function CardFooter({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("flex items-center gap-3 border-t border-line px-5 py-3 text-[13px] text-ink-2", className)} {...props} />;
}
