import { cn } from "@/lib/utils";

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("animate-shimmer rounded-control bg-[linear-gradient(90deg,var(--color-line)_25%,var(--color-surface-2)_50%,var(--color-line)_75%)] bg-[length:200%_100%]", className)}
    />
  );
}
