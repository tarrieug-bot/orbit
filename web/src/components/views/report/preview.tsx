import { getTranslations } from "next-intl/server";
import { CheckCircle2 } from "lucide-react";
import { Avatar, Card, EmptyState, NetworkIcon } from "@/components/ui";
import type { BrandSummary, CampaignItem, PostItem } from "@/lib/db";
import { getBrandMetrics, getPosts } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";
import {
  autoGranularity,
  formatDate,
  formatNumber,
  formatPercent,
  formatPoints,
  formatRange,
  formatSignedNumber,
  formatSignedPercent,
  makeBuckets,
  previousRange,
  rangeLength,
  toChartData,
  computeDelta,
  type DateRange,
  type MetricTotals,
} from "@/lib/metrics";
import { formatPerformance, localSlot, perAccountChart, topPosts } from "../analytics-data";
import { MetricChart } from "../charts";
import { KpiGrid } from "../kpi-grid";
import { INTERACTION_COLORS, NETWORK_COLOR } from "../palette";
import { TopPosts } from "../top-posts";
import type { ReportConfig, ReportSection } from "./config";

/**
 * Aperçu à l'écran d'un rapport, rendu entièrement dans la langue du rapport
 * (indépendante de la langue de l'interface). Légendes des publications non traduites.
 */
