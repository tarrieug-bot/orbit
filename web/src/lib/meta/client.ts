import "server-only";
import { serverEnv } from "@/lib/env.server";
import type { ISODate, SyncCallLog } from "@/lib/db/types";
import { META_METRIC_MAP, type DailyColumn } from "./metric-map";
import { GraphClient, MetaApiError, type BatchRequest } from "./graph";
import {
  addDaysISO,
  breakdownRows,
  chunkRange,
  eachDate,
  parseDailySeries,
  parseDemographics,
  parseFbPost,
  parseFollowsBreakdown,
  parseIgMedia,
  parseMediaInsights,
  parseOnlineFollowers,
  parseTotalValues,
  toUnix,
  type FbPostNode,
  type IgMediaNode,
  type InsightsResponse,
} from "./parse";
import type {
  DailyValues,
  DateRange,
  DiscoveredAccount,
  ExchangedToken,
  FetchedAudience,
  FetchedPost,
  FetchedProfile,
  MetaCallContext,
  MetaResult,
} from "./types";

/**
 * Client API Graph Meta (serveur uniquement). Référence : module « MODE LIVE » de /index.html.
 *  - toute métrique en erreur (code 100…) est journalisée puis ignorée, sans casser le reste ;
 *  - une erreur 190 (jeton invalide) est RELANCÉE (MetaApiError.isAuthError) : la collecte
 *    passe alors le compte en reconnexion requise ;
 *  - les appels par jour / par média passent par la Batch API (50 requêtes par lot).
 */

export { MetaApiError } from "./graph";

/** App Secret si configuré (appsecret_proof) — jamais requis pour lire. */
function optionalAppSecret(): string | null {
  return process.env.META_APP_SECRET || null;
}

export function apiVersion(): string {
  return process.env.META_API_VERSION || META_METRIC_MAP.apiVersion;
}

/** Client Graph pour un jeton donné (partageable entre plusieurs appels d'une même synchro). */
export function createGraphClient(accessToken: string, opts: { deadline?: number; fetchImpl?: typeof fetch; sleep?: (ms: number) => Promise<void> } = {}) {
  return new GraphClient({ accessToken, apiVersion: apiVersion(), appSecret: optionalAppSecret(), ...opts });
}

function graphOf(ctx: MetaCallContext): GraphClient {
  return ctx.graph ?? new GraphClient({ accessToken: ctx.accessToken, apiVersion: ctx.apiVersion, appSecret: optionalAppSecret() });
}

function rethrowAuth(err: unknown): void {
  if (err instanceof MetaApiError && err.isAuthError) throw err;
}

const errMsg = (err: unknown) => (err instanceof Error ? err.message : String(err));

