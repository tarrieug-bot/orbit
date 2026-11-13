import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: React.ReactNode;
  wrapperClassName?: string;
  /** taille du contrôle */
  controlSize?: "sm" | "md";
}

/** Liste déroulante native stylée (accessible, fonctionne sans JS). */
export function Select({ icon, className, wrapperClassName, controlSize = "md", children, ...props }: SelectProps) {
  return (
    <span className={cn("relative inline-flex items-center", wrapperClassName)}>
      {icon && <span className="pointer-events-none absolute left-2.5 flex text-ink-3">{icon}</span>}
      <select
        className={cn(
          "w-full cursor-pointer appearance-none rounded-control border border-line bg-surface pr-8 font-medium text-ink shadow-soft transition-[border-color,box-shadow]",
          "hover:border-line-strong focus:border-orbit-400 focus:shadow-glow focus:outline-none disabled:cursor-not-allowed disabled:opacity-50",
          controlSize === "sm" ? "h-8 text-[13px]" : "h-9 text-sm",
          icon ? "pl-8" : "pl-3",
          className,
        )}
        {...props}
      >
        {children}
      </select>
      <ChevronDown size={15} className="pointer-events-none absolute right-2.5 text-ink-3" />
    </span>
  );
}

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  icon?: React.ReactNode;
  wrapperClassName?: string;
  /** élément à droite (raccourci clavier, bouton) */
  trailing?: React.ReactNode;
}

/** Champ texte stylé (recherche, e-mail…). */
export function Input({ icon, wrapperClassName, trailing, className, ...props }: InputProps) {
  return (
    <span
      className={cn(
        "flex h-9 items-center gap-2 rounded-control border border-line bg-surface px-3 shadow-soft transition-[border-color,box-shadow] focus-within:border-orbit-400 focus-within:shadow-glow hover:border-line-strong",
        wrapperClassName,
      )}
    >
      {icon && <span className="flex shrink-0 text-ink-3 [&>svg]:h-4 [&>svg]:w-4">{icon}</span>}
      <input className={cn("h-full w-full min-w-0 bg-transparent text-sm text-ink placeholder:text-ink-3 focus:outline-none", className)} {...props} />
      {trailing}
    </span>
  );
}

/** Raccourci clavier (ex. ⌘K). */
export function Kbd({ children, className }: { children: React.ReactNode; className?: string }) {
  return <kbd className={cn("inline-flex h-5 min-w-5 items-center justify-center rounded-[5px] border border-line bg-surface-2 px-1 font-sans text-[10.5px] font-medium text-ink-3", className)}>{children}</kbd>;
}
