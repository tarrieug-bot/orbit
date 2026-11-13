import { Avatar, NetworkIcon } from "@/components/ui";
import type { AccountSummary, BrandSummary } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";
import { formatCompact } from "@/lib/metrics";

/**
 * Bandeau d'en-tête d'une marque : photo, nom, secteur et chaque compte
 * (avatar + logo réseau + handle + abonnés).
 */
export function BrandHero({
  brand,
  accounts,
  followers,
  locale,
  followersLabel,
  children,
}: {
  brand: Pick<BrandSummary, "name" | "sector" | "color" | "avatarUrl">;
  accounts: AccountSummary[];
  /** abonnés par compte en fin de période (sinon followersCount du compte) */
  followers?: Record<string, number>;
  locale: AppLocale;
  followersLabel: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className="relative overflow-hidden rounded-card border border-line/70 bg-surface shadow-card transition duration-500 starting:translate-y-1 starting:opacity-0"
      style={{ "--brand": brand.color } as React.CSSProperties}
    >
      <div
        aria-hidden
        className="absolute inset-0 opacity-[0.13]"
        style={{ background: `radial-gradient(120% 140% at 0% 0%, ${brand.color} 0%, transparent 55%), radial-gradient(80% 120% at 100% 100%, #8B5CF6 0%, transparent 60%)` }}
      />
      <div aria-hidden className="absolute inset-x-0 top-0 h-1" style={{ background: `linear-gradient(90deg, ${brand.color}, #8B5CF6)` }} />
      <div className="relative flex flex-col gap-5 p-5 md:flex-row md:items-center md:p-6">
        <div className="flex min-w-0 items-center gap-4">
          <Avatar src={brand.avatarUrl} name={brand.name} color={brand.color} size="xl" shape="rounded" className="shadow-pop" />
          <div className="min-w-0">
            <h2 className="truncate text-2xl font-semibold tracking-tight text-ink">{brand.name}</h2>
            {brand.sector && <p className="text-sm text-ink-2">{brand.sector}</p>}
            {children}
          </div>
        </div>
        <ul className="flex flex-wrap gap-2.5 md:ml-auto md:justify-end">
          {accounts.map((a) => (
            <li key={a.id} className="flex items-center gap-3 rounded-2xl border border-line/70 bg-surface/80 py-2 pr-4 pl-2 shadow-soft backdrop-blur">
              <Avatar src={a.avatarUrl} name={a.name ?? a.handle ?? brand.name} color={brand.color} size="md" network={a.network} />
              <div className="min-w-0">
                <div className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
                  <NetworkIcon network={a.network} size={13} />
                  <span className="max-w-[180px] truncate">{a.handle ?? a.name}</span>
                </div>
                <div className="tabular text-xs text-ink-2">
                  <b className="font-semibold text-ink">{formatCompact(followers?.[a.id] ?? a.followersCount ?? 0, locale)}</b> {followersLabel}
                </div>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
