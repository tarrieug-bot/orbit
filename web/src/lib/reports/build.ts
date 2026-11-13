import { createTranslator } from "next-intl";
import frMessages from "../../../messages/fr.json";
import enMessages from "../../../messages/en.json";
import type { AppLocale, ISODate, Network } from "@/lib/db/types";
import type { AudienceData, BrandMetricsData, BrandSummary, CampaignItem, PostItem } from "@/lib/db/queries";
import {
  addDays,
  autoGranularity,
  computeDelta,
  computeRateDelta,
  endOfMonth,
  formatBucketLabel,
  formatCompact,
  formatDate,
  formatNumber,
  formatPercent,
  formatPoints,
  formatRange,
  formatSignedNumber,
  formatSignedPercent,
  isISODate,
  isPositiveTrend,
  KPI_DEFINITIONS,
  makeBuckets,
  previousRange,
  rangeLength,
  todayISO,
  toChartData,
  type DateRange,
  type Filters,
  type KpiDefinition,
  type MetricTotals,
} from "@/lib/metrics";
import {
  REPORT_SECTIONS,
  toInsight,
  type ReportAudience,
  type ReportFormatRow,
  type ReportKpi,
  type ReportModel,
  type ReportPeriodInput,
  type ReportSectionKey,
  type ReportSeriesPoint,
  type ReportTopPost,
} from "./model";

/**
 * Construction du modèle de rapport à partir de @/lib/db (droits de l'utilisateur : RLS)
 * et des calculs de @/lib/metrics. Textes : next-intl (namespace « reports » + clés partagées
 * kpi / network / format), via createTranslator : fonctionne aussi hors requête (cron, tests).
 * Règles d'analyse reprises de la fonction `insights` de /index.html.
 */

/** Accès aux données (par défaut @/lib/db ; le cron fournit une variante service role). */
export interface ReportDataLoader {
  getBrand(brandId: string): Promise<BrandSummary | null>;
  getBrandMetrics(brandId: string, filters: Pick<Filters, "range" | "previous" | "networks">): Promise<BrandMetricsData | null>;
  getPosts(brandId: string, q: { range: DateRange; networks?: Network[]; limit?: number }): Promise<PostItem[]>;
  getAudience(brandId: string): Promise<AudienceData | null>;
  getCampaigns(brandId: string): Promise<CampaignItem[]>;
  getOrganization(): Promise<{ name: string; logoUrl: string | null } | null>;
}

export async function defaultReportLoader(): Promise<ReportDataLoader> {
  const db = await import("@/lib/db");
  return {
    getBrand: db.getBrand,
    getBrandMetrics: db.getBrandMetrics,
    getPosts: db.getPosts,
    getAudience: db.getAudience,
    getCampaigns: (id) => db.getCampaigns(id),
    getOrganization: async () => {
      const org = await (await db.getDataSource()).getOrganization();
      return org ? { name: org.name, logoUrl: org.logo_url } : null;
    },
  };
}

export class ReportError extends Error {
  constructor(
    readonly code: "not_found" | "forbidden" | "invalid_period",
    message: string,
  ) {
    super(message);
  }
}

const MESSAGES = { fr: frMessages, en: enMessages } as const;

export function reportTranslator(lang: AppLocale) {
  return createTranslator({ locale: lang, messages: MESSAGES[lang] });
}

/** Période d'un rapport (les données s'arrêtent à la veille). */
export function resolveReportPeriod(
  input: ReportPeriodInput,
  opts: { today: ISODate; campaigns?: CampaignItem[] },
): { range: DateRange; campaign: CampaignItem | null } {
  const yesterday = addDays(opts.today, -1);
  const clamp = (r: DateRange): DateRange => ({ from: r.from, to: r.to > yesterday ? (yesterday < r.from ? r.from : yesterday) : r.to });
  switch (input.type) {
    case "month": {
      const m = input.value && /^\d{4}-\d{2}$/.test(input.value) ? input.value : addDays(`${opts.today.slice(0, 7)}-01`, -1).slice(0, 7);
      const from = `${m}-01`;
      return { range: clamp({ from, to: endOfMonth(from) }), campaign: null };
    }
    case "year": {
      const y = input.value && /^\d{4}$/.test(input.value) ? input.value : opts.today.slice(0, 4);
      return { range: clamp({ from: `${y}-01-01`, to: `${y}-12-31` }), campaign: null };
    }
    case "campaign": {
      const c = opts.campaigns?.find((x) => x.id === input.value);
      if (!c) throw new ReportError("invalid_period", "Campagne introuvable.");
      return { range: c.range, campaign: c };
    }
    case "custom": {
      if (!isISODate(input.from) || !isISODate(input.to)) throw new ReportError("invalid_period", "Dates invalides.");
      const [from, to] = input.from <= input.to ? [input.from, input.to] : [input.to, input.from];
      if (rangeLength({ from, to }) > 800) throw new ReportError("invalid_period", "Période trop longue (2 ans max).");
      return { range: { from, to }, campaign: null };
    }
  }
}

