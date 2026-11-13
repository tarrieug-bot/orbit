import { redirect } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { Info, Users } from "lucide-react";
import { BrandHero } from "@/components/views/brand-hero";
import { BrandSwitcher } from "@/components/views/brand-switcher";
import { MetricChart } from "@/components/views/charts";
import { BestTimesHeatmap } from "@/components/views/heatmap";
import { KpiGrid } from "@/components/views/kpi-grid";
import { filterQuery } from "@/components/views/page-header";
import { PeriodNote } from "@/components/views/period-note";
import { GENDER_COLOR } from "@/components/views/palette";
import { ShareBars } from "@/components/views/share-bars";
import { Card, CardContent, CardHeader, EmptyState, NetworkIcon } from "@/components/ui";
import { homePathFor, requireUser, resolveBrandParam } from "@/lib/auth/guards";
import { getAudience, getBrandMetrics, getPageFilters, listBrands, type PageSearchParams } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";
import { formatPercent, INTL_LOCALE } from "@/lib/metrics";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("nav.audience") };
}

/** Audience (démographie Instagram, villes, pays, abonnés en ligne). */
export default async function AudiencePage({ searchParams }: { searchParams: PageSearchParams }) {
  const sp = await searchParams;
  const brand = await resolveBrandParam(sp.brand, "audience");
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  if (!brand) {
    // rubrique non ouverte à ce client : retour à sa page d'accueil
    const u = await requireUser();
    if (!u.isAgency) redirect(await homePathFor(u));
  }
  if (!brand) return <EmptyState icon={<Users size={22} />} title={t("audience.title")} description={t("empty.noAccess")} />;

  const filters = await getPageFilters(sp, brand.id);
  const [data, metrics, brands] = await Promise.all([getAudience(brand.id), getBrandMetrics(brand.id, filters), listBrands()]);
  const ig = brand.accounts.find((a) => a.network === "ig");
  const hasFb = brand.accounts.some((a) => a.network === "fb");
  const audienceBrands = brands.filter((b) => b.sections.includes("audience"));

  let regions: Intl.DisplayNames | null = null;
  try {
    regions = new Intl.DisplayNames([INTL_LOCALE[locale]], { type: "region" });
  } catch {
    regions = null;
  }
  const hasDemo = !!data && data.ageGender.length > 0;
  const unavailable = (msg: string) => (
    <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-line-strong bg-surface-2/60 px-6 py-10 text-center text-sm text-ink-2">
      <Info size={18} className="text-ink-3" aria-hidden />
      {msg}
    </div>
  );

  return (
    <div className="space-y-6">
      <BrandSwitcher brands={audienceBrands} currentId={brand.id} label={t("common.brands")} hrefFor={(id) => `/audience${filterQuery(sp, { brand: id })}`} />
      <BrandHero brand={brand} accounts={brand.accounts} locale={locale} followersLabel={t("kpi.followers.label").toLowerCase()} />

      {metrics && (
        <>
          <PeriodNote range={metrics.range} previous={metrics.previousRange} />
          <KpiGrid totals={metrics.totals} previous={metrics.previous} series={metrics.series} color={brand.color} keys={["followers", "followersGained", "profileVisits", "linkClicks"]} />
        </>
      )}

      {hasFb && (
        <p className="flex items-start gap-2.5 rounded-card border border-info/20 bg-info-soft/60 px-4 py-3 text-[13px] text-ink-2">
          <NetworkIcon network="fb" size={16} className="mt-0.5" />
          {t("audience.fbNote")}
        </p>
      )}

      {!ig ? (
        <EmptyState icon={<Users size={22} />} title={t("audience.noIgTitle")} description={t("audience.noData")} />
      ) : (
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader
              title={t("audience.ageGender")}
              description={
                hasDemo
                  ? t("audience.ageGenderHelp", { women: formatPercent(data.genderShares.female, locale, 0), men: formatPercent(data.genderShares.male, locale, 0) })
                  : t("audience.igFollowers")
              }
              action={<NetworkIcon network="ig" size={18} />}
            />
            <CardContent>
              {hasDemo ? (
                <MetricChart
                  type="bar"
                  xKind="category"
                  format="percent"
                  locale={locale}
                  height={330}
                  data={data.ageGender.map((r) => ({ key: r.age, female: r.female, male: r.male }))}
                  series={[
                    { key: "female", label: t("audience.women"), color: GENDER_COLOR.female },
                    { key: "male", label: t("audience.men"), color: GENDER_COLOR.male },
                  ]}
                />
              ) : (
                unavailable(t("audience.demoUnavailable"))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader title={t("audience.cities")} description={t("audience.shareOfFollowers")} />
            <CardContent>
              {data?.cities.length ? <ShareBars items={data.cities.map((c) => ({ label: c.key.split(",")[0], share: c.share }))} locale={locale} /> : unavailable(t("audience.demoUnavailable"))}
            </CardContent>
          </Card>
          <Card>
            <CardHeader title={t("audience.countries")} description={t("audience.shareOfFollowers")} />
            <CardContent>
              {data?.countries.length ? (
                <ShareBars
                  digits={0}
                  items={data.countries.map((c) => ({
                    label: regions?.of(c.key) ?? c.key,
                    share: c.share,
                    icon: <span aria-hidden className="text-base leading-none">{flag(c.key)}</span>,
                  }))}
                  locale={locale}
                />
              ) : (
                unavailable(t("audience.demoUnavailable"))
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader title={t("audience.online")} description={t("audience.onlineHelp")} />
            <CardContent>
              {data?.onlineHeatmap ? (
                <BestTimesHeatmap values={data.onlineHeatmap} note={t("heatmap.noteOnline")} />
              ) : (
                unavailable(t("audience.onlineUnavailable"))
              )}
            </CardContent>
          </Card>
          {data && <p className="text-xs text-ink-3 lg:col-span-2">{t("audience.snapshot", { date: new Date(`${data.date}T12:00:00Z`).toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "long", year: "numeric" }) })}</p>}
        </div>
      )}
    </div>
  );
}

/** Drapeau emoji d'un code pays ISO alpha-2. */
function flag(code: string): string {
  return /^[A-Z]{2}$/i.test(code) ? String.fromCodePoint(...[...code.toUpperCase()].map((c) => 0x1f1a5 + c.charCodeAt(0))) : "🌐";
}
