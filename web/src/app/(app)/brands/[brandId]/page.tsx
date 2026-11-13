import Link from "next/link";
import { notFound } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { ArrowRight, Megaphone } from "lucide-react";
import { engagementChart, formatPerformance, perAccountChart, postsHeatmap, topPosts } from "@/components/views/analytics-data";
import { BrandHero } from "@/components/views/brand-hero";
import { MetricChart } from "@/components/views/charts";
import { BestTimesHeatmap } from "@/components/views/heatmap";
import { KpiGrid } from "@/components/views/kpi-grid";
import { filterQuery } from "@/components/views/page-header";
import { GAIN_COLOR, INTERACTION_COLORS, LOSS_COLOR, NETWORK_COLOR } from "@/components/views/palette";
import { PeriodNote } from "@/components/views/period-note";
import { SwitchableChartCard } from "@/components/views/switchable-chart";
import { TopPosts } from "@/components/views/top-posts";
import { Badge, buttonVariants, Card, CardContent, CardHeader, EmptyState, NetworkIcon } from "@/components/ui";
import { requireBrand } from "@/lib/auth/guards";
import { getAudience, getBrandMetrics, getCampaigns, getPageFilters, getPosts, type PageSearchParams } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";
import { autoGranularity, bucketSeries, computeTotals, filterRows, formatCompact, formatPercent, KPI_DEFINITIONS, makeBuckets, toChartData } from "@/lib/metrics";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("nav.analytics") };
}

