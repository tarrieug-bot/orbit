import type { CampaignItem } from "@/lib/db";
import { LIVE_NETWORKS, type AppLocale, type ExportFormat, type Network } from "@/lib/db/types";
import { addDays, addMonths, endOfMonth, isISODate, startOfMonth, type DateRange } from "@/lib/metrics";

/** Sections d'un rapport (clés partagées avec le moteur d'export de l'agent back). */
export const REPORT_SECTIONS = ["summary", "audience", "reach", "engagement", "formats", "top", "insights"] as const;
export type ReportSection = (typeof REPORT_SECTIONS)[number];
export type ReportType = "month" | "year" | "campaign" | "custom";
export const REPORT_TYPES: ReportType[] = ["month", "campaign", "year", "custom"];

/** Configuration du constructeur, portée par l'URL de /reports. */
export interface ReportConfig {
  brandId: string;
  type: ReportType;
  month: string; // YYYY-MM
  year: string; // YYYY
  campaignId: string | null;
  from: string;
  to: string;
  networks: Network[];
  sections: ReportSection[];
  compare: boolean;
  lang: AppLocale;
}

/** Corps de POST /api/reports/export (contrat avec l'agent back). */
export interface ReportExportBody {
  brandId: string;
  period: { type: ReportType; value?: string; from?: string; to?: string };
  compare: boolean;
  sections: string[];
  lang: AppLocale;
  format: ExportFormat;
  /** réseaux retenus (champ additionnel, ignorable) */
  networks?: Network[];
}

type SP = Record<string, string | string[] | undefined>;
const one = (sp: SP, k: string) => (Array.isArray(sp[k]) ? sp[k]?.[0] : (sp[k] as string | undefined));

export function parseReportConfig(sp: SP, ctx: { brandId: string; today: string; campaigns: CampaignItem[]; defaultLang: AppLocale; brandNetworks: Network[] }): ReportConfig {
  const lastMonth = startOfMonth(addMonths(startOfMonth(ctx.today), -1)).slice(0, 7);
  const rawType = one(sp, "kind");
  const type: ReportType = REPORT_TYPES.includes(rawType as ReportType) ? (rawType as ReportType) : "month";
  const month = /^\d{4}-\d{2}$/.test(one(sp, "month") ?? "") ? one(sp, "month")! : lastMonth;
  const year = /^\d{4}$/.test(one(sp, "year") ?? "") ? one(sp, "year")! : ctx.today.slice(0, 4);
  const cid = one(sp, "cid");
  const campaignId = ctx.campaigns.find((c) => c.id === cid)?.id ?? ctx.campaigns.find((c) => c.status !== "upcoming")?.id ?? null;
  const yesterday = addDays(ctx.today, -1);
  const from = isISODate(one(sp, "start")) ? one(sp, "start")! : addDays(yesterday, -29);
  const to = isISODate(one(sp, "end")) ? one(sp, "end")! : yesterday;
  const available = ctx.brandNetworks.filter((n) => LIVE_NETWORKS.includes(n));
  const rnets = (one(sp, "rnets") ?? "").split(",").filter((n): n is Network => available.includes(n as Network));
  const rawSec = one(sp, "sec");
  const sections = rawSec == null ? [...REPORT_SECTIONS] : REPORT_SECTIONS.filter((s) => rawSec.split(",").includes(s));
  const lang = one(sp, "lang") === "en" ? "en" : one(sp, "lang") === "fr" ? "fr" : ctx.defaultLang;
  return {
    brandId: ctx.brandId,
    type,
    month,
    year,
    campaignId,
    from: from <= to ? from : to,
    to: from <= to ? to : from,
    networks: rnets.length ? rnets : available,
    sections,
    compare: one(sp, "cmp") !== "0",
    lang,
  };
}

export function serializeReportConfig(c: ReportConfig): string {
  const q = new URLSearchParams({ brand: c.brandId, kind: c.type, lang: c.lang });
  if (c.type === "month") q.set("month", c.month);
  if (c.type === "year") q.set("year", c.year);
  if (c.type === "campaign" && c.campaignId) q.set("cid", c.campaignId);
  if (c.type === "custom") {
    q.set("start", c.from);
    q.set("end", c.to);
  }
  q.set("rnets", c.networks.join(","));
  if (c.sections.length !== REPORT_SECTIONS.length) q.set("sec", c.sections.join(","));
  if (!c.compare) q.set("cmp", "0");
  return q.toString();
}

/** Période couverte par le rapport (bornée à la veille : données collectées en J−1). */
export function reportRange(c: ReportConfig, today: string, campaigns: CampaignItem[]): DateRange | null {
  const yesterday = addDays(today, -1);
  const clamp = (r: DateRange): DateRange | null => {
    const to = r.to > yesterday ? yesterday : r.to;
    return to < r.from ? null : { from: r.from, to };
  };
  switch (c.type) {
    case "month":
      return clamp({ from: `${c.month}-01`, to: endOfMonth(`${c.month}-01`) });
    case "year":
      return clamp({ from: `${c.year}-01-01`, to: `${c.year}-12-31` });
    case "campaign": {
      const camp = campaigns.find((x) => x.id === c.campaignId);
      return camp ? clamp(camp.range) : null;
    }
    case "custom":
      return clamp({ from: c.from, to: c.to });
  }
}

export function exportBody(c: ReportConfig, format: ExportFormat): ReportExportBody {
  const period: ReportExportBody["period"] =
    c.type === "month" ? { type: "month", value: c.month } : c.type === "year" ? { type: "year", value: c.year } : c.type === "campaign" ? { type: "campaign", value: c.campaignId ?? undefined } : { type: "custom", from: c.from, to: c.to };
  return { brandId: c.brandId, period, compare: c.compare, sections: c.sections, lang: c.lang, format, networks: c.networks };
}

/** Mois proposés (du plus récent au plus ancien, 18 mois). */
export function monthOptions(today: string, n = 18): string[] {
  const out: string[] = [];
  let d = startOfMonth(today);
  for (let i = 0; i < n; i++) {
    out.push(d.slice(0, 7));
    d = addMonths(d, -1);
  }
  return out;
}
