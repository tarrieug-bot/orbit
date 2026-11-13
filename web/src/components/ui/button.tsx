import { Loader2 } from "lucide-react";
import { FaFacebook } from "react-icons/fa6";
import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline" | "facebook" | "subtle";
type Size = "xs" | "sm" | "md" | "lg" | "icon" | "icon-sm";

const VARIANTS: Record<Variant, string> = {
  primary:
    "bg-orbit-gradient text-white shadow-[0_1px_2px_rgb(26_25_23/0.12),inset_0_1px_0_rgb(255_255_255/0.18)] hover:brightness-110 active:brightness-95",
  secondary: "bg-surface text-ink border border-line shadow-soft hover:bg-surface-2 hover:border-line-strong",
  outline: "border border-orbit-200 text-orbit-700 hover:bg-orbit-50",
  subtle: "bg-surface-3 text-ink hover:bg-line",
  ghost: "text-ink-2 hover:bg-surface-3 hover:text-ink",
  danger: "bg-negative text-white hover:brightness-110",
  /** « Continuer avec Facebook » : bleu officiel, logo blanc */
  facebook: "bg-[#1877F2] text-white shadow-[0_1px_2px_rgb(24_119_242/0.3),inset_0_1px_0_rgb(255_255_255/0.15)] hover:bg-[#166FE5] active:bg-[#1464D1]",
};
const SIZES: Record<Size, string> = {
  xs: "h-7 px-2.5 text-xs gap-1",
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-3.5 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
  icon: "h-9 w-9 justify-center",
  "icon-sm": "h-8 w-8 justify-center",
};

/** Classes d'un bouton — à utiliser aussi sur <Link> : <Link className={buttonVariants()}>. */
export function buttonVariants({ variant = "secondary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    "inline-flex items-center justify-center font-medium rounded-control transition-[background-color,border-color,box-shadow,filter,color] duration-150 select-none whitespace-nowrap cursor-pointer",
    "focus-visible:outline-none focus-visible:shadow-glow disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  /** affiche un indicateur de chargement et désactive le bouton */
  loading?: boolean;
  /** icône avant le libellé (le variant « facebook » affiche le logo par défaut) */
  icon?: React.ReactNode;
}

export function Button({ variant, size, className, type = "button", loading, icon, children, disabled, ...props }: ButtonProps) {
  const lead = loading ? <Loader2 size={16} className="animate-spin" aria-hidden /> : icon ?? (variant === "facebook" ? <FaFacebook size={18} aria-hidden /> : null);
  return (
    <button type={type} className={buttonVariants({ variant, size, className })} disabled={disabled || loading} aria-busy={loading || undefined} {...props}>
      {lead}
      {children}
    </button>
  );
}