/** Analytics d'une marque. */
export default async function BrandAnalyticsPage({ params, searchParams }: { params: Promise<{ brandId: string }>; searchParams: PageSearchParams }) {
  const { brandId } = await params;
  const { brand } = await requireBrand(brandId, "analytics");
  const sp = await searchParams;
  const filters = await getPageFilters(sp, brand.id);
  const [data, posts, audience, campaigns] = await Promise.all([
    getBrandMetrics(brand.id, filters),
    getPosts(brand.id, { range: filters.range, networks: filters.networks, limit: 500 }),
    getAudience(brand.id),
    getCampaigns(brand.id),
  ]);
  if (!data) notFound();
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const campaign = filters.campaignId ? campaigns.find((c) => c.id === filters.campaignId) : null;

  const followersEnd = Object.fromEntries(data.accounts.map((a) => [a.id, computeTotals(filterRows(data.rows, [a.id]), data.range).followers]));
  const hero = (
    <BrandHero
      brand={brand}
      accounts={data.accounts}
      followers={followersEnd}
      locale={locale}
      size="lg"
      followersLabel={t("kpi.followers.label").toLowerCase()}
      eyebrow={
        campaign ? (
          <Badge tone="brand" icon={<Megaphone size={12} aria-hidden />}>
            {campaign.name}
          </Badge>
        ) : (
          t("nav.analytics")
        )
      }
      stats={[
        { label: t("kpi.followers.label"), value: formatCompact(data.totals.followers, locale) },
        { label: t("kpi.reach.label"), value: formatCompact(data.totals.reach, locale) },
        { label: t("kpi.engagementRate.label"), value: formatPercent(data.totals.engagementRate, locale, 2) },
      ]}
    />
  );

  if (!data.accounts.length) {
    return (
      <div className="space-y-6">
        {hero}
        <EmptyState title={t("analytics.noAccounts")} description={t("analytics.noAccountsHelp")} />
      </div>
    );
  }

  const granularity = autoGranularity(data.range);
  const buckets = makeBuckets(data.range, granularity);
  const per = { granularity: t(`period.granularity.${granularity}`) };
  const accSeries = (metric: string) =>
    data.accounts.map((a) => ({ key: `${metric}:${a.id}`, label: `${t(`network.${a.network}`)}${data.accounts.filter((x) => x.network === a.network).length > 1 ? ` ${a.handle}` : ""}`, color: NETWORK_COLOR[a.network] }));

  const perAcc = perAccountChart(data.rows, data.accounts, data.range, buckets, ["followers", "reach", "views", "profileVisits", "linkClicks"]);
  const totalsChart = toChartData(data.series, buckets, ["likes", "comments", "shares", "saves"]);
  const gained = bucketSeries(data.series, buckets, "followersGained");
  const lost = bucketSeries(data.series, buckets, "followersLost");
  const gainLost = buckets.map((b, i) => ({ key: b.key, gained: gained[i], lost: lost[i] == null ? null : -(lost[i] as number) }));
  const erChart = engagementChart(data.rows, data.accounts, buckets);

  const perf = formatPerformance(posts);
  const formats = [...new Set(perf.map((p) => p.format))];
  const nets = [...new Set(data.accounts.map((a) => a.network))];
  const perfData = (metric: "engagementRate" | "avgReach" | "avgInteractions") =>
    formats.map((f) => ({
      key: t(`format.${f}`),
      ...Object.fromEntries(nets.map((n) => [n, perf.find((p) => p.format === f && p.network === n)?.[metric] ?? null])),
    }));
  const perfSeries = nets.map((n) => ({ key: n, label: t(`network.${n}`), color: NETWORK_COLOR[n] }));

  const top = topPosts(posts, 5);
  const onlineHeat = audience?.onlineHeatmap ?? null;
  const heat = onlineHeat ?? postsHeatmap(posts);
  const q = filterQuery(sp);

  return (
    <div className="space-y-6">
      {hero}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodNote range={data.range} previous={data.previousRange} />
        <div className="flex flex-wrap gap-1.5">
          {data.byNetwork.map((n) => (
            <span key={n.network} className="inline-flex items-center gap-1.5 rounded-pill border border-line bg-surface px-2.5 py-1 text-xs text-ink-2 shadow-soft">
              <NetworkIcon network={n.network} size={13} />
              <span className="tabular">
                <b className="font-semibold text-ink">{formatCompact(n.totals.reach, locale)}</b> {t("kpi.reach.label").toLowerCase()} · <b className="font-semibold text-ink">{formatPercent(n.totals.engagementRate, locale, 2)}</b>
              </span>
            </span>
          ))}
        </div>
      </div>

      <KpiGrid totals={data.totals} previous={data.previous} series={data.series} color={brand.color} columns={5} keys={KPI_DEFINITIONS.map((d) => d.key)} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title={t("analytics.followersEvolution")} description={t("analytics.followersEvolutionHelp", per)} />
          <CardContent>
            <MetricChart data={perAcc} series={accSeries("followers")} granularity={granularity} format="number" locale={locale} yDomain="auto" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title={t("analytics.gainedLost")} description={t("analytics.gainedLostHelp", per)} />
          <CardContent>
            <MetricChart
              type="bar"
              data={gainLost}
              series={[
                { key: "gained", label: t("analytics.gained"), color: GAIN_COLOR, stackId: "g" },
                { key: "lost", label: t("analytics.lost"), color: LOSS_COLOR, stackId: "g" },
              ]}
              granularity={granularity}
              format="absNumber"
              locale={locale}
              zeroLine
            />
          </CardContent>
        </Card>
        <SwitchableChartCard
          title={t("analytics.visibility")}
          description={t("analytics.visibilityHelp", per)}
          locale={locale}
          granularity={granularity}
          options={(["reach", "views", "profileVisits", "linkClicks"] as const).map((m) => ({
            value: m,
            label: t(`analytics.visibilityTabs.${m}`),
            data: perAcc,
            series: accSeries(m),
          }))}
        />
        <Card>
          <CardHeader title={t("analytics.interactionsByType")} description={t("analytics.interactionsByTypeHelp", per)} />
          <CardContent>
            <MetricChart
              type="bar"
              data={totalsChart}
              series={(["likes", "comments", "shares", "saves"] as const).map((k) => ({ key: k, label: t(`kpi.${k}.label`), color: INTERACTION_COLORS[k], stackId: "i" }))}
              granularity={granularity}
              locale={locale}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader title={t("kpi.engagementRate.label")} description={t("analytics.engagementHelp", per)} />
          <CardContent>
            <MetricChart data={erChart} series={accSeries("er")} granularity={granularity} format="percent" locale={locale} />
          </CardContent>
        </Card>
        {formats.length ? (
          <SwitchableChartCard
            title={t("analytics.formats")}
            description={t("analytics.formatsHelp")}
            locale={locale}
            options={[
              { value: "er", label: t("analytics.formatTabs.engagementRate"), type: "bar", xKind: "category", format: "percent", data: perfData("engagementRate"), series: perfSeries },
              { value: "reach", label: t("analytics.formatTabs.reach"), type: "bar", xKind: "category", format: "compact", data: perfData("avgReach"), series: perfSeries },
              { value: "inter", label: t("analytics.formatTabs.interactions"), type: "bar", xKind: "category", format: "number", data: perfData("avgInteractions"), series: perfSeries },
            ]}
          />
        ) : (
          <Card>
            <CardHeader title={t("analytics.formats")} />
            <CardContent><p className="text-sm text-ink-2">{t("posts.empty")}</p></CardContent>
          </Card>
        )}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <Card className="overflow-hidden">
          <CardHeader
            title={t("analytics.topPosts")}
            description={t("analytics.topPostsHelp")}
            action={
              brand.sections.includes("posts") && (
                <Link href={`/brands/${brand.id}/posts${q}`} className={buttonVariants({ size: "sm", variant: "ghost" })}>
                  {t("analytics.allPosts")}
                  <ArrowRight size={14} aria-hidden />
                </Link>
              )
            }
          />
          <div className="border-t border-line/70">
            <TopPosts
              posts={top}
              locale={locale}
              empty={t("posts.empty")}
              labels={{ reach: t("kpi.reach.label"), interactions: t("kpi.interactions.label"), engagement: t("kpi.engagementRate.label"), format: (p) => t(`format.${p.format}`) }}
            />
          </div>
        </Card>
        <Card>
          <CardHeader title={t("analytics.bestTimes")} description={onlineHeat ? t("analytics.bestTimesOnline") : t("analytics.bestTimesPosts")} />
          <CardContent>
            {heat ? (
              <BestTimesHeatmap values={heat} note={onlineHeat ? t("heatmap.noteOnline") : undefined} />
            ) : (
              <p className="text-sm text-ink-2">{t("analytics.bestTimesNone")}</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