function qs(params: Record<string, string | number>): string {
  return Object.entries(params)
    .map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`)
    .join("&");
}

/** Range des valeurs par jour → DailyValues triés. */
function toDailyValues(byDate: Map<ISODate, Partial<Record<DailyColumn, number>>>): DailyValues[] {
  return [...byDate.entries()]
    .filter(([, v]) => Object.keys(v).length > 0)
    .sort(([a], [b]) => (a < b ? -1 : 1))
    .map(([date, values]) => ({ date, values }));
}

function setValue(map: Map<ISODate, Partial<Record<DailyColumn, number>>>, date: ISODate, col: DailyColumn, v: number) {
  const row = map.get(date) ?? {};
  row[col] = v;
  map.set(date, row);
}

// =============================================================================
// Facebook — métriques quotidiennes de Page
// =============================================================================

/** Métriques quotidiennes d'une Page Facebook (fenêtres ≤ 89 jours, une requête groupée par métrique × fenêtre). */
export async function fetchPageDaily(ctx: MetaCallContext, range: DateRange): Promise<MetaResult<DailyValues[]>> {
  const g = graphOf(ctx);
  const calls: SyncCallLog[] = [];
  const metrics = META_METRIC_MAP.facebookPage;
  const windows = chunkRange(range, metrics[0]?.maxWindowDays ?? 89);
  const reqs: (BatchRequest & { metric: (typeof metrics)[number]; win: DateRange })[] = [];
  for (const metric of metrics) {
    for (const win of windows) {
      reqs.push({
        metric,
        win,
        relativeUrl: `${ctx.externalId}/insights?${qs({ metric: metric.metric, period: "day", since: toUnix(win.from), until: toUnix(addDaysISO(win.to, 1)) })}`,
      });
    }
  }
  const res = await g.batch<InsightsResponse>(reqs);
  const byDate = new Map<ISODate, Partial<Record<DailyColumn, number>>>();
  for (const metric of metrics) {
    let n = 0;
    let error: string | null = null;
    reqs.forEach((r, i) => {
      if (r.metric !== metric) return;
      const x = res[i];
      if (!x) return;
      if (!x.ok) {
        error = error ?? `${x.error.code ? `(#${x.error.code}) ` : ""}${x.error.message}`;
        return;
      }
      for (const [date, v] of parseDailySeries(x.body, r.win)) {
        setValue(byDate, date, metric.column, v);
        n++;
      }
    });
    calls.push(error && !n ? { metric: `fb:${metric.metric}`, ok: false, message: error } : { metric: `fb:${metric.metric}`, ok: true, values: n, ...(error ? { message: `partiel : ${error}` } : {}) });
  }
  return { data: toDailyValues(byDate), calls };
}

// =============================================================================
// Instagram — métriques quotidiennes
// =============================================================================

const IG_FOLLOWS = "follows_and_unfollows";

/** Sonde les métriques « total_value » disponibles pour ce compte (un lot, un jour). */
export async function probeIgMetrics(ctx: MetaCallContext, day: ISODate): Promise<{ valid: string[]; follows: boolean; calls: SyncCallLog[] }> {
  const g = graphOf(ctx);
  const totals = [...new Set(META_METRIC_MAP.instagramAccount.filter((m) => m.metricType === "total_value" && !m.breakdown).map((m) => m.metric))];
  const base = { period: "day", metric_type: "total_value", since: toUnix(day), until: toUnix(addDaysISO(day, 1)) };
  const reqs: BatchRequest[] = [
    ...totals.map((m) => ({ relativeUrl: `${ctx.externalId}/insights?${qs({ metric: m, ...base })}` })),
    { relativeUrl: `${ctx.externalId}/insights?${qs({ metric: IG_FOLLOWS, breakdown: "follow_type", ...base })}` },
  ];
  const res = await g.batch(reqs);
  const calls: SyncCallLog[] = [];
  const valid: string[] = [];
  totals.forEach((m, i) => {
    const x = res[i];
    if (x?.ok) valid.push(m);
    else calls.push({ metric: `ig:${m}`, ok: false, message: x && !x.ok ? x.error.message : "sans réponse" });
  });
  const f = res[totals.length];
  const follows = !!f?.ok;
  if (!follows) calls.push({ metric: `ig:${IG_FOLLOWS}`, ok: false, message: f && !f.ok ? f.error.message : "sans réponse" });
  return { valid, follows, calls };
}

/** Métriques quotidiennes d'un compte Instagram professionnel. */
export async function fetchIgDaily(ctx: MetaCallContext, range: DateRange): Promise<MetaResult<DailyValues[]>> {
  const g = graphOf(ctx);
  const probe = await probeIgMetrics(ctx, range.to);
  const calls: SyncCallLog[] = [...probe.calls];
  const colOf = new Map(META_METRIC_MAP.instagramAccount.filter((m) => m.metricType === "total_value" && !m.breakdown).map((m) => [m.metric, m.column]));
  const reachDef = META_METRIC_MAP.instagramAccount.find((m) => m.metric === "reach");
  const windows = chunkRange(range, Math.max(1, (reachDef?.maxWindowDays ?? 30) - 1));
  const days = eachDate(range);

  type Req = BatchRequest & { kind: "reach" | "totals" | "follows"; win?: DateRange; day?: ISODate };
  const reqs: Req[] = windows.map((win) => ({
    kind: "reach",
    win,
    relativeUrl: `${ctx.externalId}/insights?${qs({ metric: "reach", period: "day", since: toUnix(win.from), until: toUnix(addDaysISO(win.to, 1)) })}`,
  }));
  for (const day of days) {
    const base = { period: "day", metric_type: "total_value", since: toUnix(day), until: toUnix(addDaysISO(day, 1)) };
    if (probe.valid.length) reqs.push({ kind: "totals", day, relativeUrl: `${ctx.externalId}/insights?${qs({ metric: probe.valid.join(","), ...base })}` });
    if (probe.follows) reqs.push({ kind: "follows", day, relativeUrl: `${ctx.externalId}/insights?${qs({ metric: IG_FOLLOWS, breakdown: "follow_type", ...base })}` });
  }
  const res = await g.batch<InsightsResponse>(reqs);
  const byDate = new Map<ISODate, Partial<Record<DailyColumn, number>>>();
  const stats = { reach: { ok: 0, ko: 0, last: "" }, totals: { ok: 0, ko: 0, last: "" }, follows: { ok: 0, ko: 0, last: "" } };
  reqs.forEach((r, i) => {
    const x = res[i];
    const st = stats[r.kind];
    if (!x || !x.ok) {
      st.ko++;
      st.last = x && !x.ok ? x.error.message : "sans réponse";
      return;
    }
    st.ok++;
    if (r.kind === "reach") {
      for (const [date, v] of parseDailySeries(x.body, r.win)) setValue(byDate, date, "reach", v);
    } else if (r.kind === "totals" && r.day) {
      for (const [name, v] of Object.entries(parseTotalValues(x.body))) {
        const col = colOf.get(name);
        if (col) setValue(byDate, r.day, col, v);
      }
    } else if (r.kind === "follows" && r.day) {
      const f = parseFollowsBreakdown(x.body);
      if (f.gained != null) setValue(byDate, r.day, "followers_gained", f.gained);
      if (f.lost != null) setValue(byDate, r.day, "followers_lost", f.lost);
    }
  });
  const log = (metric: string, s: { ok: number; ko: number; last: string }, unit: string) => {
    if (!s.ok && !s.ko) return;
    calls.push({ metric, ok: s.ok > 0, values: s.ok, message: `${s.ok} ${unit} OK${s.ko ? ` · ${s.ko} en erreur : ${s.last}` : ""}` });
  };
  log("ig:reach", stats.reach, "fenêtre(s)");
  log(`ig:${probe.valid.join(",") || "totaux"}`, stats.totals, "jour(s)");
  log(`ig:${IG_FOLLOWS}`, stats.follows, "jour(s)");
  return { data: toDailyValues(byDate), calls };
}

// =============================================================================
// Publications
// =============================================================================

interface Paged<T> {
  data?: T[];
  paging?: { next?: string };
}

const FB_POST_FIELDS =
  "id,message,created_time,permalink_url,full_picture,status_type,shares,reactions.summary(total_count).limit(0),comments.summary(total_count).limit(0)";
const FB_POST_INSIGHTS = ",insights.metric(post_total_media_view_unique,post_media_view)";
const IG_MEDIA_FIELDS = "id,caption,media_type,media_product_type,timestamp,permalink,thumbnail_url,media_url,like_count,comments_count";

/** Publications (FB : /published_posts ; IG : /media) publiées depuis `since` (jusqu'à `until` inclus), avec statistiques. */
export async function fetchPosts(
  ctx: MetaCallContext,
  opts: { network: "fb" | "ig"; since: string; until?: string; limit?: number },
): Promise<MetaResult<FetchedPost[]>> {
  return opts.network === "fb" ? fetchFbPosts(ctx, opts) : fetchIgPosts(ctx, opts);
}

async function fetchFbPosts(ctx: MetaCallContext, opts: { since: string; until?: string; limit?: number }): Promise<MetaResult<FetchedPost[]>> {
  const g = graphOf(ctx);
  const calls: SyncCallLog[] = [];
  const limit = opts.limit ?? 1500;
  const until = opts.until ?? addDaysISO(new Date().toISOString().slice(0, 10), 1);
  let withInsights = true;
  const posts: FetchedPost[] = [];
  let next: string | null = null;
  let pages = 0;
  while (pages < 60) {
    let r: Paged<FbPostNode>;
    try {
      r = next
        ? await g.getUrl<Paged<FbPostNode>>(next)
        : await g.get<Paged<FbPostNode>>(`${ctx.externalId}/published_posts`, {
            fields: FB_POST_FIELDS + (withInsights ? FB_POST_INSIGHTS : ""),
            since: toUnix(opts.since),
            until: toUnix(addDaysISO(until, 1)),
            limit: 50,
          });
    } catch (err) {
      rethrowAuth(err);
      if (!next && withInsights) {
        calls.push({ metric: "fb:post_insights", ok: false, message: errMsg(err) });
        withInsights = false;
        continue;
      }
      calls.push({ metric: "fb:published_posts", ok: false, message: errMsg(err) });
      break;
    }
    pages++;
    for (const p of r.data ?? []) posts.push(parseFbPost(p));
    if (r.paging?.next && posts.length < limit) next = r.paging.next;
    else break;
  }
  calls.push({ metric: "fb:published_posts", ok: true, values: posts.length, message: withInsights ? undefined : "sans portée par publication" });
  return { data: posts, calls };
}

async function fetchIgPosts(ctx: MetaCallContext, opts: { since: string; until?: string; limit?: number }): Promise<MetaResult<FetchedPost[]>> {
  const g = graphOf(ctx);
  const calls: SyncCallLog[] = [];
  const limit = opts.limit ?? 1500;
  const sinceMs = Date.parse(`${opts.since}T00:00:00Z`);
  const untilMs = opts.until ? Date.parse(`${addDaysISO(opts.until, 1)}T00:00:00Z`) : Infinity;
  const media: IgMediaNode[] = [];
  let next: string | null = null;
  let pages = 0;
  let stop = false;
  while (!stop && pages < 60) {
    let r: Paged<IgMediaNode>;
    try {
      r = next ? await g.getUrl<Paged<IgMediaNode>>(next) : await g.get<Paged<IgMediaNode>>(`${ctx.externalId}/media`, { fields: IG_MEDIA_FIELDS, limit: 50 });
    } catch (err) {
      rethrowAuth(err);
      calls.push({ metric: "ig:media", ok: false, message: errMsg(err) });
      break;
    }
    pages++;
    for (const m of r.data ?? []) {
      const t = Date.parse(m.timestamp.replace(/([+-]\d{2})(\d{2})$/, "$1:$2"));
      if (t < sinceMs) {
        stop = true;
        break;
      }
      if (t < untilMs) media.push(m);
      if (media.length >= limit) stop = true;
    }
    if (!stop && r.paging?.next) next = r.paging.next;
    else break;
  }

  // Sonde des statistiques valides par format (un lot), puis un lot de requêtes par média.
  const candidates = META_METRIC_MAP.instagramMedia.filter((m) => m.period === "lifetime").map((m) => m.metric);
  const formatOf = (m: IgMediaNode) => parseIgMedia(m, {}).format;
  const samples = new Map<string, IgMediaNode>();
  for (const m of media) if (!samples.has(formatOf(m))) samples.set(formatOf(m), m);
  const probeReqs: (BatchRequest & { format: string; metric: string })[] = [];
  for (const [format, m] of samples) for (const metric of candidates) probeReqs.push({ format, metric, relativeUrl: `${m.id}/insights?${qs({ metric })}` });
  const probe = probeReqs.length ? await g.batch(probeReqs) : [];
  const valid = new Map<string, string[]>();
  probeReqs.forEach((r, i) => {
    const list = valid.get(r.format) ?? [];
    if (probe[i]?.ok) list.push(r.metric);
    valid.set(r.format, list);
  });
  for (const [format, list] of valid) {
    const missing = candidates.filter((c) => !list.includes(c));
    if (missing.length) calls.push({ metric: `ig:media_insights:${format}`, ok: list.length > 0, message: `indisponible : ${missing.join(", ")}` });
  }
  const reqs = media.map((m) => ({ m, metrics: valid.get(formatOf(m)) ?? [] })).filter((x) => x.metrics.length);
  const res = reqs.length ? await g.batch<InsightsResponse>(reqs.map((x) => ({ relativeUrl: `${x.m.id}/insights?${qs({ metric: x.metrics.join(",") })}` }))) : [];
  const insights = new Map<string, Record<string, number>>();
  let ko = 0;
  reqs.forEach((x, i) => {
    const r = res[i];
    if (r?.ok) insights.set(x.m.id, parseMediaInsights(r.body));
    else ko++;
  });
  const posts = media.map((m) => parseIgMedia(m, insights.get(m.id) ?? {}));
  calls.push({ metric: "ig:media", ok: true, values: posts.length, message: ko ? `${ko} sans statistiques` : undefined });
  return { data: posts, calls };
}

// =============================================================================
// Audience (Instagram)
// =============================================================================

/** Démographie + abonnés en ligne (Instagram uniquement). */
export async function fetchAudience(ctx: MetaCallContext): Promise<MetaResult<FetchedAudience>> {
  const g = graphOf(ctx);
  const calls: SyncCallLog[] = [];
  const def = META_METRIC_MAP.instagramAudience.find((a) => a.metric === "follower_demographics");
  const breakdowns = def?.breakdowns ?? ["age,gender", "city", "country"];
  const results: Record<string, ReturnType<typeof breakdownRows> | null> = {};
  for (const bd of breakdowns) {
    let last = "";
    results[bd] = null;
    for (const extra of [{}, { timeframe: "this_month" }, { timeframe: "last_90_days" }]) {
      try {
        const r = await g.get<InsightsResponse>(`${ctx.externalId}/insights`, {
          metric: "follower_demographics",
          period: "lifetime",
          metric_type: "total_value",
          breakdown: bd,
          ...extra,
        });
        results[bd] = breakdownRows(r);
        calls.push({ metric: `ig:follower_demographics:${bd}`, ok: true, values: results[bd]?.length ?? 0 });
        break;
      } catch (err) {
        rethrowAuth(err);
        last = errMsg(err);
      }
    }
    if (results[bd] == null) calls.push({ metric: `ig:follower_demographics:${bd}`, ok: false, message: last });
  }
  const today = new Date().toISOString().slice(0, 10);
  let onlineFollowers = null;
  try {
    const r = await g.get<InsightsResponse>(`${ctx.externalId}/insights`, {
      metric: "online_followers",
      period: "lifetime",
      since: toUnix(addDaysISO(today, -7)),
      until: toUnix(today),
    });
    onlineFollowers = parseOnlineFollowers(r);
    calls.push({ metric: "ig:online_followers", ok: !!onlineFollowers, values: onlineFollowers ? Object.keys(onlineFollowers).length : 0, message: onlineFollowers ? undefined : "vide (repli : engagement des publications)" });
  } catch (err) {
    rethrowAuth(err);
    calls.push({ metric: "ig:online_followers", ok: false, message: errMsg(err) });
  }
  return {
    data: {
      date: today,
      demographics: parseDemographics({ ageGender: results["age,gender"], city: results.city, country: results.country }),
      onlineFollowers,
    },
    calls,
  };
}

// =============================================================================
// Profil, jetons, découverte des comptes
// =============================================================================

interface FbPageNode {
  id: string;
  name?: string;
  username?: string;
  category?: string;
  access_token?: string;
  followers_count?: number;
  fan_count?: number;
  picture?: { data?: { url?: string } };
  instagram_business_account?: IgUserNode;
}
interface IgUserNode {
  id: string;
  username?: string;
  name?: string;
  followers_count?: number;
  profile_picture_url?: string;
}

export function fbProfileFrom(p: FbPageNode): FetchedProfile {
  return {
    externalId: p.id,
    network: "fb",
    name: p.name ?? null,
    handle: p.username ? p.username : (p.name ?? null),
    avatarUrl: p.picture?.data?.url ?? null,
    followersCount: p.followers_count ?? p.fan_count ?? null,
  };
}

export function igProfileFrom(u: IgUserNode): FetchedProfile {
  return {
    externalId: u.id,
    network: "ig",
    name: u.name ?? u.username ?? null,
    handle: u.username ? `@${u.username}` : null,
    avatarUrl: u.profile_picture_url ?? null,
    followersCount: u.followers_count ?? null,
  };
}

/** Profil (nom, @, photo de profil, abonnés) — appelé à chaque synchro pour rafraîchir avatar_url. */
export async function fetchProfile(ctx: MetaCallContext, network: "fb" | "ig"): Promise<MetaResult<FetchedProfile>> {
  const g = graphOf(ctx);
  if (network === "fb") {
    const p = await g.get<FbPageNode>(ctx.externalId, { fields: "id,name,username,category,followers_count,fan_count,picture.type(large){url}" });
    return { data: fbProfileFrom(p), calls: [{ metric: "fb:profile", ok: true, message: p.picture?.data?.url ? "photo à jour" : "sans photo" }] };
  }
  const u = await g.get<IgUserNode>(ctx.externalId, { fields: "id,username,name,followers_count,profile_picture_url" });
  return { data: igProfileFrom(u), calls: [{ metric: "ig:profile", ok: true, message: u.profile_picture_url ? "photo à jour" : "sans photo" }] };
}

function appClient(): GraphClient {
  return new GraphClient({ accessToken: "", apiVersion: apiVersion() });
}

/** Code OAuth (Facebook Login for Business, flux « code ») → jeton utilisateur court. */
export async function exchangeCode(code: string, redirectUri: string): Promise<ExchangedToken> {
  const r = await appClient().get<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    client_id: serverEnv("META_APP_ID"),
    client_secret: serverEnv("META_APP_SECRET"),
    redirect_uri: redirectUri,
    code,
  });
  return { accessToken: r.access_token, expiresAt: r.expires_in ? new Date(Date.now() + r.expires_in * 1000).toISOString() : null };
}

/** Échange un jeton utilisateur court (Login for Business) contre un jeton longue durée (~60 j). */
export async function exchangeToken(shortLivedUserToken: string): Promise<ExchangedToken> {
  const r = await appClient().get<{ access_token: string; expires_in?: number }>("oauth/access_token", {
    grant_type: "fb_exchange_token",
    client_id: serverEnv("META_APP_ID"),
    client_secret: serverEnv("META_APP_SECRET"),
    fb_exchange_token: shortLivedUserToken,
  });
  return { accessToken: r.access_token, expiresAt: r.expires_in ? new Date(Date.now() + r.expires_in * 1000).toISOString() : null };
}

/**
 * Date d'expiration effective d'un jeton (expires_at, sinon data_access_expires_at :
 * Meta coupe l'accès aux données 90 j après la dernière connexion). null si inconnue.
 */
export async function tokenExpiry(token: string): Promise<string | null> {
  try {
    const r = await appClient().get<{ data?: { expires_at?: number; data_access_expires_at?: number } }>("debug_token", {
      input_token: token,
      access_token: `${serverEnv("META_APP_ID")}|${serverEnv("META_APP_SECRET")}`,
    });
    const candidates = [r.data?.expires_at, r.data?.data_access_expires_at].filter((x): x is number => !!x && x > 0);
    return candidates.length ? new Date(Math.min(...candidates) * 1000).toISOString() : null;
  } catch {
    return null;
  }
}

/** Liste les Pages et comptes IG accessibles avec un jeton utilisateur longue durée. */
export async function discoverAccounts(longLivedUserToken: string): Promise<DiscoveredAccount[]> {
  const g = new GraphClient({ accessToken: longLivedUserToken, apiVersion: apiVersion(), appSecret: optionalAppSecret() });
  const fields =
    "id,name,username,category,access_token,followers_count,fan_count,picture.type(large){url},instagram_business_account{id,username,name,followers_count,profile_picture_url}";
  let r = await g.get<Paged<FbPageNode>>("me/accounts", { fields, limit: 100 });
  const pages = [...(r.data ?? [])];
  for (let guard = 0; r.paging?.next && guard < 20; guard++) {
    r = await g.getUrl<Paged<FbPageNode>>(r.paging.next);
    pages.push(...(r.data ?? []));
  }
  return discoveredFromPages(pages);
}

/** Pages /me/accounts → comptes découverts (Page + IG lié). Pur, exporté pour les tests. */
export function discoveredFromPages(pages: FbPageNode[]): DiscoveredAccount[] {
  const out: DiscoveredAccount[] = [];
  for (const p of pages) {
    if (!p.access_token) continue;
    out.push({ ...fbProfileFrom(p), pageAccessToken: p.access_token, parentPageId: null, category: p.category ?? null });
    const ig = p.instagram_business_account;
    if (ig?.id) out.push({ ...igProfileFrom(ig), pageAccessToken: p.access_token, parentPageId: p.id, category: p.category ?? null });
  }
  return out;
}
