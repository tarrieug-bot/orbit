import { cn } from "@/lib/utils";

export interface TooltipProps {
  content: React.ReactNode;
  children: React.ReactNode;
  side?: "top" | "bottom" | "left" | "right";
  className?: string;
}

const SIDES = {
  top: "bottom-full left-1/2 mb-2 -translate-x-1/2",
  bottom: "top-full left-1/2 mt-2 -translate-x-1/2",
  left: "right-full top-1/2 mr-2 -translate-y-1/2",
  right: "left-full top-1/2 ml-2 -translate-y-1/2",
} as const;

/**
 * Infobulle CSS (survol + focus clavier), sans JS. Le contenu est aussi lisible
 * par les lecteurs d'écran (role="tooltip").
 */
export function Tooltip({ content, children, side = "top", className }: TooltipProps) {
  return (
    <span className={cn("group/tt relative inline-flex", className)}>
      {children}
      <span
        role="tooltip"
        className={cn(
          "pointer-events-none absolute z-50 w-max max-w-64 rounded-[8px] bg-[#1a1917] px-2.5 py-1.5 text-xs leading-snug font-medium text-white opacity-0 shadow-pop transition-opacity duration-150",
          "group-hover/tt:opacity-100 group-focus-within/tt:opacity-100 group-hover/tt:delay-150",
          "dark:bg-[#f2f1ed] dark:text-[#1a1917]",
          SIDES[side],
        )}
      >
        {content}
      </span>
    </span>
  );
}
