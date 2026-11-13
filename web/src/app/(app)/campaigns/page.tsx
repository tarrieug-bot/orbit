import { redirect } from "next/navigation";
import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { BarChart3, CalendarRange, FileText, Hash, Megaphone } from "lucide-react";
import { BrandHero } from "@/components/views/brand-hero";
import { BrandSwitcher } from "@/components/views/brand-switcher";
import { CampaignDeleteButton, CampaignFormButton } from "@/components/views/campaign-dialogs";
import { filterQuery, PageHeader } from "@/components/views/page-header";
import { Badge, buttonVariants, Card, Delta, EmptyState } from "@/components/ui";
import { homePathFor, requireUser, resolveBrandParam } from "@/lib/auth/guards";
import { getBrandMetrics, getCampaigns, getSessionUser, listBrands, todayISO, type CampaignItem, type PageSearchParams } from "@/lib/db";
import { LIVE_NETWORKS, type AppLocale } from "@/lib/db/types";
import {
  addDays,
  computeDelta,
  computeRateDelta,
  formatCompact,
  formatPercent,
  formatPoints,
  formatRange,
  formatSignedNumber,
  formatSignedPercent,
  previousRange,
  rangeLength,
  type MetricTotals,
} from "@/lib/metrics";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("nav.campaigns") };
}

const TONE = { running: "positive", upcoming: "info", finished: "neutral" } as const;

