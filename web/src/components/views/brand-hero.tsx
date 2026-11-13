import { BrandHero as UiBrandHero, type BrandHeroStat } from "@/components/ui";
import type { AccountSummary, BrandSummary } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";
import { formatCompact } from "@/lib/metrics";

/**
 * Bandeau d'en-tête d'une marque (BrandHero du design system) : photo, nom,
 * secteur et chaque compte (avatar + logo réseau + handle + abonnés).
 */
export function BrandHero({
  brand,
  accounts,
  followers,
  locale,
  followersLabel,
  eyebrow,
  stats,
  actions,
  size = "md",
  children,
}: {
  brand: Pick<BrandSummary, "name" | "sector" | "color" | "avatarUrl">;
  accounts: AccountSummary[];
  /** abonnés par compte en fin de période (sinon followersCount du compte) */
  followers?: Record<string, number>;
  locale: AppLocale;
  followersLabel: string;
  eyebrow?: React.ReactNode;
  stats?: BrandHeroStat[];
  actions?: React.ReactNode;
  size?: "md" | "lg";
  children?: React.ReactNode;
}) {
  return (
    <UiBrandHero
      name={brand.name}
      avatarUrl={brand.avatarUrl}
      color={brand.color}
      sector={brand.sector}
      eyebrow={eyebrow}
      stats={stats}
      actions={actions}
      size={size}
      className="transition duration-500 starting:translate-y-1 starting:opacity-0"
      accounts={accounts.map((a) => ({
        id: a.id,
        network: a.network,
        handle: a.handle,
        name: a.name,
        avatarUrl: a.avatarUrl,
        followers: formatCompact(followers?.[a.id] ?? a.followersCount ?? 0, locale),
        followersLabel,
        status: a.status,
      }))}
    >
      {children}
    </UiBrandHero>
  );
}