export interface BuildReportInput {
  brandId: string;
  period: ReportPeriodInput;
  compare: boolean;
  sections: string[];
  lang: AppLocale;
  networks?: Network[];
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]!.toUpperCase())
    .join("");
}

export async function buildReportModel(input: BuildReportInput, deps: { loader?: ReportDataLoader; today?: ISODate; now?: Date } = {}): Promise<ReportModel> {
  const loader = deps.loader ?? (await defaultReportLoader());
  const lang = input.lang;
  const t = reportTranslator(lang);
  const tr = (key: string, values?: Record<string, string | number>) => t(`reports.${key}` as never, values as never) as string;
  const today = deps.today ?? todayISO();
  const now = deps.now ?? new Date();

  const brand = await loader.getBrand(input.brandId);
  if (!brand) throw new ReportError("not_found", "Marque introuvable.");
  if (!brand.sections.includes("reports")) throw new ReportError("forbidden", "Rubrique Rapports non autorisée.");

  const campaigns = input.period.type === "campaign" ? await loader.getCampaigns(brand.id) : [];
  const { range, campaign } = resolveReportPeriod(input.period, { today, campaigns });
  const previous = input.compare ? previousRange(range) : null;
  const networks = (input.networks?.length ? input.networks : (["ig", "fb"] as Network[])).filter((n) => brand.networks.includes(n));

  const wanted = new Set(input.sections);
  let sections = REPORT_SECTIONS.filter((s) => wanted.size === 0 || wanted.has(s));
  if (!brand.sections.includes("audience")) sections = sections.filter((s) => s !== "audience");
  if (!sections.length) sections = REPORT_SECTIONS.filter((s) => s !== "audience" || brand.sections.includes("audience"));

  const [metrics, posts, audience, org] = await Promise.all([
    loader.getBrandMetrics(brand.id, { range, previous, networks }),
    loader.getPosts(brand.id, { range, networks, limit: 1000 }),
    sections.includes("audience") ? loader.getAudience(brand.id) : Promise.resolve(null),
    loader.getOrganization(),
  ]);
  if (!metrics) throw new ReportError("not_found", "Marque introuvable.");

  const netLabel = (n: Network) => t(`network.${n}` as never) as string;
  const fmtLabel = (f: string) => t(`format.${f}` as never) as string;

  // --- KPI ------------------------------------------------------------------
  const display = (def: KpiDefinition, v: number) =>
    def.format === "percent" ? formatPercent(v, lang, 2) : def.format === "compact" ? formatCompact(v, lang) : formatNumber(v, lang);
  const kpisOf = (cur: MetricTotals, prev: MetricTotals | null): ReportKpi[] =>
    KPI_DEFINITIONS.map((def) => {
      const v = cur[def.key];
      const available = def.key === "engagementRate" ? cur.available.interactions && cur.available.reach : (cur.available[def.key as keyof MetricTotals["available"]] ?? true);
      let delta: ReportKpi["delta"] = null;
      if (prev && def.delta !== "none") {
        const d = def.delta === "points" ? computeRateDelta(v, prev[def.key]) : computeDelta(v, prev[def.key]);
        const shown = def.delta === "points" ? (d.diff != null ? formatPoints(d.diff, lang) : null) : d.ratio != null ? formatSignedPercent(d.ratio, lang) : null;
        if (shown) delta = { display: shown, trend: d.trend, positive: isPositiveTrend(d.trend, def.higherIsBetter) };
      }
      return { key: def.key, label: t(`${def.i18nKey}.label` as never) as string, value: v, display: available ? display(def, v) : "—", delta, available };
    });

  // --- séries -----------------------------------------------------------------
  const granularity = autoGranularity(range);
  const buckets = makeBuckets(range, granularity);
  const chart = toChartData(metrics.series, buckets, ["followers", "reach", "views", "interactions", "likes", "comments", "shares", "saves"]);
  const points: ReportSeriesPoint[] = chart.map((r) => ({
    key: String(r.key),
    label: formatBucketLabel(String(r.key), granularity, lang),
    followers: r.followers as number | null,
    reach: r.reach as number | null,
    views: r.views as number | null,
    interactions: r.interactions as number | null,
    likes: r.likes as number | null,
    comments: r.comments as number | null,
    shares: r.shares as number | null,
    saves: r.saves as number | null,
  }));

  // --- formats --------------------------------------------------------------
  const groups = new Map<string, { network: Network; format: PostItem["format"]; n: number; reach: number; inter: number }>();
  for (const p of posts) {
    const k = `${p.network}|${p.format}`;
    const g = groups.get(k) ?? { network: p.network, format: p.format, n: 0, reach: 0, inter: 0 };
    g.n++;
    g.reach += p.metrics.reach ?? 0;
    g.inter += p.metrics.interactions;
    groups.set(k, g);
  }
  const fmtRows = [...groups.values()].map((g) => ({ ...g, er: g.reach ? g.inter / g.reach : 0 })).sort((a, b) => b.er - a.er);
  const maxEr = fmtRows[0]?.er || 1;
  const formats: ReportFormatRow[] = fmtRows.map((g) => ({
    network: g.network,
    networkLabel: netLabel(g.network),
    format: g.format,
    formatLabel: fmtLabel(g.format),
    posts: g.n,
    avgReach: g.reach / g.n,
    avgInteractions: g.inter / g.n,
    engagementRate: g.er,
    display: { posts: formatNumber(g.n, lang), avgReach: formatCompact(Math.round(g.reach / g.n), lang), avgInteractions: formatNumber(Math.round(g.inter / g.n), lang), engagementRate: formatPercent(g.er, lang, 2) },
    bar: g.er / maxEr,
  }));

  // --- top publications -------------------------------------------------------
  const caption = (p: PostItem) => (p.caption?.trim() ? p.caption.trim() : tr("noCaption"));
  const dateOf = (p: PostItem) => formatDate(localISODate(p.publishedAt), lang, { day: "numeric", month: "long" });
  const topPosts: ReportTopPost[] = [...posts]
    .sort((a, b) => b.metrics.interactions - a.metrics.interactions)
    .slice(0, 6)
    .map((p) => ({
      id: p.id,
      network: p.network,
      networkLabel: netLabel(p.network),
      format: p.format,
      formatLabel: fmtLabel(p.format),
      publishedAt: p.publishedAt,
      dateLabel: dateOf(p),
      caption: caption(p).slice(0, 280),
      permalink: p.permalink,
      thumbnailUrl: p.thumbnailUrl,
      reach: p.metrics.reach,
      interactions: p.metrics.interactions,
      engagementRate: p.metrics.engagementRate,
      display: {
        reach: p.metrics.reach != null ? formatCompact(p.metrics.reach, lang) : "—",
        interactions: formatNumber(p.metrics.interactions, lang),
        engagementRate: p.metrics.engagementRate != null ? formatPercent(p.metrics.engagementRate, lang, 2) : "—",
      },
    }));

  // --- audience ---------------------------------------------------------------
  let aud: ReportAudience | null = null;
  if (audience) {
    let regions: Intl.DisplayNames | null = null;
    try {
      regions = new Intl.DisplayNames([lang], { type: "region" });
    } catch {
      regions = null;
    }
    aud = {
      accountHandle: audience.account.handle,
      ageGender: audience.ageGender.map((a) => ({ age: a.age, female: a.female, male: a.male })),
      genders: { female: formatPercent(audience.genderShares.female, lang, 0), male: formatPercent(audience.genderShares.male, lang, 0) },
      cities: audience.cities.slice(0, 6).map((c) => ({ label: c.key, share: c.share, display: formatPercent(c.share, lang, 1) })),
      countries: audience.countries.slice(0, 6).map((c) => {
        let label = c.key;
        try {
          label = regions?.of(c.key) ?? c.key;
        } catch {
          label = c.key;
        }
        return { label, share: c.share, display: formatPercent(c.share, lang, 1) };
      }),
    };
  }

  // --- analyses ---------------------------------------------------------------
  const insights = buildInsights({ lang, tr, netLabel, fmtLabel, cur: metrics.totals, prev: metrics.previous, posts, days: rangeLength(range), caption, dateOf }).map(toInsight);

  // --- CSV --------------------------------------------------------------------
  const accById = new Map(metrics.accounts.map((a) => [a.id, a]));
  const csvKeys = ["followers", "followersGained", "followersLost", "reach", "views", "interactions", "likes", "comments", "shares", "saves", "posts", "profileVisits", "linkClicks"] as const;
  const csv: string[][] = [
    [tr("csv.date"), tr("csv.network"), tr("csv.account"), ...csvKeys.map((k) => t(`kpi.${k}.label` as never) as string)],
    ...metrics.rows
      .filter((r) => r.date >= range.from && r.date <= range.to)
      .sort((a, b) => (a.date === b.date ? a.network.localeCompare(b.network) : a.date < b.date ? -1 : 1))
      .map((r) => [r.date, netLabel(r.network), accById.get(r.accountId)?.handle ?? "", ...csvKeys.map((k) => (r[k] == null ? "" : String(r[k])))]),
  ];

  const kind = tr(`kind.${input.period.type}`);
  const periodLabel = campaign ? `${campaign.name} · ${formatRange(range, lang)}` : input.period.type === "month" ? formatDate(range.from, lang, { month: "long", year: "numeric" }) : input.period.type === "year" ? range.from.slice(0, 4) : formatRange(range, lang);
  const sectionKeys = Object.fromEntries(REPORT_SECTIONS.map((s) => [s, tr(`section.${s}`)])) as Record<ReportSectionKey, string>;
  const sectionIntros = Object.fromEntries(REPORT_SECTIONS.map((s) => [s, tr(`sectionIntro.${s}`)])) as Record<ReportSectionKey, string>;
  const kpiLabel = (k: string) => t(`kpi.${k}.label` as never) as string;

  return {
    version: 1,
    lang,
    generatedAt: now.toISOString(),
    agency: { name: org?.name ?? null, logoUrl: org?.logoUrl ?? null },
    brand: { id: brand.id, name: brand.name, color: brand.color, sector: brand.sector, avatarUrl: brand.avatarUrl, initials: initials(brand.name) },
    accounts: metrics.accounts.map((a) => ({
      id: a.id,
      network: a.network,
      networkLabel: netLabel(a.network),
      handle: a.handle,
      name: a.name,
      avatarUrl: a.avatarUrl,
      followersDisplay: formatNumber(a.followersCount ?? 0, lang),
    })),
    period: { type: input.period.type, range, label: periodLabel, title: kind, days: rangeLength(range), campaignName: campaign?.name ?? null },
    comparison: previous ? { range: previous, label: formatRange(previous, lang) } : null,
    sections,
    labels: {
      title: kind,
      subtitle: tr("coverSubtitle"),
      periodLine: `${tr("periodLabel")}${lang === "fr" ? " : " : ": "}${formatRange(range, lang)}`,
      comparisonLine: previous ? tr("comparedTo", { range: formatRange(previous, lang) }) : null,
      generatedOn: tr("generatedOn", { date: formatDate(localISODate(now.toISOString()), lang, { day: "numeric", month: "long", year: "numeric" }) }),
      agencyLogo: tr("agencyLogo"),
      confidential: tr("confidential"),
      accounts: tr("accounts"),
      vsPrevious: tr("vsPrevious"),
      sections: sectionKeys,
      sectionIntros,
      table: {
        format: tr("table.format"),
        posts: tr("table.posts"),
        avgReach: tr("table.avgReach"),
        avgInteractions: tr("table.avgInteractions"),
        engagementRate: tr("table.engagementRate"),
        network: tr("table.network"),
        date: tr("table.date"),
        caption: tr("table.caption"),
        reach: tr("table.reach"),
        interactions: tr("table.interactions"),
      },
      metrics: {
        followers: kpiLabel("followers"),
        reach: kpiLabel("reach"),
        views: kpiLabel("views"),
        interactions: kpiLabel("interactions"),
        likes: kpiLabel("likes"),
        comments: kpiLabel("comments"),
        shares: kpiLabel("shares"),
        saves: kpiLabel("saves"),
      },
      noPosts: tr("noPosts"),
      noAudience: tr("noAudience"),
      ageGender: tr("ageGender"),
      women: tr("women"),
      men: tr("men"),
      cities: tr("cities"),
      countries: tr("countries"),
      followersEvolution: tr("followersEvolution"),
      byNetwork: tr("byNetwork"),
    },
    kpis: kpisOf(metrics.totals, metrics.previous),
    byNetwork: metrics.byNetwork.map((n) => ({ network: n.network, label: netLabel(n.network), kpis: kpisOf(n.totals, n.previous) })),
    series: { granularity, points },
    audience: aud,
    formats,
    topPosts,
    insights,
    csv,
  };
}

