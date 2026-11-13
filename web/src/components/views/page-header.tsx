import { cn } from "@/lib/utils";

/** Titre de section de page (h2) avec description et actions. */
export function PageHeader({ title, description, actions, className }: { title: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3", className)}>
      <div className="min-w-0">
        <h2 className="text-xl font-semibold tracking-tight text-ink">{title}</h2>
        {description && <p className="mt-0.5 text-sm text-ink-2">{description}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Conserve les filtres globaux (période, réseaux, comparaison) dans un lien. */
export const FILTER_KEYS = ["period", "from", "to", "nets", "compare", "campaign"] as const;

export function filterQuery(sp: Record<string, string | string[] | undefined>, extra?: Record<string, string | null | undefined>, keep: readonly string[] = FILTER_KEYS): string {
  const out = new URLSearchParams();
  for (const k of keep) {
    const v = sp[k];
    const s = Array.isArray(v) ? v[0] : v;
    if (s) out.set(k, s);
  }
  for (const [k, v] of Object.entries(extra ?? {})) {
    if (v == null) out.delete(k);
    else out.set(k, v);
  }
  const q = out.toString();
  return q ? `?${q}` : "";
}
