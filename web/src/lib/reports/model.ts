import type { AppLocale, ISODate, ISOTimestamp, Network, PostFormat, ReportKind } from "@/lib/db/types";
import type { DateRange, Granularity, KpiKey, Trend } from "@/lib/metrics";

/**
 * Modèle d'un rapport, INDÉPENDANT du format de sortie (PDF, PPTX, CSV, e-mail).
 * Toutes les chaînes sont déjà traduites et formatées dans la langue du rapport :
 * les moteurs de rendu (./render/*) n'ont aucune logique métier ni traduction.
 */

export const REPORT_SECTIONS = ["summary", "audience", "reach", "engagement", "formats", "top", "insights"] as const;
export type ReportSectionKey = (typeof REPORT_SECTIONS)[number];

export type ReportPeriodType = Extract<ReportKind, "month" | "year" | "campaign" | "custom">;

/** Période demandée (contrat de POST /api/reports/export). */
export interface ReportPeriodInput {
  type: ReportPeriodType;
  /** month : « YYYY-MM » ; year : « YYYY » ; campaign : id de campagne */
  value?: string;
  /** custom : bornes incluses « YYYY-MM-DD » */
  from?: string;
  to?: string;
}

export interface ReportDelta {
  /** « +12,3 % » / « −0,40 pt » */
  display: string;
  trend: Trend;
  /** true = bonne nouvelle, false = mauvaise, null = stable */
  positive: boolean | null;
}

export interface ReportKpi {
  key: KpiKey;
  label: string;
  value: number;
  display: string;
  delta: ReportDelta | null;
  /** false = indisponible sur la période (≠ 0) */
  available: boolean;
}

export interface ReportSeriesPoint {
  key: ISODate;
  label: string;
  followers: number | null;
  reach: number | null;
  views: number | null;
  interactions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}

export interface ReportAccount {
  id: string;
  network: Network;
  networkLabel: string;
  handle: string | null;
  name: string | null;
  avatarUrl: string | null;
  followersDisplay: string;
}

export interface ReportFormatRow {
  network: Network;
  networkLabel: string;
  format: PostFormat;
  formatLabel: string;
  posts: number;
  avgReach: number;
  avgInteractions: number;
  engagementRate: number;
  display: { posts: string; avgReach: string; avgInteractions: string; engagementRate: string };
  /** part de la barre (0–1) relative au meilleur format */
  bar: number;
}

export interface ReportTopPost {
  id: string;
  network: Network;
  networkLabel: string;
  format: PostFormat;
  formatLabel: string;
  publishedAt: ISOTimestamp;
  dateLabel: string;
  /** légende dans sa langue d'origine (jamais traduite) */
  caption: string;
  permalink: string | null;
  thumbnailUrl: string | null;
  reach: number | null;
  interactions: number;
  engagementRate: number | null;
  display: { reach: string; interactions: string; engagementRate: string };
}

export interface ReportAudience {
  accountHandle: string | null;
  ageGender: { age: string; female: number; male: number }[];
  genders: { female: string; male: string };
  cities: { label: string; share: number; display: string }[];
  countries: { label: string; share: number; display: string }[];
}

/** Phrase d'analyse : segments, `bold` = mise en valeur. */
export interface ReportInsight {
  segments: { text: string; bold: boolean }[];
  text: string;
}

export interface ReportModel {
  version: 1;
  lang: AppLocale;
  generatedAt: ISOTimestamp;
  agency: { name: string | null; logoUrl: string | null };
  brand: { id: string; name: string; color: string; sector: string | null; avatarUrl: string | null; initials: string };
  accounts: ReportAccount[];
  period: { type: ReportPeriodType; range: DateRange; label: string; title: string; days: number; campaignName: string | null };
  comparison: { range: DateRange; label: string } | null;
  sections: ReportSectionKey[];
  /** libellés traduits utilisés par les moteurs de rendu */
  labels: {
    title: string;
    subtitle: string;
    periodLine: string;
    comparisonLine: string | null;
    generatedOn: string;
    agencyLogo: string;
    confidential: string;
    accounts: string;
    vsPrevious: string;
    sections: Record<ReportSectionKey, string>;
    sectionIntros: Record<ReportSectionKey, string>;
    table: Record<"format" | "posts" | "avgReach" | "avgInteractions" | "engagementRate" | "network" | "date" | "caption" | "reach" | "interactions", string>;
    metrics: Record<"followers" | "reach" | "views" | "interactions" | "likes" | "comments" | "shares" | "saves", string>;
    noPosts: string;
    noAudience: string;
    ageGender: string;
    women: string;
    men: string;
    cities: string;
    countries: string;
    followersEvolution: string;
    byNetwork: string;
  };
  kpis: ReportKpi[];
  byNetwork: { network: Network; label: string; kpis: ReportKpi[] }[];
  series: { granularity: Granularity; points: ReportSeriesPoint[] };
  audience: ReportAudience | null;
  formats: ReportFormatRow[];
  topPosts: ReportTopPost[];
  insights: ReportInsight[];
  /** lignes quotidiennes par compte pour l'export CSV (en-têtes traduits en première ligne) */
  csv: string[][];
}

/** « La portée **progresse** » → segments. */
export function toInsight(text: string): ReportInsight {
  const segments = text
    .split("**")
    .map((t, i) => ({ text: t, bold: i % 2 === 1 }))
    .filter((s) => s.text.length > 0);
  return { segments, text: segments.map((s) => s.text).join("") };
}
