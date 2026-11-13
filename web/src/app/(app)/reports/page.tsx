import { redirect } from "next/navigation";
import { Suspense } from "react";
import { getLocale, getTranslations } from "next-intl/server";
import { FileText } from "lucide-react";
import { ReportBuilder } from "@/components/views/report/builder";
import { exportBody, monthOptions, parseReportConfig, reportRange } from "@/components/views/report/config";
import { ExportButtons } from "@/components/views/report/export-buttons";
import { ReportPreview } from "@/components/views/report/preview";
import { ReportSchedules } from "@/components/views/report/schedules";
import { Badge, Card, EmptyState, Skeleton } from "@/components/ui";
import { homePathFor, requireUser, resolveBrandParam } from "@/lib/auth/guards";
import { getCampaigns, getReportSchedules, getSessionUser, listBrands, todayISO, type PageSearchParams } from "@/lib/db";
import { LIVE_NETWORKS, type AppLocale } from "@/lib/db/types";
import { addDays } from "@/lib/metrics";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("nav.reports") };
}

/** Rapports : constructeur, aperçu dans la langue choisie, exports et envois programmés. */
export default async function ReportsPage({ searchParams }: { searchParams: PageSearchParams }) {
  const sp = await searchParams;
  const brand = await resolveBrandParam(sp.brand, "reports");
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  if (!brand) {
    // rubrique non ouverte à ce client : retour à sa page d'accueil
    const u = await requireUser();
    if (!u.isAgency) redirect(await homePathFor(u));
  }
  if (!brand) return <EmptyState illustration="reports" title={t("nav.reports")} description={t("empty.noAccess")} />;

  const [user, brands, campaigns] = await Promise.all([getSessionUser(), listBrands(), getCampaigns(brand.id)]);
  const today = todayISO();
  const config = parseReportConfig(sp, { brandId: brand.id, today, campaigns, defaultLang: user?.locale ?? locale, brandNetworks: brand.networks });
  const range = reportRange(config, today, campaigns);
  const campaign = config.campaignId ? campaigns.find((c) => c.id === config.campaignId) ?? null : null;
  const schedules = user?.isAgency ? await getReportSchedules(brand.id) : [];
  const year = Number(today.slice(0, 4));
  const bodies = { pdf: exportBody(config, "pdf"), pptx: exportBody(config, "pptx"), csv: exportBody(config, "csv") };
  const filename = `${brand.slug}-${config.type}-${range?.from ?? today}`;

  return (
    <div className="grid grid-cols-1 gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
      <div className="space-y-6 xl:sticky xl:top-24 xl:self-start">
        <ReportBuilder
          config={config}
          brands={brands.filter((b) => b.sections.includes("reports")).map((b) => ({ id: b.id, name: b.name, color: b.color, avatarUrl: b.avatarUrl, networks: b.networks.filter((n) => LIVE_NETWORKS.includes(n)) }))}
          campaigns={campaigns.filter((c) => c.status !== "upcoming").map((c) => ({ id: c.id, name: c.name }))}
          months={monthOptions(today)}
          years={[String(year), String(year - 1)]}
          maxDate={addDays(today, -1)}
        />
        {user?.isAgency && (
          <ReportSchedules
            brand={{ id: brand.id, name: brand.name, color: brand.color, avatarUrl: brand.avatarUrl, networks: brand.networks.filter((n) => LIVE_NETWORKS.includes(n)) }}
            config={config}
            items={schedules.map((s) => ({ id: s.id, brandId: s.brand_id, name: s.name, frequency: s.frequency, recipients: s.recipients, locale: s.locale, format: s.format, nextRunAt: s.next_run_at }))}
          />
        )}
      </div>

      <div className="min-w-0 space-y-4">
        <Card className="flex flex-wrap items-center justify-between gap-3 p-4">
          <div className="flex items-center gap-2.5">
            <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-orbit-50 text-orbit-700">
              <FileText size={17} aria-hidden />
            </span>
            <div>
              <p className="text-sm font-semibold text-ink">{t("reportBuilder.previewTitle")}</p>
              <p className="text-xs text-ink-2">{t("reportBuilder.previewHelp")}</p>
            </div>
            <Badge tone="brand" className="ml-1">
              <span aria-hidden>{config.lang === "en" ? "🇬🇧" : "🇫🇷"}</span> {t(`reportBuilder.langBadge.${config.lang}`)}
            </Badge>
          </div>
          <ExportButtons bodies={bodies} filename={filename} disabled={!range} />
        </Card>
        <Suspense key={JSON.stringify(config)} fallback={<PreviewSkeleton />}>
          <ReportPreview config={config} brand={brand} range={range} campaign={campaign} />
        </Suspense>
      </div>
    </div>
  );
}

function PreviewSkeleton() {
  return (
    <Card className="space-y-6 p-8">
      <Skeleton className="h-8 w-2/3" />
      <Skeleton className="h-4 w-1/3" />
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 8 }, (_, i) => (
          <Skeleton key={i} className="h-28" />
        ))}
      </div>
      <Skeleton className="h-60" />
    </Card>
  );
}
