"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import { Monitor, Moon, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

export type ThemePreference = "light" | "dark" | "system";
import { THEME_STORAGE_KEY as KEY } from "./theme-script";

function readPref(): ThemePreference {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "system";
  } catch {
    return "system";
  }
}

function apply(pref: ThemePreference) {
  const dark = pref === "dark" || (pref === "system" && window.matchMedia("(prefers-color-scheme: dark)").matches);
  document.documentElement.dataset.theme = dark ? "dark" : "light";
}

const listeners = new Set<() => void>();
function subscribe(cb: () => void) {
  listeners.add(cb);
  const mq = window.matchMedia("(prefers-color-scheme: dark)");
  const onSys = () => {
    if (readPref() === "system") apply("system");
    cb();
  };
  mq.addEventListener("change", onSys);
  window.addEventListener("storage", cb);
  return () => {
    listeners.delete(cb);
    mq.removeEventListener("change", onSys);
    window.removeEventListener("storage", cb);
  };
}

/** Préférence de thème (clair / sombre / système) et thème effectif. */
export function useTheme() {
  const preference = useSyncExternalStore(subscribe, readPref, () => "system" as ThemePreference);
  const resolved = useSyncExternalStore(
    subscribe,
    () => (document.documentElement.dataset.theme === "dark" ? "dark" : "light"),
    () => "light" as const,
  );
  const setPreference = useCallback((p: ThemePreference) => {
    try {
      if (p === "system") localStorage.removeItem(KEY);
      else localStorage.setItem(KEY, p);
    } catch {
      /* stockage indisponible : thème appliqué pour la session */
    }
    apply(p);
    listeners.forEach((l) => l());
  }, []);
  useEffect(() => {
    if (!document.documentElement.dataset.theme) apply(readPref());
  }, []);
  return { preference, resolved, setPreference };
}

export interface ThemeToggleProps {
  /** libellés accessibles (i18n) */
  labels?: { light: string; dark: string; system: string };
  /** apparence sur fond sombre (barre latérale) */
  tone?: "default" | "sidebar";
  className?: string;
}

/** Bascule clair / sombre / système (segmentée, icônes). */
export function ThemeToggle({ labels = { light: "Light", dark: "Dark", system: "System" }, tone = "default", className }: ThemeToggleProps) {
  const { preference, setPreference } = useTheme();
  const opts: { v: ThemePreference; Icon: typeof Sun }[] = [
    { v: "light", Icon: Sun },
    { v: "system", Icon: Monitor },
    { v: "dark", Icon: Moon },
  ];
  return (
    <div role="radiogroup" className={cn("inline-flex gap-0.5 rounded-pill p-0.5", tone === "sidebar" ? "bg-white/5 ring-1 ring-white/5" : "bg-surface-3 ring-1 ring-line/60", className)}>
      {opts.map(({ v, Icon }) => {
        const on = preference === v;
        return (
          <button
            key={v}
            type="button"
            role="radio"
            aria-checked={on}
            aria-label={labels[v]}
            title={labels[v]}
            onClick={() => setPreference(v)}
            className={cn(
              "flex h-6 w-6 items-center justify-center rounded-full transition-colors",
              tone === "sidebar" ? (on ? "bg-white/15 text-white" : "text-sidebar-mute hover:text-white") : on ? "bg-surface text-ink shadow-soft" : "text-ink-3 hover:text-ink",
            )}
          >
            <Icon size={13} aria-hidden />
          </button>
        );
      })}
    </div>
  );
}
