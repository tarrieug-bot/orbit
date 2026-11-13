import { cn } from "@/lib/utils";

/** Bloc de chargement animé (respecte prefers-reduced-motion). */
export function Skeleton({ className, rounded }: { className?: string; rounded?: "control" | "full" | "card" }) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-shimmer bg-[linear-gradient(90deg,var(--color-surface-3)_25%,var(--color-surface-2)_50%,var(--color-surface-3)_75%)] bg-[length:200%_100%]",
        rounded === "full" ? "rounded-full" : rounded === "card" ? "rounded-card" : "rounded-control",
        className,
      )}
    />
  );
}

/** Squelette de carte KPI. */
export function SkeletonKpi({ className }: { className?: string }) {
  return (
    <div className={cn("rounded-card border border-line bg-surface p-4 shadow-card", className)}>
      <Skeleton className="h-4 w-24" />
      <Skeleton className="mt-3 h-7 w-28" />
      <Skeleton className="mt-3 h-4 w-14" rounded="full" />
    </div>
  );
}
