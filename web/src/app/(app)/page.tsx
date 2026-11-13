import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { AlertTriangle, TrendingDown, TrendingUp } from "lucide-react";
import { KpiGrid } from "@/components/views/kpi-grid";
import { PeriodNote } from "@/components/views/period-note";
import { Avatar, Card, CardHeader, Delta, Sparkline } from "@/components/ui";
import { requireAgency } from "@/lib/auth/guards";
import { getOverview, getPageFilters, type PageSearchParams } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";
import { computeDelta, formatCompact, formatPercent, formatSignedNumber, formatSignedPercent, type MetricTotals } from "@/lib/metrics";
import { cn } from "@/lib/utils";

export const metadata = { title: "Vue d'ensemble" };

/** Vue d'ensemble multi-marques (agence). Point de départ — propriété : front. */
export default async function OverviewPage({ searchParams }: { searchParams: PageSearchParams }) {
  await requireAgency();
  const filters = await getPageFilters(searchParams);
  const data = await getOverview(filters);
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const q = new URLSearchParams(Object.entries(await searchParams).filter((e): e is [string, string] => typeof e[1] === "string")).toString();
  const brandsById = new Map(data.brands.map((b) => [b.brand.id, b.brand]));

  const cell = (m: MetricTotals, prev: MetricTotals | null, k: "followers" | "followersNet" | "reach" | "interactions" | "engagementRate" | "posts") => {
    if (k === "engagementRate") return formatPercent(m.engagementRate, locale, 2);
    if (k === "followersNet")
      return <span className={m.followersNet >= 0 ? "text-positive" : "text-negative"}>{formatSignedNumber(m.followersNet, locale)}</span>;
    if (k === "reach" && prev) {
      const d = computeDelta(m.reach, prev.reach);
      return (
        <span className="inline-flex items-center gap-2">
          {formatCompact(m.reach, locale)}
          {d.ratio != null && <Delta trend={d.trend} label={formatSignedPercent(d.ratio, locale, 0)} />}
        </span>
      );
    }
    return formatCompact(m[k], locale);
  };
  const cols = [
    ["followers", t("kpi.followers.label")],
    ["followersNet", t("kpi.followersNet.label")],
    ["reach", t("kpi.reach.label")],
    ["interactions", t("kpi.interactions.label")],
    ["engagementRate", t("kpi.engagementRate.label")],
    ["posts", t("kpi.posts.label")],
  ] as const;

  return (
    <div className="space-y-6">
      <PeriodNote range={data.range} previous={data.previousRange} />
      <KpiGrid totals={data.totals} previous={data.previous} keys={["followers", "followersGained", "reach", "views", "interactions", "engagementRate", "posts", "profileVisits"]} />

      <div className="grid gap-6 xl:grid-cols-[1fr_340px]">
        <Card className="overflow-hidden">
          <CardHeader title={t("overview.allBrands")} description={t("overview.allBrandsHelp")} />
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-y border-line bg-surface-2 text-left text-xs font-medium text-ink-2">
                  <th className="px-5 py-2.5">{t("overview.brandAccount")}</th>
                  {cols.map(([k, l]) => (
                    <th key={k} className="px-3 py-2.5 text-right whitespace-nowrap">{l}</th>
                  ))}
                  <th className="px-5 py-2.5">{t("overview.reachTrend")}</th>
                </tr>
              </thead>
              <tbody className="tabular">
                {data.brands.map((row) => (
                  <BrandRows key={row.brand.id} row={row} cols={cols} cell={cell} q={q} />
                ))}
              </tbody>
            </table>
          </div>
        </Card>

        <Card>
          <CardHeader title={t("alerts.title")} />
          <ul className="space-y-1 px-3 pb-4">
            {data.alerts.length === 0 && <li className="px-2 text-sm text-ink-2">{t("alerts.none")}</li>}
            {data.alerts.map((a, i) => {
              const brand = brandsById.get(a.brandId);
              const Icon = a.tone === "positive" ? TrendingUp : a.tone === "negative" ? TrendingDown : AlertTriangle;
              return (
                <li key={i}>
                  <Link href={`/brands/${a.brandId}${q ? `?${q}` : ""}`} className="flex items-start gap-3 rounded-control px-2 py-2 hover:bg-surface-2">
                    <span className={cn("mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-full", a.tone === "positive" ? "bg-positive-soft text-positive" : a.tone === "negative" ? "bg-negative-soft text-negative" : "bg-warning-soft text-warning")}>
                      <Icon size={14} />
                    </span>
                    <span className="text-[13px] leading-snug text-ink-2">
                      <b className="font-semibold text-ink">{brand?.name}</b>{" "}
                      {t(`alerts.${a.kind}`, {
                        network: t(`network.${a.network}`),
                        net: formatSignedNumber(a.values.net ?? 0, locale),
                        current: formatPercent(a.values.current ?? 0, locale, 2),
                        previous: formatPercent(a.values.previous ?? 0, locale, 2),
                        ratio: formatSignedPercent(a.values.ratio ?? 0, locale, 0),
                        days: a.values.days ?? 0,
                      })}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </div>
  );
}

type Row = Awaited<ReturnType<typeof getOverview>>["brands"][number];
type ColKey = "followers" | "followersNet" | "reach" | "interactions" | "engagementRate" | "posts";

function BrandRows({ row, cols, cell, q }: { row: Row; cols: readonly (readonly [ColKey, string])[]; cell: (m: MetricTotals, p: MetricTotals | null, k: ColKey) => React.ReactNode; q: string }) {
  const href = `/brands/${row.brand.id}${q ? `?${q}` : ""}`;
  return (
    <>
      <tr className="border-b border-line/60 transition-colors hover:bg-orbit-50/40">
        <td className="px-5 py-3">
          <Link href={href} className="flex items-center gap-3 font-semibold text-ink">
            <Avatar src={row.brand.avatarUrl} name={row.brand.name} color={row.brand.color} size="md" shape="rounded" />
            <span>
              {row.brand.name}
              {row.brand.sector && <span className="block text-xs font-normal text-ink-3">{row.brand.sector}</span>}
            </span>
          </Link>
        </td>
        {cols.map(([k]) => (
          <td key={k} className="px-3 py-3 text-right font-medium whitespace-nowrap">{cell(row.totals, row.previous, k)}</td>
        ))}
        <td className="px-5 py-3">
          <Sparkline values={row.reachTrend} color={row.brand.color} width={110} height={30} />
        </td>
      </tr>
      {row.accounts.map((a) => (
        <tr key={a.account.id} className="border-b border-line/60 text-ink-2 hover:bg-orbit-50/40">
          <td className="py-2 pr-5 pl-12">
            <Link href={`/brands/${row.brand.id}?nets=${a.account.network}`} className="flex items-center gap-2.5">
              <Avatar src={a.account.avatarUrl} name={a.account.name ?? a.account.handle ?? ""} color={row.brand.color} size="sm" network={a.account.network} />
              <span className="text-[13px]">{a.account.handle}</span>
            </Link>
          </td>
          {cols.map(([k]) => (
            <td key={k} className="px-3 py-2 text-right text-[13px] whitespace-nowrap">{cell(a.totals, a.previous, k)}</td>
          ))}
          <td className="px-5 py-2">
            <Sparkline values={a.reachTrend} color={a.account.network === "fb" ? "#1877F2" : "#DD2A7B"} width={110} height={26} />
          </td>
        </tr>
      ))}
    </>
  );
}
