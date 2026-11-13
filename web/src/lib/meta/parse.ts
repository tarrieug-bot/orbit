import type { AudienceDemographics, ISODate, OnlineFollowers, PostFormat } from "@/lib/db/types";
import type { DateRange } from "@/lib/metrics/types";
import type { PostColumn } from "./metric-map";

/**
 * Fonctions PURES de conversion des réponses Graph API → nos types.
 * (testées avec les fixtures de ./__fixtures__)
 */

const DAY_MS = 86_400_000;

export function toUnix(date: ISODate): number {
  return Math.floor(Date.parse(`${date}T00:00:00Z`) / 1000);
}

export function addDaysISO(date: ISODate, n: number): ISODate {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/**
 * `end_time` Meta = fin du jour en heure du Pacifique (ex. 2026-11-12T08:00:00+0000 pour le 11).
 * Jour = date(end_time − 1 jour), lue en UTC.
 */
export function endTimeToDate(endTime: string): ISODate {
  const t = Date.parse(endTime.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
  return new Date(t - DAY_MS).toISOString().slice(0, 10);
}

/** Découpe une période en fenêtres de `size` jours au plus (bornes incluses). */
export function chunkRange(range: DateRange, size: number): DateRange[] {
  const out: DateRange[] = [];
  for (let from = range.from; from <= range.to; from = addDaysISO(from, size)) {
    const end = addDaysISO(from, size - 1);
    out.push({ from, to: end < range.to ? end : range.to });
  }
  return out;
}

export function eachDate(range: DateRange): ISODate[] {
  const out: ISODate[] = [];
  for (let d = range.from; d <= range.to; d = addDaysISO(d, 1)) out.push(d);
  return out;
}

/** Valeur numérique d'une valeur d'insight (nombre, ou objet ventilé → somme). */
export function insightValue(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && Number.isFinite(Number(v))) return Number(v);
  if (v && typeof v === "object") {
    return Object.values(v as Record<string, unknown>).reduce<number>((t, x) => t + (typeof x === "number" ? x : 0), 0);
  }
  return 0;
}

export interface InsightSeries {
  name?: string;
  period?: string;
  values?: { value?: unknown; end_time?: string }[];
  total_value?: { value?: unknown; breakdowns?: { dimension_keys?: string[]; results?: { dimension_values?: string[]; value?: number }[] }[] };
}
export interface InsightsResponse {
  data?: InsightSeries[];
}

/** Série « period=day » → { date: valeur } (dans la période demandée uniquement). */
export function parseDailySeries(body: InsightsResponse | null | undefined, range?: DateRange): Map<ISODate, number> {
  const out = new Map<ISODate, number>();
  const series = body?.data?.[0];
  for (const v of series?.values ?? []) {
    if (!v.end_time) continue;
    const date = endTimeToDate(v.end_time);
    if (range && (date < range.from || date > range.to)) continue;
    out.set(date, insightValue(v.value));
  }
  return out;
}

/** Réponse « metric_type=total_value » (plusieurs métriques) → { nomMétrique: valeur }. */
export function parseTotalValues(body: InsightsResponse | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const s of body?.data ?? []) {
    if (!s.name) continue;
    if (s.total_value) out[s.name] = insightValue(s.total_value.value);
    else if (s.values?.length) out[s.name] = insightValue(s.values[0]?.value);
  }
  return out;
}

/** follows_and_unfollows ventilé par follow_type → abonnements (FOLLOWER) / désabonnements (NON_FOLLOWER). */
export function parseFollowsBreakdown(body: InsightsResponse | null | undefined): { gained: number | null; lost: number | null } {
  const br = body?.data?.[0]?.total_value?.breakdowns?.[0];
  if (!br) return { gained: null, lost: null };
  let gained = 0;
  let lost = 0;
  for (const r of br.results ?? []) {
    const t = r.dimension_values?.[0];
    if (t === "FOLLOWER") gained += r.value ?? 0;
    else if (t === "NON_FOLLOWER") lost += r.value ?? 0;
  }
  return { gained, lost };
}

// -----------------------------------------------------------------------------
// Publications
// -----------------------------------------------------------------------------
export interface FbPostNode {
  id: string;
  message?: string;
  created_time: string;
  permalink_url?: string;
  full_picture?: string;
  status_type?: string;
  shares?: { count?: number };
  reactions?: { summary?: { total_count?: number } };
  comments?: { summary?: { total_count?: number } };
  insights?: { data?: InsightSeries[] };
}

export function fbFormat(statusType: string | undefined): PostFormat {
  const st = statusType ?? "";
  if (st.includes("video")) return "video";
  if (st.includes("photo")) return "image";
  if (st === "shared_story") return "link";
  return "status";
}