/** Date locale (Martinique) d'un horodatage. */
function localISODate(ts: string): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "America/Martinique", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
}

/** Analyses / recommandations automatiques (règles de la version d'essai, FR et EN). */
function buildInsights(o: {
  lang: AppLocale;
  tr: (key: string, values?: Record<string, string | number>) => string;
  netLabel: (n: Network) => string;
  fmtLabel: (f: string) => string;
  cur: MetricTotals;
  prev: MetricTotals | null;
  posts: PostItem[];
  days: number;
  caption: (p: PostItem) => string;
  dateOf: (p: PostItem) => string;
}): string[] {
  const { lang, tr, cur, prev, posts } = o;
  const out: string[] = [];
  out.push(
    tr("insight.community", {
      followers: formatNumber(cur.followers, lang),
      net: formatSignedNumber(cur.followersNet, lang),
      growth: formatSignedPercent(cur.followersGrowth, lang),
    }),
  );
  if (prev) {
    const cr = prev.reach ? (cur.reach - prev.reach) / prev.reach : 0;
    const ci = prev.interactions ? (cur.interactions - prev.interactions) / prev.interactions : 0;
    out.push(
      tr("insight.change", {
        reachTrend: cr >= 0 ? "up" : "down",
        reach: formatSignedPercent(cr, lang),
        interTrend: ci >= 0 ? "up" : "down",
        inter: formatSignedPercent(ci, lang),
      }),
    );
    out.push(tr("insight.engagementRate", { rate: formatPercent(cur.engagementRate, lang, 2), diff: formatPoints(cur.engagementRate - prev.engagementRate, lang) }));
  } else {
    out.push(tr("insight.engagementRateNoCompare", { rate: formatPercent(cur.engagementRate, lang, 2) }));
  }

  const byType = new Map<string, { network: Network; format: string; r: number; i: number; n: number }>();
  for (const p of posts) {
    const k = `${p.network}|${p.format}`;
    const g = byType.get(k) ?? { network: p.network, format: p.format, r: 0, i: 0, n: 0 };
    g.r += p.metrics.reach ?? 0;
    g.i += p.metrics.interactions;
    g.n++;
    byType.set(k, g);
  }
  const ts = [...byType.values()].filter((x) => x.n >= 2 && x.r > 0).map((x) => ({ ...x, er: x.i / x.r })).sort((a, b) => b.er - a.er);
  if (ts.length > 1) {
    const f = ts[0];
    const l = ts[ts.length - 1];
    out.push(
      tr("insight.bestFormat", {
        format: o.fmtLabel(f.format),
        network: o.netLabel(f.network),
        rate: formatPercent(f.er, lang, 2),
        count: f.n,
        worstRate: formatPercent(l.er, lang, 2),
        worstFormat: o.fmtLabel(l.format),
        worstNetwork: o.netLabel(l.network),
      }),
    );
  }

  const withEr = posts.filter((p) => p.metrics.engagementRate != null);
  const best = [...withEr].sort((a, b) => (b.metrics.engagementRate ?? 0) - (a.metrics.engagementRate ?? 0))[0];
  if (best) {
    const cap = o.caption(best);
    out.push(
      tr("insight.bestPost", {
        caption: cap.length > 90 ? `${cap.slice(0, 89)}…` : cap,
        network: o.netLabel(best.network),
        date: o.dateOf(best),
        interactions: formatNumber(best.metrics.interactions, lang),
        rate: formatPercent(best.metrics.engagementRate ?? 0, lang, 2),
      }),
    );
  }

  const byDay = new Map<number, { r: number; i: number }>();
  for (const p of posts) {
    const d = new Date(`${localISODate(p.publishedAt)}T12:00:00Z`).getUTCDay();
    const g = byDay.get(d) ?? { r: 0, i: 0 };
    g.r += p.metrics.reach ?? 0;
    g.i += p.metrics.interactions;
    byDay.set(d, g);
  }
  const days = [...byDay.entries()].filter(([, v]) => v.r > 0).map(([d, v]) => ({ d, er: v.i / v.r })).sort((a, b) => b.er - a.er);
  if (days.length > 2) {
    const name = (d: number) => new Date(Date.UTC(2026, 0, 4 + d)).toLocaleDateString(lang === "fr" ? "fr-FR" : "en-GB", { weekday: "long", timeZone: "UTC" });
    out.push(tr("insight.bestDay", { best: name(days[0].d), worst: name(days[days.length - 1].d) }));
  }

  const perWeek = cur.posts / (o.days / 7);
  out.push(tr(perWeek < 3 ? "insight.frequencyLow" : "insight.frequency", { perWeek: formatNumber(perWeek, lang, 1) }));
  return out;
}
