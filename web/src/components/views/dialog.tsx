"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Boîte de dialogue modale (élément <dialog> natif : piège du focus, Échap,
 * arrière-plan). Manquante dans @/components/ui — à reprendre par le design.
 */
export function Dialog({
  open,
  onClose,
  title,
  description,
  children,
  closeLabel,
  className,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  description?: string;
  children: React.ReactNode;
  closeLabel: string;
  className?: string;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => e.target === ref.current && onClose()}
      aria-labelledby="dialog-title"
      className={cn(
        "m-auto w-[calc(100%-2rem)] max-w-lg rounded-[20px] border border-line/70 bg-surface p-0 text-ink shadow-pop backdrop:bg-ink/40 backdrop:backdrop-blur-sm",
        "opacity-100 transition-[opacity,translate] duration-200 starting:translate-y-2 starting:opacity-0",
        className,
      )}
    >
      {open && (
        <div className="max-h-[85dvh] overflow-y-auto p-6">
          <div className="mb-5 flex items-start justify-between gap-4">
            <div>
              <h2 id="dialog-title" className="text-lg font-semibold tracking-tight">{title}</h2>
              {description && <p className="mt-1 text-sm text-ink-2">{description}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label={closeLabel} className="-mt-1 -mr-1 rounded-control p-1.5 text-ink-3 transition-colors hover:bg-ink/5 hover:text-ink focus-visible:shadow-glow focus-visible:outline-none">
              <X size={18} />
            </button>
          </div>
          {children}
        </div>
      )}
    </dialog>
  );
}