export function parseFbPost(p: FbPostNode) {
  const metrics: Partial<Record<PostColumn, number>> = {
    likes: p.reactions?.summary?.total_count ?? 0,
    comments: p.comments?.summary?.total_count ?? 0,
    shares: p.shares?.count ?? 0,
  };
  for (const m of p.insights?.data ?? []) {
    const v = insightValue(m.values?.[0]?.value ?? m.total_value?.value);
    if (m.name === "post_total_media_view_unique") metrics.reach = v;
    if (m.name === "post_media_view") metrics.views = v;
  }
  metrics.interactions = (metrics.likes ?? 0) + (metrics.comments ?? 0) + (metrics.shares ?? 0);
  const format = fbFormat(p.status_type);
  return {
    externalId: p.id,
    network: "fb" as const,
    publishedAt: new Date(Date.parse(p.created_time.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"))).toISOString(),
    format,
    caption: p.message ?? null,
    permalink: p.permalink_url ?? null,
    thumbnailUrl: p.full_picture ?? null,
    mediaUrl: p.full_picture ?? null,
    metrics,
  };
}

export interface IgMediaNode {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  timestamp: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  like_count?: number;
  comments_count?: number;
}

export function igFormat(m: Pick<IgMediaNode, "media_type" | "media_product_type">): PostFormat {
  if (m.media_product_type === "STORY") return "story";
  if (m.media_product_type === "REELS") return "reel";
  if (m.media_type === "VIDEO") return "reel";
  if (m.media_type === "CAROUSEL_ALBUM") return "carousel";
  return "image";
}

/** Média IG + insights (nom Meta → valeur) → publication normalisée. */
export function parseIgMedia(m: IgMediaNode, insights: Record<string, number>) {
  const format = igFormat(m);
  const likes = m.like_count ?? 0;
  const comments = m.comments_count ?? 0;
  const metrics: Partial<Record<PostColumn, number>> = { likes, comments };
  if (insights.reach != null) metrics.reach = insights.reach;
  if (insights.views != null) metrics.views = insights.views;
  if (insights.saved != null) metrics.saves = insights.saved;
  if (insights.shares != null) metrics.shares = insights.shares;
  metrics.interactions = insights.total_interactions ?? likes + comments + (metrics.saves ?? 0) + (metrics.shares ?? 0);
  if (format === "reel" && insights.views != null) metrics.video_views = insights.views;
  return {
    externalId: m.id,
    network: "ig" as const,
    publishedAt: new Date(Date.parse(m.timestamp.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"))).toISOString(),
    format,
    caption: m.caption ?? null,
    permalink: m.permalink ?? null,
    thumbnailUrl: m.thumbnail_url ?? m.media_url ?? null,
    mediaUrl: m.media_url ?? null,
    metrics,
  };
}

/** Insights d'un média (réponse /{media}/insights) → { nom: valeur }. */
export function parseMediaInsights(body: InsightsResponse | null | undefined): Record<string, number> {
  const out: Record<string, number> = {};
  for (const d of body?.data ?? []) {
    if (!d.name) continue;
    out[d.name] = d.total_value ? insightValue(d.total_value.value) : insightValue(d.values?.[0]?.value);
  }
  return out;
}

// -----------------------------------------------------------------------------
// Audience
// -----------------------------------------------------------------------------
type BreakdownRow = { dimension_values?: string[]; value?: number };

export function breakdownRows(body: InsightsResponse | null | undefined): BreakdownRow[] {
  return body?.data?.[0]?.total_value?.breakdowns?.[0]?.results ?? [];
}

export function parseDemographics(parts: {
  ageGender?: BreakdownRow[] | null;
  city?: BreakdownRow[] | null;
  country?: BreakdownRow[] | null;
}): AudienceDemographics {
  const out: AudienceDemographics = {};
  if (parts.ageGender?.length) {
    out.age_gender = parts.ageGender.map((r) => {
      const g = r.dimension_values?.[1];
      return { age: r.dimension_values?.[0] ?? "?", gender: g === "F" || g === "M" ? g : "U", value: r.value ?? 0 };
    });
  }
  if (parts.city?.length) out.cities = parts.city.map((r) => ({ key: r.dimension_values?.[0] ?? "?", value: r.value ?? 0 }));
  if (parts.country?.length) out.countries = parts.country.map((r) => ({ key: r.dimension_values?.[0] ?? "?", value: r.value ?? 0 }));
  return out;
}

/** online_followers (values[].value = { "0": n, … "23": n }) → { date: { heure: n } } ; null si vide. */
export function parseOnlineFollowers(body: InsightsResponse | null | undefined): OnlineFollowers | null {
  const out: OnlineFollowers = {};
  for (const v of body?.data?.[0]?.values ?? []) {
    if (!v.end_time || !v.value || typeof v.value !== "object") continue;
    const hours: Record<string, number> = {};
    for (const [h, n] of Object.entries(v.value as Record<string, unknown>)) if (typeof n === "number") hours[h] = n;
    if (Object.keys(hours).length) out[endTimeToDate(v.end_time)] = hours;
  }
  return Object.keys(out).length ? out : null;
}
