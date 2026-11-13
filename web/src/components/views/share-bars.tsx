import type { AppLocale } from "@/lib/db/types";
import { formatPercent } from "@/lib/metrics";

/** Barres horizontales de parts (villes, pays). */
export function ShareBars({ items, locale, digits = 1 }: { items: { label: string; share: number; icon?: React.ReactNode }[]; locale: AppLocale; digits?: number }) {
  const max = Math.max(...items.map((i) => i.share), 0.0001);
  return (
    <ul className="space-y-3">
      {items.map((i, idx) => (
        <li key={i.label} className="text-[13px]">
          <div className="flex items-center justify-between gap-3">
            <span className="flex min-w-0 items-center gap-2 text-ink">
              <span className="tabular w-4 text-right text-xs text-ink-3">{idx + 1}</span>
              {i.icon}
              <span className="truncate">{i.label}</span>
            </span>
            <span className="tabular font-semibold text-ink">{formatPercent(i.share, locale, digits)}</span>
          </div>
          <div className="mt-1.5 ml-6 h-2 overflow-hidden rounded-full bg-surface-2">
            <div className="h-full rounded-full bg-orbit-gradient transition-[width] duration-700 starting:w-0" style={{ width: `${(i.share / max) * 100}%` }} />
          </div>
        </li>
      ))}
    </ul>
  );
}
