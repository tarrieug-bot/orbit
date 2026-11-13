import { getLocale, getTranslations } from "next-intl/server";
import { Download } from "lucide-react";
import { AlertsCard } from "@/components/views/alerts-card";
import { MetricChart } from "@/components/views/charts";
import { KpiGrid } from "@/components/views/kpi-grid";
import { OverviewTable, type OverviewMetrics, type OverviewTableRow } from "@/components/views/overview-table";
import { filterQuery } from "@/components/views/page-header";
import { NETWORK_COLOR } from "@/components/views/palette";
import { PeriodNote } from "@/components/views/period-note";
import { buttonVariants, Card, CardContent, CardHeader } from "@/components/ui";
import { requireAgency } from "@/lib/auth/guards";
import { getOverview, getPageFilters, listBrands, type PageSearchParams } from "@/lib/db";
import { LIVE_NETWORKS, type AppLocale } from "@/lib/db/types";
import type { MetricTotals } from "@/lib/metrics";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("nav.overview") };
}

const pick = (m: MetricTotals): OverviewMetrics => ({
  followers: m.followers,
  followersNet: m.followersNet,
  reach: m.reach,
  interactions: m.interactions,
  engagementRate: m.engagementRate,
  posts: m.posts,
});

/** Vue d'ensemble multi-marques (agence). */
export default async function OverviewPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requireAgency();
  const sp = await searchParams;
  const filters = await getPageFilters(sp);
  const [data, brands] = await Promise.all([getOverview(filters), listBrands()]);
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const q = filterQuery(sp);

  const rows: OverviewTableRow[] = data.brands.map((b) => ({
    id: b.brand.id,
    href: `/brands/${b.brand.id}${q}`,
    name: b.brand.name,
    sector: b.brand.sector,
    color: b.brand.color,
    avatarUrl: b.brand.avatarUrl,
    current: pick(b.totals),
    previous: b.previous ? pick(b.previous) : null,
    trend: b.reachTrend,
    accounts: b.accounts.map((a) => ({
      id: a.account.id,
      href: `/brands/${b.brand.id}${filterQuery(sp, { nets: a.account.network })}`,
      network: a.account.network,
      handle: a.account.handle,
      name: a.account.name,
      avatarUrl: a.account.avatarUrl,
      current: pick(a.totals),
      previous: a.previous ? pick(a.previous) : null,
      trend: a.reachTrend,
    })),
  }));

  const nets = LIVE_NETWORKS.filter((n) => filters.networks.includes(n));
  const reachData = [...data.brands]
    .sort((a, b) => b.totals.reach - a.totals.reach)
    .map((b) => ({
      key: b.brand.name,
      ...Object.fromEntries(nets.map((n) => [n, b.accounts.filter((a) => a.account.network === n).reduce((s, a) => s + a.totals.reach, 0)])),
    }));

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PeriodNote range={data.range} previous={data.previousRange} />
        <a href={`/export/overview${filterQuery(sp)}`} className={buttonVariants({ size: "sm" })} download>
          <Download size={14} aria-hidden />
          {t("overview.exportCsv")}
        </a>
      </div>

      <KpiGrid totals={data.totals} previous={data.previous} series={data.series} keys={["followers", "followersGained", "reach", "views", "interactions", "engagementRate", "posts", "profileVisits"]} />

      <Card className="overflow-hidden transition duration-500 starting:opacity-0">
        <CardHeader title={t("overview.allBrands")} description={t("overview.allBrandsHelp")} />
        <OverviewTable rows={rows} />
      </Card>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_380px]">
        <Card>
          <CardHeader title={t("overview.reachByBrand")} description={t("overview.reachByBrandHelp")} />
          <CardContent>
            <MetricChart
              type="bar"
              horizontal
              xKind="category"
              data={reachData}
              series={nets.map((n) => ({ key: n, label: t(`network.${n}`), color: NETWORK_COLOR[n] }))}
              locale={locale}
              height={Math.max(220, reachData.length * 64 + 60)}
            />
          </CardContent>
        </Card>
        <AlertsCard alerts={data.alerts} brands={brands} query={q} />
      </div>
    </div>
  );
}
