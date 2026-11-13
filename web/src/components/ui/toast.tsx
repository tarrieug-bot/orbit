"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Info, OctagonAlert, X } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StatusKind } from "./badge";

export interface ToastOptions {
  title: React.ReactNode;
  description?: React.ReactNode;
  status?: StatusKind;
  /** ms avant fermeture automatique (0 = jamais). Défaut 5000. */
  duration?: number;
  action?: React.ReactNode;
}
interface ToastEntry extends ToastOptions {
  id: number;
}

const ICONS: Record<StatusKind, typeof Info> = { success: CheckCircle2, warning: AlertTriangle, critical: OctagonAlert, info: Info };
const ICON_TONE: Record<StatusKind, string> = { success: "text-positive", warning: "text-warning", critical: "text-negative", info: "text-info" };

/** Notification seule (utilisable aussi en statique, ex. page /design). */
export function Toast({ title, description, status = "info", action, onClose, closeLabel = "×", className }: ToastOptions & { onClose?: () => void; closeLabel?: string; className?: string }) {
  const Icon = ICONS[status];
  return (
    <div
      role={status === "critical" ? "alert" : "status"}
      className={cn("pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-[14px] border border-line bg-surface p-3.5 shadow-pop animate-toast-in", className)}
    >
      <Icon size={18} className={cn("mt-px shrink-0", ICON_TONE[status])} aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-sm font-semibold text-ink">{title}</p>
        {description && <p className="mt-0.5 text-[13px] text-ink-2">{description}</p>}
        {action && <div className="mt-2.5">{action}</div>}
      </div>
      {onClose && (
        <button type="button" onClick={onClose} aria-label={closeLabel} className="-m-1 rounded-[6px] p-1 text-ink-3 hover:bg-surface-3 hover:text-ink">
          <X size={15} aria-hidden />
        </button>
      )}
    </div>
  );
}

const ToastContext = createContext<{ toast: (t: ToastOptions) => number; dismiss: (id: number) => void } | null>(null);

/** Fournisseur de notifications : <ToastProvider> autour de l'app, puis useToast().toast({...}). */
export function ToastProvider({ children, closeLabel }: { children: React.ReactNode; closeLabel?: string }) {
  const [items, setItems] = useState<ToastEntry[]>([]);
  const seq = useRef(0);
  const dismiss = useCallback((id: number) => setItems((xs) => xs.filter((x) => x.id !== id)), []);
  const toast = useCallback(
    (t: ToastOptions) => {
      const id = ++seq.current;
      setItems((xs) => [...xs.slice(-3), { ...t, id }]);
      const d = t.duration ?? 5000;
      if (d > 0) setTimeout(() => dismiss(id), d);
      return id;
    },
    [dismiss],
  );
  const value = useMemo(() => ({ toast, dismiss }), [toast, dismiss]);
  return (
    <ToastContext.Provider value={value}>
      {children}
      <div aria-live="polite" className="pointer-events-none fixed right-4 bottom-4 z-[100] flex w-[calc(100%-2rem)] max-w-sm flex-col gap-2">
        {items.map((t) => (
          <Toast key={t.id} {...t} closeLabel={closeLabel} onClose={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast() doit être utilisé dans <ToastProvider>");
  return ctx;
}
