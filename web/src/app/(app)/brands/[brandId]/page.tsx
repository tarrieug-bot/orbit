import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { KpiGrid } from "@/components/views/kpi-grid";
import { PeriodNote } from "@/components/views/period-note";
import { Card, CardContent, CardHeader, NetworkIcon, TrendChart } from "@/components/ui";
import { requireBrand } from "@/lib/auth/guards";
import { getBrandMetrics, getPageFilters, type PageSearchParams } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";
import { autoGranularity, formatCompact, formatPercent, makeBuckets, toChartData } from "@/lib/metrics";

/** Analytics d'une marque. Point de départ — propriété : front. */
export default async function BrandAnalyticsPage({ params, searchParams }: { params: Promise<{ brandId: string }>; searchParams: PageSearchParams }) {
  const { brandId } = await params;
  const { brand } = await requireBrand(brandId, "analytics");
  const filters = await getPageFilters(searchParams, brand.id);
  const data = await getBrandMetrics(brand.id, filters);
  if (!data) notFound();
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;

  const granularity = autoGranularity(data.range);
  const buckets = makeBuckets(data.range, granularity);
  const chart = toChartData(data.series, buckets, ["followers", "reach", "views", "likes", "comments", "shares", "saves"]);

  return (
    <div className="space-y-6">
      <PeriodNote range={data.range} previous={data.previousRange} />
      <KpiGrid totals={data.totals} previous={data.previous} series={data.series} color={brand.color} keys={["followers", "followersGained", "reach", "views", "interactions", "engagementRate", "profileVisits", "linkClicks"]} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("analytics.followersEvolution")} description={t(`period.granularity.${granularity}`)} />
          <CardContent>
            <TrendChart data={chart} series={[{ key: "followers", label: t("kpi.followers.label"), color: brand.color }]} granularity={granularity} format="number" locale={locale} yDomain="auto" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title={t("analytics.reachViews")} description={t(`period.granularity.${granularity}`)} />
          <CardContent>
            <TrendChart
              data={chart}
              series={[
                { key: "reach", label: t("kpi.reach.label"), color: "#6366F1" },
                { key: "views", label: t("kpi.views.label"), color: "#C4B5FD" },
              ]}
              granularity={granularity}
              locale={locale}
            />
          </CardContent>
        </Card>
        <Card className="lg:col-span-2">
          <CardHeader title={t("analytics.interactionsByType")} description={t(`period.granularity.${granularity}`)} />
          <CardContent>
            <TrendChart
              type="bar"
              stacked
              data={chart}
              series={[
                { key: "likes", label: t("kpi.likes.label"), color: "#6366F1" },
                { key: "comments", label: t("kpi.comments.label"), color: "#A855F7" },
                { key: "shares", label: t("kpi.shares.label"), color: "#EC4899" },
                { key: "saves", label: t("kpi.saves.label"), color: "#F59E0B" },
              ]}
              granularity={granularity}
              locale={locale}
            />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader title={t("analytics.byNetwork")} />
        <div className="grid gap-px overflow-hidden rounded-b-card border-t border-line bg-line sm:grid-cols-2">
          {data.byNetwork.map((n) => (
            <div key={n.network} className="flex items-center gap-4 bg-surface px-5 py-4">
              <NetworkIcon network={n.network} variant="badge" size={36} />
              <div className="tabular grid flex-1 grid-cols-3 gap-2 text-sm">
                <Stat label={t("kpi.followers.label")} value={formatCompact(n.totals.followers, locale)} />
                <Stat label={t("kpi.reach.label")} value={formatCompact(n.totals.reach, locale)} />
                <Stat label={t("kpi.engagementRate.label")} value={formatPercent(n.totals.engagementRate, locale, 2)} />
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-xs text-ink-3">{label}</div>
      <div className="font-semibold text-ink">{value}</div>
    </div>
  );
}
