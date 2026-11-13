import { getLocale, getTranslations } from "next-intl/server";
import { ExternalLink, ImageOff } from "lucide-react";
import { PeriodNote } from "@/components/views/period-note";
import { Avatar, Badge, EmptyState } from "@/components/ui";
import { requireBrand } from "@/lib/auth/guards";
import { getPageFilters, getPosts, type PageSearchParams } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";
import { formatCompact, formatPercent, INTL_LOCALE } from "@/lib/metrics";

/** Publications d'une marque. Point de départ — propriété : front (filtres, tri, export CSV). */
export default async function BrandPostsPage({ params, searchParams }: { params: Promise<{ brandId: string }>; searchParams: PageSearchParams }) {
  const { brandId } = await params;
  const { brand } = await requireBrand(brandId, "posts");
  const filters = await getPageFilters(searchParams, brand.id);
  const posts = await getPosts(brand.id, { range: filters.range, networks: filters.networks, sort: "date", limit: 60 });
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;

  return (
    <div className="space-y-6">
      <PeriodNote range={filters.range} previous={null} />
      {posts.length === 0 ? (
        <EmptyState icon={<ImageOff size={22} />} title={t("posts.empty")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4">
          {posts.map((p) => (
            <article key={p.id} className="group overflow-hidden rounded-card border border-line/70 bg-surface shadow-card transition-shadow hover:shadow-pop">
              <div className="relative aspect-square bg-surface-2">
                {p.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnailUrl} alt="" loading="lazy" className="h-full w-full object-cover" />
                ) : (
                  <div className="flex h-full items-center justify-center p-6 text-center text-sm text-ink-2">{p.caption}</div>
                )}
                <div className="absolute top-3 left-3 flex items-center gap-2">
                  <Badge className="bg-white/90 text-ink shadow-soft backdrop-blur">{t(`format.${p.format}`)}</Badge>
                </div>
                {p.permalink && (
                  <a href={p.permalink} target="_blank" rel="noreferrer" className="absolute top-3 right-3 rounded-full bg-white/90 p-1.5 text-ink-2 opacity-0 shadow-soft transition-opacity group-hover:opacity-100" aria-label="Ouvrir">
                    <ExternalLink size={14} />
                  </a>
                )}
              </div>
              <div className="space-y-3 p-4">
                <div className="flex items-center gap-2">
                  <Avatar src={p.account.avatarUrl} name={p.account.name ?? ""} color={brand.color} size="xs" network={p.network} />
                  <span className="truncate text-xs font-medium text-ink-2">{p.account.handle}</span>
                  <time className="ml-auto text-xs text-ink-3">
                    {new Date(p.publishedAt).toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "short", timeZone: "America/Martinique" })}
                  </time>
                </div>
                <p className="line-clamp-2 text-[13px] text-ink">{p.caption}</p>
                <dl className="tabular grid grid-cols-3 gap-2 border-t border-line pt-3 text-center">
                  <div>
                    <dt className="text-[11px] text-ink-3">{t("kpi.reach.label")}</dt>
                    <dd className="text-sm font-semibold">{p.metrics.reach != null ? formatCompact(p.metrics.reach, locale) : "—"}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-ink-3">{t("kpi.interactions.label")}</dt>
                    <dd className="text-sm font-semibold">{formatCompact(p.metrics.interactions, locale)}</dd>
                  </div>
                  <div>
                    <dt className="text-[11px] text-ink-3">{t("kpi.engagementRate.label")}</dt>
                    <dd className="text-sm font-semibold text-orbit-700">{p.metrics.engagementRate != null ? formatPercent(p.metrics.engagementRate, locale, 1) : "—"}</dd>
                  </div>
                </dl>
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
