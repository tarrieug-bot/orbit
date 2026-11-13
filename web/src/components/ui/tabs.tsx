"use client";

import Link from "next/link";
import { cn } from "@/lib/utils";

export interface TabItem {
  value: string;
  label: React.ReactNode;
  /** onglet de navigation (lien) */
  href?: string;
  icon?: React.ReactNode;
  disabled?: boolean;
  /** compteur affiché à droite du libellé */
  count?: number | string;
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange?: (value: string) => void;
  /** underline : onglets de page ; pill / segmented : commutateur compact */
  variant?: "underline" | "pill" | "segmented";
  size?: "sm" | "md";
  className?: string;
  /** libellé accessible du groupe */
  "aria-label"?: string;
}

/** Onglets : liens (href) ou état local (onValueChange). */
export function Tabs({ items, value, onValueChange, variant = "underline", size = "md", className, "aria-label": ariaLabel }: TabsProps) {
  const compact = variant !== "underline";
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn(
        variant === "underline" ? "flex gap-1 overflow-x-auto border-b border-line" : "inline-flex gap-0.5 rounded-control border border-line/60 bg-surface-3 p-[3px]",
        className,
      )}
    >
      {items.map((item) => {
        const active = item.value === value;
        const cls = cn(
          "inline-flex shrink-0 items-center gap-1.5 font-medium whitespace-nowrap transition-[color,background-color,box-shadow] duration-150 [&>svg]:h-4 [&>svg]:w-4",
          size === "sm" ? "text-[12.5px]" : "text-sm",
          variant === "underline"
            ? cn("relative -mb-px border-b-2 px-3 py-2.5", active ? "border-orbit-600 text-ink" : "border-transparent text-ink-2 hover:border-line-strong hover:text-ink")
            : cn("rounded-[7px]", size === "sm" ? "px-2.5 py-1" : "px-3 py-1.5", active ? "bg-surface text-ink shadow-[0_1px_2px_rgb(0_0_0/0.08),0_0_0_1px_var(--color-line)]" : "text-ink-2 hover:text-ink"),
          item.disabled && "pointer-events-none opacity-40",
        );
        const content = (
          <>
            {item.icon}
            {item.label}
            {item.count != null && (
              <span className={cn("tabular rounded-pill px-1.5 text-[11px] font-semibold", active ? "bg-orbit-50 text-orbit-700" : "bg-surface-3 text-ink-3", compact && "bg-transparent px-0.5")}>{item.count}</span>
            )}
          </>
        );
        return item.href ? (
          <Link key={item.value} href={item.href} role="tab" aria-selected={active} className={cls} scroll={false}>
            {content}
          </Link>
        ) : (
          <button key={item.value} type="button" role="tab" aria-selected={active} disabled={item.disabled} className={cls} onClick={() => onValueChange?.(item.value)}>
            {content}
          </button>
        );
      })}
    </div>
  );
}

export type SegmentedProps = Omit<TabsProps, "variant">;

/** Commutateur segmenté (ex. Jour / Semaine / Mois). */
export function Segmented(props: SegmentedProps) {
  return <Tabs {...props} variant="segmented" size={props.size ?? "sm"} />;
}
