"use client";

import { useEffect, useRef } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children?: React.ReactNode;
  /** boutons d'action (alignés à droite) */
  footer?: React.ReactNode;
  size?: "sm" | "md" | "lg";
  /** libellé accessible du bouton de fermeture */
  closeLabel?: string;
  className?: string;
}

/** Utilise <dialog> natif : focus piégé, Échap, fond (::backdrop). */
function useDialog(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    if (!open && d.open) d.close();
  }, [open]);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    const onCancel = (e: Event) => {
      e.preventDefault();
      onClose();
    };
    d.addEventListener("cancel", onCancel);
    return () => d.removeEventListener("cancel", onCancel);
  }, [onClose]);
  const onBackdrop = (e: React.MouseEvent<HTMLDialogElement>) => {
    if (e.target === e.currentTarget) onClose();
  };
  return { ref, onBackdrop };
}

const MODAL_W = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-3xl" } as const;

export function Modal({ open, onClose, title, description, children, footer, size = "md", closeLabel = "×", className }: ModalProps) {
  const { ref, onBackdrop } = useDialog(open, onClose);
  return (
    <dialog
      ref={ref}
      onClick={onBackdrop}
      className={cn(
        "m-auto w-[calc(100%-2rem)] rounded-[18px] border border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-[#0e0e0d]/45 backdrop:backdrop-blur-[2px] open:animate-pop-in",
        MODAL_W[size],
        className,
      )}
    >
      {open && (
        <div className="flex max-h-[85dvh] flex-col">
          <DialogHeader title={title} description={description} onClose={onClose} closeLabel={closeLabel} />
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line bg-surface-2 px-6 py-3.5">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

export interface SheetProps extends Omit<ModalProps, "size"> {
  side?: "right" | "left" | "bottom";
  width?: number;
}

/** Panneau latéral (détail d'une publication, filtres sur mobile, navigation mobile). */
export function Sheet({ open, onClose, title, description, children, footer, side = "right", width = 440, closeLabel = "×", className }: SheetProps) {
  const { ref, onBackdrop } = useDialog(open, onClose);
  return (
    <dialog
      ref={ref}
      onClick={onBackdrop}
      className={cn(
        "fixed m-0 max-h-none max-w-none border-line bg-surface p-0 text-ink shadow-pop backdrop:bg-[#0e0e0d]/45 backdrop:backdrop-blur-[2px]",
        side === "right" && "top-0 right-0 left-auto h-dvh w-full border-l open:animate-slide-in-right",
        side === "left" && "top-0 left-0 h-dvh w-full border-r open:animate-slide-in-left",
        side === "bottom" && "top-auto bottom-0 left-0 max-h-[85dvh] w-full rounded-t-[20px] border-t open:animate-toast-in",
        className,
      )}
      style={side === "bottom" ? undefined : { maxWidth: width }}
    >
      {open && (
        <div className="flex h-full flex-col">
          <DialogHeader title={title} description={description} onClose={onClose} closeLabel={closeLabel} />
          <div className="min-h-0 flex-1 overflow-y-auto px-6 pb-6">{children}</div>
          {footer && <div className="flex justify-end gap-2 border-t border-line px-6 py-3.5">{footer}</div>}
        </div>
      )}
    </dialog>
  );
}

function DialogHeader({ title, description, onClose, closeLabel }: { title?: React.ReactNode; description?: React.ReactNode; onClose: () => void; closeLabel: string }) {
  return (
    <div className="flex items-start gap-4 px-6 pt-5 pb-4">
      <div className="min-w-0 flex-1">
        {title && <h2 className="text-base font-semibold tracking-tight">{title}</h2>}
        {description && <p className="mt-1 text-[13px] text-ink-2">{description}</p>}
      </div>
      <button type="button" onClick={onClose} aria-label={closeLabel} className="-mr-2 rounded-control p-1.5 text-ink-3 hover:bg-surface-3 hover:text-ink">
        <X size={17} aria-hidden />
      </button>
    </div>
  );
}
