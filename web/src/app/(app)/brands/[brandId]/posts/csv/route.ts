import { getLocale, getTranslations } from "next-intl/server";
import { csvResponse, pct2, toCsv } from "@/components/views/csv";
import { postQueryFrom } from "@/components/views/posts-query";
import { getBrand, getCampaigns, getPageFilters, getPosts } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";

/** Export CSV des publications d'une marque (mêmes filtres que la grille). RLS appliquée. */
export async function GET(request: Request, { params }: { params: Promise<{ brandId: string }> }) {
  const { brandId } = await params;
  const brand = await getBrand(brandId);
  if (!brand || !brand.sections.includes("posts")) return new Response("Not found", { status: 404 });
  const sp = new URL(request.url).searchParams;
  const filters = await getPageFilters(sp, brand.id);
  const [posts, campaigns] = await Promise.all([getPosts(brand.id, postQueryFrom(sp, filters)), getCampaigns(brand.id)]);
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const camp = new Map(campaigns.map((c) => [c.id, c.name]));
  const fmtDate = (iso: string, opts: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/Martinique", ...opts }).format(new Date(iso));
  const head = [
    t("csv.date"), t("csv.time"), t("csv.network"), t("csv.account"), t("csv.format"), t("csv.caption"), t("kpi.reach.label"), t("kpi.views.label"),
    t("kpi.likes.label"), t("kpi.comments.label"), t("kpi.shares.label"), t("kpi.saves.label"), t("kpi.interactions.label"), `${t("kpi.engagementRate.label")} (%)`,
    t("csv.campaign"), t("csv.link"),
  ];
  const rows = posts.map((p) => [
    fmtDate(p.publishedAt, { year: "numeric", month: "2-digit", day: "2-digit" }),
    fmtDate(p.publishedAt, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" }),
    t(`network.${p.network}`), p.account.handle, t(`format.${p.format}`), p.caption, p.metrics.reach, p.metrics.views, p.metrics.likes, p.metrics.comments,
    p.metrics.shares, p.metrics.saves, p.metrics.interactions, p.metrics.engagementRate != null ? pct2(p.metrics.engagementRate) : null,
    p.campaignId ? camp.get(p.campaignId) ?? "" : "", p.permalink,
  ]);
  return csvResponse(toCsv([head, ...rows], locale), `${brand.slug}-publications-${filters.range.from}-${filters.range.to}.csv`);
}
