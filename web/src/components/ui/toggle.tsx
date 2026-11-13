"use client";

import { cn } from "@/lib/utils";

export interface ToggleProps {
  checked: boolean;
  onCheckedChange?: (checked: boolean) => void;
  label?: React.ReactNode;
  description?: React.ReactNode;
  disabled?: boolean;
  size?: "sm" | "md";
  /** apparence « contrôle » (cadre comme un bouton secondaire) pour les barres d'outils */
  framed?: boolean;
  className?: string;
  name?: string;
}

/** Interrupteur accessible (role="switch"). */
export function Toggle({ checked, onCheckedChange, label, description, disabled, size = "md", framed, className, name }: ToggleProps) {
  const track = size === "sm" ? "h-4 w-7" : "h-5 w-9";
  const knob = size === "sm" ? "h-3 w-3" : "h-4 w-4";
  const shift = size === "sm" ? "translate-x-3" : "translate-x-4";
  return (
    <label
      className={cn(
        "inline-flex cursor-pointer items-center gap-2.5 select-none",
        framed && "h-9 rounded-control border border-line bg-surface px-3 shadow-soft hover:border-line-strong",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <button
        type="button"
        role="switch"
        name={name}
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onCheckedChange?.(!checked)}
        className={cn("relative inline-flex shrink-0 items-center rounded-full p-0.5 transition-colors duration-200 focus-visible:shadow-glow focus-visible:outline-none", track, checked ? "bg-orbit-600" : "bg-line-strong")}
      >
        <span className={cn("rounded-full bg-white shadow-[0_1px_2px_rgb(0_0_0/0.25)] transition-transform duration-200", knob, checked && shift)} />
      </button>
      {(label || description) && (
        <span className="min-w-0">
          {label && <span className="block text-sm font-medium text-ink-2">{label}</span>}
          {description && <span className="block text-xs text-ink-3">{description}</span>}
        </span>
      )}
    </label>
  );
}
