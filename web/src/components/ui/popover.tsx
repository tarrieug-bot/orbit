"use client";

import { useEffect, useId, useRef, useState } from "react";
import { cn } from "@/lib/utils";

export interface PopoverProps {
  /** rendu du déclencheur ; reçoit l'état et les props ARIA à poser sur le bouton */
  trigger: (state: { open: boolean; toggle: () => void; props: { "aria-expanded": boolean; "aria-controls": string; "aria-haspopup": "dialog" } }) => React.ReactNode;
  children: React.ReactNode | ((close: () => void) => React.ReactNode);
  align?: "start" | "end";
  className?: string;
  /** contrôle externe facultatif */
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

/** Panneau flottant léger (clic extérieur et Échap ferment). */
export function Popover({ trigger, children, align = "start", className, open: controlled, onOpenChange }: PopoverProps) {
  const [inner, setInner] = useState(false);
  const open = controlled ?? inner;
  const setOpen = (v: boolean) => (onOpenChange ? onOpenChange(v) : setInner(v));
  const ref = useRef<HTMLDivElement>(null);
  const id = useId();
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => !ref.current?.contains(e.target as Node) && setOpen(false);
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  });
  const close = () => setOpen(false);
  return (
    <div ref={ref} className="relative inline-flex">
      {trigger({ open, toggle: () => setOpen(!open), props: { "aria-expanded": open, "aria-controls": id, "aria-haspopup": "dialog" } })}
      {open && (
        <div id={id} role="dialog" className={cn("absolute top-full z-50 mt-2 min-w-56 rounded-[14px] border border-line bg-surface p-1.5 shadow-pop animate-pop-in", align === "end" ? "right-0" : "left-0", className)}>
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}
