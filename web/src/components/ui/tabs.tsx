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
}

export interface TabsProps {
  items: TabItem[];
  value: string;
  onValueChange?: (value: string) => void;
  variant?: "underline" | "pill";
  className?: string;
}

/** Onglets : liens (href) ou état local (onValueChange). */
export function Tabs({ items, value, onValueChange, variant = "underline", className }: TabsProps) {
  return (
    <div role="tablist" className={cn(variant === "underline" ? "flex gap-1 border-b border-line" : "inline-flex gap-1 rounded-control bg-ink/5 p-1", className)}>
      {items.map((item) => {
        const active = item.value === value;
        const cls = cn(
          "inline-flex items-center gap-1.5 text-sm font-medium transition-colors",
          variant === "underline"
            ? cn("-mb-px border-b-2 px-3 py-2.5", active ? "border-orbit-600 text-ink" : "border-transparent text-ink-2 hover:text-ink")
            : cn("rounded-[calc(var(--radius-control)-2px)] px-3 py-1.5", active ? "bg-surface text-ink shadow-soft" : "text-ink-2 hover:text-ink"),
          item.disabled && "pointer-events-none opacity-40",
        );
        const content = (
          <>
            {item.icon}
            {item.label}
          </>
        );
        return item.href ? (
          <Link key={item.value} href={item.href} role="tab" aria-selected={active} className={cls}>
            {content}
          </Link>
        ) : (
          <button key={item.value} type="button" role="tab" aria-selected={active} className={cls} onClick={() => onValueChange?.(item.value)}>
            {content}
          </button>
        );
      })}
    </div>
  );
}
