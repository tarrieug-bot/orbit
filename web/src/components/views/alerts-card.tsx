import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, PartyPopper, TrendingDown, TrendingUp } from "lucide-react";
import { Avatar, Card, CardHeader, NetworkIcon } from "@/components/ui";
import type { BrandSummary } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";
import { formatPercent, formatSignedNumber, formatSignedPercent, type Alert } from "@/lib/metrics";
import { cn } from "@/lib/utils";

const ORDER: Record<Alert["tone"], number> = { negative: 0, warning: 1, positive: 2 };

/** « Points d'attention » détectés automatiquement (detectAlerts). */
export async function AlertsCard({ alerts, brands, query, limit = 8 }: { alerts: Alert[]; brands: BrandSummary[]; query: string; limit?: number }) {
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const byId = new Map(brands.map((b) => [b.id, b]));
  const list = [...alerts].sort((a, b) => ORDER[a.tone] - ORDER[b.tone]).slice(0, limit);
  return (
    <Card className="flex flex-col">
      <CardHeader title={t("alerts.title")} description={t("alerts.subtitle")} />
      {list.length === 0 ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 px-5 pb-8 text-center text-sm text-ink-2">
          <span className="flex h-10 w-10 items-center justify-center rounded-full bg-positive-soft text-positive"><PartyPopper size={18} /></span>
          {t("alerts.none")}
        </div>
      ) : (
        <ul className="space-y-1 px-3 pb-4">
          {list.map((a, i) => {
            const brand = byId.get(a.brandId);
            const account = brand?.accounts.find((x) => x.id === a.accountId);
            const Icon = a.tone === "positive" ? TrendingUp : a.tone === "negative" ? TrendingDown : AlertTriangle;
            return (
              <li key={`${a.accountId}-${a.kind}-${i}`}>
                <Link href={`/brands/${a.brandId}${query}`} className="flex items-start gap-3 rounded-control px-2 py-2.5 transition-colors hover:bg-surface-2 focus-visible:shadow-glow focus-visible:outline-none">
                  <Avatar src={account?.avatarUrl ?? brand?.avatarUrl} name={brand?.name ?? ""} color={brand?.color} size="md" network={a.network} />
                  <span className="min-w-0 flex-1 text-[13px] leading-snug text-ink-2">
                    <span className="flex items-center gap-1.5">
                      <b className="truncate font-semibold text-ink">{brand?.name}</b>
                      <NetworkIcon network={a.network} size={12} />
                    </span>
                    {t(`alerts.${a.kind}`, {
                      network: t(`network.${a.network}`),
                      net: formatSignedNumber(a.values.net ?? 0, locale),
                      current: formatPercent(a.values.current ?? 0, locale, 2),
                      previous: formatPercent(a.values.previous ?? 0, locale, 2),
                      ratio: formatSignedPercent(a.values.ratio ?? 0, locale, 0),
                      days: a.values.days ?? 0,
                    })}
                  </span>
                  <span className={cn("mt-1 flex h-6 w-6 shrink-0 items-center justify-center rounded-full", a.tone === "positive" ? "bg-positive-soft text-positive" : a.tone === "negative" ? "bg-negative-soft text-negative" : "bg-warning-soft text-warning")}>
                    <Icon size={13} aria-hidden />
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </Card>
  );
}
