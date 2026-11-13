import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Megaphone } from "lucide-react";
import { Badge, Card, EmptyState } from "@/components/ui";
import { resolveBrandParam } from "@/lib/auth/guards";
import { getCampaigns, type PageSearchParams } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";
import { formatRange } from "@/lib/metrics";

/** Campagnes. Point de départ — propriété : front (création, résultats vs période précédente). */
export default async function CampaignsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const brand = await resolveBrandParam((await searchParams).brand, "campaigns");
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const campaigns = brand ? await getCampaigns(brand.id) : [];
  if (!brand || !campaigns.length) return <EmptyState icon={<Megaphone size={22} />} title={t("campaigns.empty")} />;
  const tone = { running: "positive", upcoming: "info", finished: "neutral" } as const;
  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {campaigns.map((c) => (
        <Card key={c.id} className="overflow-hidden">
          <div className="h-1.5" style={{ background: c.color ?? brand.color }} />
          <div className="space-y-3 p-5">
            <div className="flex items-start justify-between gap-3">
              <h3 className="font-semibold text-ink">{c.name}</h3>
              <Badge tone={tone[c.status]} dot>
                {t(`campaigns.status.${c.status}`)}
              </Badge>
            </div>
            <p className="text-sm text-ink-2">{formatRange(c.range, locale)}</p>
            {c.description && <p className="text-[13px] text-ink-2">{c.description}</p>}
            <div className="flex flex-wrap gap-1.5">
              {c.hashtags.map((h) => (
                <Badge key={h} tone="brand">{h}</Badge>
              ))}
            </div>
            <Link href={`/brands/${brand.id}?period=campaign&campaign=${c.id}`} className="inline-block text-sm font-medium text-orbit-700 hover:underline">
              {t("nav.analytics")} →
            </Link>
          </div>
        </Card>
      ))}
    </div>
  );
}
