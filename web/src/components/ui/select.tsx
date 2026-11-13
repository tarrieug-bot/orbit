import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  icon?: React.ReactNode;
  wrapperClassName?: string;
}

/** Liste déroulante native stylée (accessible, fonctionne sans JS). */
export function Select({ icon, className, wrapperClassName, children, ...props }: SelectProps) {
  return (
    <span className={cn("relative inline-flex items-center", wrapperClassName)}>
      {icon && <span className="pointer-events-none absolute left-2.5 text-ink-3">{icon}</span>}
      <select
        className={cn(
          "h-9 appearance-none rounded-control border border-line bg-surface pr-8 text-sm font-medium text-ink shadow-soft transition-colors",
          "hover:border-line-strong focus:border-orbit-400 focus:shadow-glow focus:outline-none",
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
