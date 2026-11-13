import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "outline";
type Size = "sm" | "md" | "lg" | "icon";

const VARIANTS: Record<Variant, string> = {
  primary: "bg-orbit-gradient text-white shadow-soft hover:brightness-110 active:brightness-95",
  secondary: "bg-surface text-ink border border-line shadow-soft hover:bg-surface-2 hover:border-line-strong",
  outline: "border border-orbit-200 text-orbit-700 hover:bg-orbit-50",
  ghost: "text-ink-2 hover:bg-ink/5 hover:text-ink",
  danger: "bg-negative text-white hover:brightness-110",
};
const SIZES: Record<Size, string> = {
  sm: "h-8 px-3 text-xs gap-1.5",
  md: "h-9 px-4 text-sm gap-2",
  lg: "h-11 px-5 text-sm gap-2",
  icon: "h-9 w-9 justify-center",
};

/** Classes d'un bouton — à utiliser aussi sur <Link> : <Link className={buttonVariants()}>. */
export function buttonVariants({ variant = "secondary", size = "md", className }: { variant?: Variant; size?: Size; className?: string } = {}) {
  return cn(
    "inline-flex items-center font-medium rounded-control transition-all duration-150 select-none whitespace-nowrap",
    "focus-visible:outline-none focus-visible:shadow-glow disabled:opacity-50 disabled:pointer-events-none",
    VARIANTS[variant],
    SIZES[size],
    className,
  );
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

export function Button({ variant, size, className, type = "button", ...props }: ButtonProps) {
  return <button type={type} className={buttonVariants({ variant, size, className })} {...props} />;
}