export async function ReportPreview({ config, brand, range, campaign }: { config: ReportConfig; brand: BrandSummary; range: DateRange | null; campaign: CampaignItem | null }) {
  const lang = config.lang;
  const t = await getTranslations({ locale: lang });
  const tr = await getTranslations({ locale: lang, namespace: "reportPreview" });
  if (!range || !config.networks.length) {
    return <EmptyState title={tr("invalidTitle")} description={tr("invalidHelp")} />;
  }
  const previous = config.compare ? previousRange(range) : null;
  const [data, posts] = await Promise.all([
    getBrandMetrics(brand.id, { range, previous, networks: config.networks }),
    getPosts(brand.id, { range, networks: config.networks, limit: 1000 }),
  ]);
  if (!data) return <EmptyState title={tr("invalidTitle")} />;

  const has = (s: ReportSection) => config.sections.includes(s);
  const granularity = autoGranularity(range);
  const buckets = makeBuckets(range, granularity);
  const perAcc = perAccountChart(data.rows, data.accounts, range, buckets, ["followers", "reach", "views"]);
  const accSeries = (m: string) => data.accounts.map((a) => ({ key: `${m}:${a.id}`, label: t(`network.${a.network}`), color: NETWORK_COLOR[a.network] }));
  const perLabel = t(`period.granularity.${granularity}`);
  const kindLabel = tr(`kind.${config.type}`);
  const title =
    config.type === "month"
      ? formatDate(`${config.month}-01`, lang, { month: "long", year: "numeric" })
      : config.type === "year"
        ? tr("yearTitle", { year: config.year })
        : config.type === "campaign"
          ? campaign?.name ?? ""
          : formatRange(range, lang);
  let n = 0;
  const heading = (children: React.ReactNode) => (
    <h3 className="mb-4 flex items-center gap-3 text-[17px] font-semibold tracking-tight text-ink">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-orbit-gradient text-xs font-bold text-white">{++n}</span>
      {children}
    </h3>
  );
  const perf = formatPerformance(posts);
  const insights = buildInsights({ t, tr, lang, totals: data.totals, previous: data.previous, posts, days: rangeLength(range) });

  return (
    <Card className="overflow-hidden" lang={lang}>
      <div className="relative overflow-hidden border-b border-line/70 px-6 py-7 md:px-8">
        <div aria-hidden className="absolute inset-0 opacity-[0.14]" style={{ background: `radial-gradient(120% 160% at 100% 0%, ${brand.color}, transparent 55%), radial-gradient(90% 140% at 0% 100%, #8B5CF6, transparent 60%)` }} />
        <div className="relative flex items-start justify-between gap-6">
          <div className="min-w-0">
            <p className="text-xs font-semibold tracking-wider text-orbit-700 uppercase">{kindLabel}</p>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight text-ink md:text-[28px]">
              {brand.name} — {title}
            </h2>
            <p className="mt-2 text-sm text-ink-2">
              {formatRange(range, lang)} · {tr("days", { days: rangeLength(range) })}
              {previous && <span className="text-ink-3"> · {tr("comparedTo", { range: formatRange(previous, lang) })}</span>}
            </p>
            <ul className="mt-4 flex flex-wrap gap-2">
              {data.accounts.map((a) => (
                <li key={a.id} className="flex items-center gap-2 rounded-pill border border-line/70 bg-surface/80 py-1 pr-3 pl-1 text-xs font-medium text-ink shadow-soft">
                  <Avatar src={a.avatarUrl} name={a.name ?? a.handle ?? brand.name} color={brand.color} size="xs" network={a.network} />
                  <NetworkIcon network={a.network} size={12} />
                  {a.handle ?? a.name}
                </li>
              ))}
            </ul>
          </div>
          <Avatar src={brand.avatarUrl} name={brand.name} color={brand.color} size="xl" shape="rounded" className="hidden shadow-pop sm:inline-flex" />
        </div>
      </div>

      <div className="space-y-10 px-6 py-8 md:px-8">
        {has("summary") && (
          <section>
            {heading(tr("sections.summary"))}
            <KpiGrid locale={lang} totals={data.totals} previous={data.previous} series={data.series} color={brand.color} keys={["followers", "followersGained", "reach", "views", "interactions", "engagementRate", "posts", "profileVisits"]} />
          </section>
        )}
        {has("audience") && (
          <section>
            {heading(tr("sections.audience"))}
            <MetricChart data={perAcc} series={accSeries("followers")} granularity={granularity} format="number" locale={lang} yDomain="auto" height={240} />
          </section>
        )}
        {has("reach") && (
          <section>
            {heading(tr("sections.reach"))}
            <div className="grid gap-6 lg:grid-cols-2">
              <div>
                <p className="mb-2 text-[13px] font-medium text-ink-2">{tr("reachBy", { granularity: perLabel })}</p>
                <MetricChart data={perAcc} series={accSeries("reach")} granularity={granularity} locale={lang} height={220} />
              </div>
              <div>
                <p className="mb-2 text-[13px] font-medium text-ink-2">{tr("viewsBy", { granularity: perLabel })}</p>
                <MetricChart data={perAcc} series={accSeries("views")} granularity={granularity} locale={lang} height={220} />
              </div>
            </div>
          </section>
        )}
        {has("engagement") && (
          <section>
            {heading(tr("sections.engagement"))}
            <MetricChart
              type="bar"
              data={toChartData(data.series, buckets, ["likes", "comments", "shares", "saves"])}
              series={(["likes", "comments", "shares", "saves"] as const).map((k) => ({ key: k, label: t(`kpi.${k}.label`), color: INTERACTION_COLORS[k], stackId: "i" }))}
              granularity={granularity}
              locale={lang}
              height={220}
            />
            <dl className="tabular mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
              {(["likes", "comments", "shares", "saves"] as const).map((k) => (
                <div key={k} className="rounded-xl border border-line/70 bg-surface-2/60 px-4 py-3">
                  <dt className="flex items-center gap-1.5 text-xs text-ink-2">
                    <i className="h-2 w-2 rounded-full" style={{ background: INTERACTION_COLORS[k] }} />
                    {t(`kpi.${k}.label`)}
                  </dt>
                  <dd className="mt-1 text-xl font-semibold text-ink">{formatNumber(data.totals[k], lang)}</dd>
                </div>
              ))}
            </dl>
          </section>
        )}
        {has("formats") && (
          <section>
            {heading(tr("sections.formats"))}
            {perf.length ? (
              <div className="overflow-x-auto">
                <table className="tabular w-full min-w-[560px] text-sm">
                  <thead>
                    <tr className="border-b border-line text-left text-xs text-ink-2">
                      <th scope="col" className="py-2 pr-3 font-medium">{tr("table.format")}</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">{tr("table.posts")}</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">{tr("table.avgReach")}</th>
                      <th scope="col" className="px-3 py-2 text-right font-medium">{tr("table.avgInteractions")}</th>
                      <th scope="col" className="py-2 pl-3 text-right font-medium">{t("kpi.engagementRate.label")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {perf.map((p) => {
                      const max = perf[0].engagementRate || 1;
                      return (
                        <tr key={`${p.network}-${p.format}`} className="border-b border-line/60">
                          <td className="py-2.5 pr-3">
                            <span className="flex items-center gap-2 font-medium text-ink">
                              <NetworkIcon network={p.network} size={14} />
                              {t(`format.${p.format}`)}
                            </span>
                          </td>
                          <td className="px-3 py-2.5 text-right">{formatNumber(p.count, lang)}</td>
                          <td className="px-3 py-2.5 text-right">{formatNumber(Math.round(p.avgReach), lang)}</td>
                          <td className="px-3 py-2.5 text-right">{formatNumber(Math.round(p.avgInteractions), lang)}</td>
                          <td className="py-2.5 pl-3">
                            <span className="flex items-center justify-end gap-2">
                              <span className="h-2 w-20 overflow-hidden rounded-full bg-surface-2">
                                <span className="block h-full rounded-full" style={{ width: `${(p.engagementRate / max) * 100}%`, background: NETWORK_COLOR[p.network] }} />
                              </span>
                              <b className="w-14 text-right font-semibold text-ink">{formatPercent(p.engagementRate, lang, 2)}</b>
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-ink-2">{tr("noPosts")}</p>
            )}
          </section>
        )}
        {has("top") && (
          <section>
            {heading(tr("sections.top"))}
            <div className="-mx-5 overflow-hidden rounded-xl">
              <TopPosts
                posts={topPosts(posts, 6)}
                locale={lang}
                empty={tr("noPosts")}
                labels={{ reach: t("kpi.reach.label"), interactions: t("kpi.interactions.label"), engagement: t("kpi.engagementRate.label"), format: (p) => t(`format.${p.format}`) }}
              />
            </div>
          </section>
        )}
        {has("insights") && (
          <section>
            {heading(tr("sections.insights"))}
            <ul className="space-y-2.5">
              {insights.map((node, i) => (
                <li key={i} className="flex gap-3 rounded-xl border border-line/60 bg-surface-2/50 px-4 py-3 text-[14px] leading-relaxed text-ink-2 [&_b]:font-semibold [&_b]:text-ink">
                  <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-positive" aria-hidden />
                  <span>{node}</span>
                </li>
              ))}
            </ul>
          </section>
        )}
        <p className="border-t border-line pt-4 text-xs text-ink-3">
          {tr("footer", { date: formatDate(new Date().toISOString().slice(0, 10), lang, { day: "numeric", month: "long", year: "numeric" }) })}
        </p>
      </div>
    </Card>
  );
}

type T = Awaited<ReturnType<typeof getTranslations>>;

/** Analyse & recommandations par gabarits (même logique que la version d'essai). */
function buildInsights({ t, tr, lang, totals: m, previous: p, posts, days }: { t: T; tr: T; lang: AppLocale; totals: MetricTotals; previous: MetricTotals | null; posts: PostItem[]; days: number }): React.ReactNode[] {
  const b = (chunks: React.ReactNode) => <b>{chunks}</b>;
  const out: React.ReactNode[] = [];
  out.push(tr.rich("insights.community", { b, followers: formatNumber(m.followers, lang), net: formatSignedNumber(m.followersNet, lang), growth: formatSignedPercent(m.followersGrowth, lang) }));
  if (p) {
    const cr = computeDelta(m.reach, p.reach).ratio ?? 0;
    const ci = computeDelta(m.interactions, p.interactions).ratio ?? 0;
    out.push(tr.rich("insights.reachChange", { b, reachDir: cr >= 0 ? "up" : "down", reach: formatSignedPercent(cr, lang), interDir: ci >= 0 ? "up" : "down", inter: formatSignedPercent(ci, lang) }));
    out.push(tr.rich("insights.engagement", { b, rate: formatPercent(m.engagementRate, lang, 2), points: formatPoints(m.engagementRate - p.engagementRate, lang) }));
  }
  const perf = formatPerformance(posts).filter((f) => f.count >= 2);
  if (perf.length > 1) {
    const f = perf[0];
    const l = perf[perf.length - 1];
    out.push(
      tr.rich("insights.bestFormat", {
        b,
        format: t(`format.${f.format}`),
        network: t(`network.${f.network}`),
        rate: formatPercent(f.engagementRate, lang, 2),
        count: f.count,
        worstFormat: t(`format.${l.format}`),
        worstNetwork: t(`network.${l.network}`),
        worstRate: formatPercent(l.engagementRate, lang, 2),
      }),
    );
  }
  const best = topPosts(posts, 1)[0];
  if (best) {
    out.push(
      tr.rich("insights.bestPost", {
        b,
        caption: (best.caption ?? "").slice(0, 90),
        network: t(`network.${best.network}`),
        date: new Date(best.publishedAt).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { timeZone: "America/Martinique", day: "numeric", month: "long" }),
        interactions: formatNumber(best.metrics.interactions, lang),
        rate: formatPercent(best.metrics.engagementRate ?? 0, lang, 2),
      }),
    );
  }
  const byDay = new Map<number, { r: number; i: number }>();
  for (const x of posts) {
    if (x.metrics.reach == null) continue;
    const d = localSlot(x.publishedAt).day;
    const g = byDay.get(d) ?? { r: 0, i: 0 };
    g.r += x.metrics.reach;
    g.i += x.metrics.interactions;
    byDay.set(d, g);
  }
  const ranked = [...byDay.entries()].filter(([, v]) => v.r > 0).map(([d, v]) => ({ d, er: v.i / v.r })).sort((a, z) => z.er - a.er);
  if (ranked.length > 2) {
    const names = t("common.weekdaysLong").split(",");
    out.push(tr.rich("insights.bestDay", { b, best: names[ranked[0].d], worst: names[ranked[ranked.length - 1].d] }));
  }
  const perWeek = m.posts / (days / 7);
  out.push(tr.rich("insights.frequency", { b, perWeek: formatNumber(perWeek, lang, 1), low: perWeek < 3 ? "yes" : "no" }));
  return out;
}