/** Campagnes : résultats vs période précédente, création / modification / suppression (agence). */
export default async function CampaignsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const sp = await searchParams;
  const brand = await resolveBrandParam(sp.brand, "campaigns");
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  if (!brand) {
    // rubrique non ouverte à ce client : retour à sa page d'accueil
    const u = await requireUser();
    if (!u.isAgency) redirect(await homePathFor(u));
  }
  if (!brand) return <EmptyState icon={<Megaphone size={22} />} title={t("campaigns.title")} description={t("empty.noAccess")} />;
  const [user, campaigns, brands] = await Promise.all([getSessionUser(), getCampaigns(brand.id), listBrands()]);
  const canManage = !!user?.isAgency;
  const today = todayISO();
  const yesterday = addDays(today, -1);

  const results = await Promise.all(
    campaigns.map(async (c) => {
      if (c.status === "upcoming") return null;
      const range = { from: c.range.from, to: c.range.to > yesterday ? yesterday : c.range.to };
      if (range.to < range.from) return null;
      const m = await getBrandMetrics(brand.id, { range, previous: previousRange(range), networks: [...LIVE_NETWORKS] });
      return m ? { totals: m.totals, previous: m.previous, range } : null;
    }),
  );

  const empty: CampaignItem["range"] = { from: addDays(today, 1), to: addDays(today, 14) };
  const reportsVisible = brand.sections.includes("reports");
  const analyticsVisible = brand.sections.includes("analytics");

  return (
    <div className="space-y-6">
      <BrandSwitcher brands={brands.filter((b) => b.sections.includes("campaigns"))} currentId={brand.id} label={t("common.brands")} hrefFor={(id) => `/campaigns${filterQuery(sp, { brand: id })}`} />
      <BrandHero brand={brand} accounts={brand.accounts} locale={locale} followersLabel={t("kpi.followers.label").toLowerCase()} />
      <PageHeader
        title={t("campaigns.listTitle", { brand: brand.name })}
        description={t("campaigns.listHelp")}
        actions={canManage && <CampaignFormButton mode="create" value={{ brandId: brand.id, name: "", description: "", startsOn: empty.from, endsOn: empty.to, hashtags: "", color: "#6366F1" }} />}
      />

      {campaigns.length === 0 ? (
        <EmptyState icon={<Megaphone size={22} />} title={t("campaigns.empty")} description={canManage ? t("campaigns.emptyHelp") : undefined} />
      ) : (
        <ul className="space-y-4">
          {campaigns.map((c, i) => {
            const r = results[i];
            const color = c.color ?? brand.color;
            return (
              <li key={c.id}>
                <Card className="group overflow-hidden transition duration-300 hover:shadow-pop starting:translate-y-1 starting:opacity-0">
                  <div className="flex flex-col lg:flex-row">
                    <div className="relative flex min-w-0 flex-1 gap-4 p-5 lg:max-w-[420px]">
                      <span aria-hidden className="w-1.5 shrink-0 rounded-full" style={{ background: color }} />
                      <div className="min-w-0 space-y-2">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-[15px] font-semibold text-ink">{c.name}</h3>
                          <Badge tone={TONE[c.status]} dot>{t(`campaigns.status.${c.status}`)}</Badge>
                        </div>
                        <p className="flex items-center gap-1.5 text-[13px] text-ink-2">
                          <CalendarRange size={14} aria-hidden className="text-ink-3" />
                          {formatRange(c.range, locale)} · {t("campaigns.days", { days: rangeLength(c.range) })}
                        </p>
                        {c.description && <p className="line-clamp-2 text-[13px] text-ink-2">{c.description}</p>}
                        {c.hashtags.length > 0 && (
                          <div className="flex flex-wrap gap-1.5">
                            {c.hashtags.map((h) => (
                              <span key={h} className="inline-flex items-center gap-0.5 rounded-pill bg-orbit-50 px-2 py-0.5 text-[11px] font-medium text-orbit-700">
                                <Hash size={10} aria-hidden />
                                {h.replace(/^#/, "")}
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex flex-1 items-center border-t border-line/70 bg-surface-2/50 px-5 py-4 lg:border-t-0 lg:border-l">
                      {r ? (
                        <dl className="tabular grid w-full grid-cols-2 gap-4 sm:grid-cols-4">
                          <Result label={t("kpi.reach.label")} value={formatCompact(r.totals.reach, locale)} prev={r.previous} cur={r.totals} k="reach" locale={locale} />
                          <Result label={t("kpi.interactions.label")} value={formatCompact(r.totals.interactions, locale)} prev={r.previous} cur={r.totals} k="interactions" locale={locale} />
                          <Result label={t("kpi.engagementRate.label")} value={formatPercent(r.totals.engagementRate, locale, 2)} prev={r.previous} cur={r.totals} k="engagementRate" locale={locale} />
                          <Result label={t("kpi.followersGained.label")} value={formatSignedNumber(r.totals.followersGained, locale)} prev={r.previous} cur={r.totals} k="followersGained" locale={locale} />
                        </dl>
                      ) : (
                        <p className="text-sm text-ink-2">{t("campaigns.upcomingHelp")}</p>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 border-t border-line/70 px-4 py-3 lg:flex-col lg:justify-center lg:border-t-0 lg:border-l lg:px-3">
                      {r && analyticsVisible && (
                        <Link href={`/brands/${brand.id}?period=campaign&campaign=${c.id}`} className={buttonVariants({ size: "sm", variant: "secondary", className: "lg:w-full" })}>
                          <BarChart3 size={14} aria-hidden />
                          {t("campaigns.analyze")}
                        </Link>
                      )}
                      {r && reportsVisible && (
                        <Link href={`/reports?brand=${brand.id}&kind=campaign&cid=${c.id}`} className={buttonVariants({ size: "sm", variant: "outline", className: "lg:w-full" })}>
                          <FileText size={14} aria-hidden />
                          {t("campaigns.report")}
                        </Link>
                      )}
                      {canManage && (
                        <div className="ml-auto flex gap-0.5 lg:ml-0">
                          <CampaignFormButton
                            mode="edit"
                            value={{ id: c.id, brandId: brand.id, name: c.name, description: c.description ?? "", startsOn: c.range.from, endsOn: c.range.to, hashtags: c.hashtags.join(" "), color }}
                          />
                          <CampaignDeleteButton id={c.id} name={c.name} />
                        </div>
                      )}
                    </div>
                  </div>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Result({ label, value, cur, prev, k, locale }: { label: string; value: string; cur: MetricTotals; prev: MetricTotals | null; k: "reach" | "interactions" | "engagementRate" | "followersGained"; locale: AppLocale }) {
  const d = prev ? (k === "engagementRate" ? computeRateDelta(cur[k], prev[k]) : computeDelta(cur[k], prev[k])) : null;
  const label2 = d ? (k === "engagementRate" ? formatPoints(d.diff ?? 0, locale) : d.ratio != null ? formatSignedPercent(d.ratio, locale, 0) : null) : null;
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="truncate text-xs text-ink-3">{label}</dt>
      <dd className="space-y-1">
        <span className="block text-lg font-semibold text-ink">{value}</span>
        {d && label2 && <Delta trend={d.trend} label={label2} />}
      </dd>
    </div>
  );
}
