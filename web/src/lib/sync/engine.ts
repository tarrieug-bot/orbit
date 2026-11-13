import type { AccountSyncStateRow, ISODate, SocialAccountRow, SyncCallLog, SyncStatus } from "@/lib/db/types";
import { createGraphClient, fetchAudience, fetchIgDaily, fetchPageDaily, fetchPosts, fetchProfile } from "@/lib/meta/client";
import { GraphClient, MetaApiError } from "@/lib/meta/graph";
import type { DailyColumn } from "@/lib/meta/metric-map";
import type { DailyValues, FetchedPost, MetaCallContext } from "@/lib/meta/types";
import type { DateRange } from "@/lib/metrics/types";
import {
  addDays,
  AUDIENCE_EVERY_DAYS,
  BACKFILL_MAX_DAYS,
  chooseSnapshotDay,
  dailyRange,
  hasAnyValue,
  localDate,
  mergeDailyRows,
  nextBackfillChunk,
  POSTS_WINDOW_DAYS,
  reconstructFollowers,
  type DailyUpsert,
} from "./rules";
import type { PostMetricsUpsert, SyncStore } from "./store";

/**
 * Moteur de collecte idempotent, par compte et par plage de dates.
 *  - quotidien : profil (photo, abonnés) → 3 derniers jours → publications des 30 derniers jours
 *    (+ snapshots J+1/J+7/J+28) → démographie (1×/semaine) ;
 *  - backfill progressif : 90 jours au premier passage, puis tranches de 90 jours en remontant
 *    jusqu'à 2 ans tant que Meta renvoie des données (curseur persistant account_sync_state) ;
 *  - budget de temps (deadline) et quotas Meta respectés : arrêt propre, reprise au prochain appel ;
 *  - chaque appel est tracé dans sync_runs.details.calls (jamais de jeton).
 */

export const DEFAULT_BUDGET_MS = 50_000;
/** marge de sécurité avant la deadline pour finir d'écrire */
const SAFETY_MS = 4_000;
export const REAUTH_STATUS = "expired" as const;
export const REAUTH_MESSAGE = "reauth_required";

export type SyncTrigger = "cron" | "manual" | "connect";

export interface SyncOptions {
  store: SyncStore;
  trigger: SyncTrigger;
  /** horodatage (ms) à ne pas dépasser */
  deadline: number;
  /** aujourd'hui, fuseau agence */
  today?: ISODate;
  now?: () => Date;
  graphFactory?: (token: string, deadline: number) => GraphClient;
  /** collecte quotidienne (défaut true) */
  daily?: boolean;
  /** backfill si le temps le permet (défaut true) */
  backfill?: boolean;
  /** synchro manuelle : refait le quotidien même s'il a déjà été fait aujourd'hui */
  force?: boolean;
  apiVersion?: string;
}

export interface AccountSyncResult {
  accountId: string;
  status: SyncStatus;
  reauthRequired: boolean;
  budgetExhausted: boolean;
  dailyDone: boolean;
  backfillDone: boolean;
  backfillCursor: ISODate | null;
  requests: number;
  error: string | null;
}

class BudgetExhausted extends Error {}

const msg = (e: unknown) => (e instanceof Error ? e.message : String(e));

/** Agrégats par jour local des publications : nombre ; FB : j'aime / commentaires / partages. */
export function aggregatePosts(posts: FetchedPost[], range: DateRange, network: "fb" | "ig"): Map<ISODate, Partial<Record<DailyColumn, number>>> {
  const out = new Map<ISODate, Partial<Record<DailyColumn, number>>>();
  for (let d = range.from; d <= range.to; d = addDays(d, 1)) {
    out.set(d, network === "fb" ? { posts_count: 0, likes: 0, comments: 0, shares: 0 } : { posts_count: 0 });
  }
  for (const p of posts) {
    const row = out.get(localDate(p.publishedAt));
    if (!row) continue;
    row.posts_count = (row.posts_count ?? 0) + 1;
    if (network === "fb") {
      row.likes = (row.likes ?? 0) + (p.metrics.likes ?? 0);
      row.comments = (row.comments ?? 0) + (p.metrics.comments ?? 0);
      row.shares = (row.shares ?? 0) + (p.metrics.shares ?? 0);
    }
  }
  return out;
}

export async function syncAccount(account: SocialAccountRow, state: AccountSyncStateRow | null, opts: SyncOptions): Promise<AccountSyncResult> {
  const { store } = opts;
  const now = opts.now ?? (() => new Date());
  const today = opts.today ?? localDate(now());
  const network = account.network as "fb" | "ig";
  const calls: SyncCallLog[] = [];
  const steps: { step: string; ok: boolean; ms: number; range?: DateRange }[] = [];
  const wantDaily = opts.daily !== false && (opts.force === true || state?.last_daily_on !== today);
  const kind = opts.trigger === "connect" ? "connect" : wantDaily ? "daily" : "backfill";
  const runId = await store.startRun({ account_id: account.id, kind, trigger: opts.trigger, range_from: null, range_to: null });

  const result: AccountSyncResult = {
    accountId: account.id,
    status: "success",
    reauthRequired: false,
    budgetExhausted: false,
    dailyDone: !wantDaily,
    backfillDone: state?.backfill_done ?? false,
    backfillCursor: state?.backfill_cursor ?? null,
    requests: 0,
    error: null,
  };
  let rangeFrom: ISODate | null = null;
  let rangeTo: ISODate | null = null;
  const touch = (r: DateRange) => {
    rangeFrom = rangeFrom && rangeFrom < r.from ? rangeFrom : r.from;
    rangeTo = rangeTo && rangeTo > r.to ? rangeTo : r.to;
  };
  let failures = 0;
  let graph: GraphClient | null = null;

  const ensureTime = () => {
    if (Date.now() > opts.deadline - SAFETY_MS) throw new BudgetExhausted("budget de temps épuisé : reprise au prochain passage");
    if (graph?.isThrottled()) throw new BudgetExhausted(`quota Meta à ${graph.usage.maxPercent} % : reprise au prochain passage`);
  };
  const step = async <T>(name: string, fn: () => Promise<T>, range?: DateRange): Promise<T | null> => {
    ensureTime();
    const t0 = Date.now();
    try {
      const v = await fn();
      steps.push({ step: name, ok: true, ms: Date.now() - t0, ...(range ? { range } : {}) });
      return v;
    } catch (err) {
      steps.push({ step: name, ok: false, ms: Date.now() - t0, ...(range ? { range } : {}) });
      if (err instanceof MetaApiError && err.isAuthError) throw err;
      if (err instanceof BudgetExhausted) throw err;
      failures++;
      calls.push({ metric: name, ok: false, message: msg(err) });
      return null;
    }
  };

  try {
    const token = await store.getToken(account.id);
    if (!token) throw new Error("jeton absent ou illisible : reconnectez le compte");
    graph = opts.graphFactory ? opts.graphFactory(token, opts.deadline) : createGraphClient(token, { deadline: opts.deadline });
    const ctx: MetaCallContext = { externalId: account.external_id, accessToken: token, apiVersion: opts.apiVersion ?? graph.apiVersion, graph };

    // 1. Profil : photo de profil et abonnés TOUJOURS à jour (exigence produit)
    const profile = await step("profile", async () => {
      const r = await fetchProfile(ctx, network);
      calls.push(...r.calls);
      await store.updateAccount(account.id, {
        name: r.data.name ?? account.name,
        handle: r.data.handle ?? account.handle,
        avatar_url: r.data.avatarUrl ?? account.avatar_url,
        followers_count: r.data.followersCount ?? account.followers_count,
      });
      await store.refreshBrandAvatar(account, r.data);
      return r.data;
    });

    const collect = async (range: DateRange, postsRange: DateRange, mode: "daily" | "backfill"): Promise<DailyValues[]> => {
      touch(range);
      const fresh =
        (await step(
          `${mode}:${network}:insights`,
          async () => {
            const r = network === "fb" ? await fetchPageDaily(ctx, range) : await fetchIgDaily(ctx, range);
            calls.push(...r.calls);
            return r.data;
          },
          range,
        )) ?? [];
      const posts =
        (await step(
          `${mode}:${network}:posts`,
          async () => {
            const r = await fetchPosts(ctx, { network, since: postsRange.from, until: postsRange.to });
            calls.push(...r.calls);
            await savePosts(store, account, r.data, now());
            return r.data;
          },
          postsRange,
        )) ?? null;
      await step(`${mode}:${network}:store`, async () => {
        const span: DateRange = { from: range.from < postsRange.from ? range.from : postsRange.from, to: range.to > postsRange.to ? range.to : postsRange.to };
        const existing = await store.getDailyRows(account.id, span);
        const freshForMerge = fresh.map((d) => ({ ...d, values: { ...d.values } }));
        let anchor: { date: ISODate; followers: number; gained?: number | null; lost?: number | null } | null = null;
        if (network === "ig") {
          if (mode === "daily" && profile?.followersCount != null) {
            const y = addDays(today, -1);
            const row = freshForMerge.find((d) => d.date === y);
            if (row) row.values.followers = profile.followersCount;
            else freshForMerge.push({ date: y, values: { followers: profile.followersCount } });
          } else if (mode === "backfill") {
            const next = await store.getDailyRow(account.id, addDays(range.to, 1));
            if (next?.followers != null) anchor = { date: next.date, followers: next.followers, gained: next.followers_gained, lost: next.followers_lost };
          }
        }
        const merged = mergeDailyRows(account.id, existing, freshForMerge, posts ? aggregatePosts(posts, postsRange, network) : new Map());
        if (network === "ig") fillFollowers(merged, anchor, mode === "daily" ? addDays(today, -1) : null);
        await store.upsertDailyRows(merged.filter((r) => r.date <= addDays(today, -1)));
      });
      return fresh;
    };

    // 2. Quotidien
    if (wantDaily) {
      const firstPass = !state?.backfill_cursor;
      const range = dailyRange(today, firstPass);
      const postsRange: DateRange = { from: firstPass ? range.from : addDays(today, -POSTS_WINDOW_DAYS), to: today };
      await collect(range, postsRange, "daily");

      // 3. Démographie, 1×/semaine (Instagram)
      const lastAudience = state?.audience_synced_at ? Date.parse(state.audience_synced_at) : 0;
      if (network === "ig" && now().getTime() - lastAudience > AUDIENCE_EVERY_DAYS * 86_400_000 - 3_600_000) {
        await step("audience", async () => {
          const r = await fetchAudience(ctx);
          calls.push(...r.calls);
          await store.upsertAudience({ account_id: account.id, date: today, demographics: r.data.demographics, online_followers: r.data.onlineFollowers });
          await store.saveState(account.id, { audience_synced_at: now().toISOString() });
        });
      }
      const cursor = state?.backfill_cursor && state.backfill_cursor < range.from ? state.backfill_cursor : range.from;
      result.backfillCursor = cursor;
      result.dailyDone = true;
      await store.saveState(account.id, { last_daily_on: today, backfill_cursor: cursor });
    }

    // 4. Backfill progressif tant qu'il reste du temps
    if (opts.backfill !== false) {
      while (!result.backfillDone) {
        const chunk = nextBackfillChunk(today, result.backfillCursor);
        if (!chunk) {
          result.backfillDone = true;
          break;
        }
        ensureTime();
        const fresh = await collect(chunk, chunk, "backfill");
        const exhausted = !hasAnyValue(fresh) || chunk.from <= addDays(today, -BACKFILL_MAX_DAYS);
        result.backfillCursor = chunk.from;
        result.backfillDone = exhausted;
        await store.saveState(account.id, { backfill_cursor: chunk.from, backfill_done: exhausted });
      }
    }
  } catch (err) {
    if (err instanceof BudgetExhausted) {
      result.budgetExhausted = true;
      calls.push({ metric: "budget", ok: false, message: err.message });
    } else if (err instanceof MetaApiError && err.isAuthError) {
      result.reauthRequired = true;
      result.error = err.message;
    } else {
      result.error = msg(err);
    }
  }
  result.requests = graph?.requests ?? 0;

  // Statut du compte
  if (result.reauthRequired) {
    result.status = "error";
    await store.updateAccount(account.id, { status: REAUTH_STATUS, status_message: `${REAUTH_MESSAGE} : ${result.error ?? "jeton invalide"}` });
  } else if (result.error) {
    result.status = "error";
    await store.updateAccount(account.id, { status: "error", status_message: result.error });
  } else {
    result.status = failures || result.budgetExhausted ? "partial" : "success";
    const expiring = account.token_expires_at && Date.parse(account.token_expires_at) - now().getTime() < 7 * 86_400_000;
    await store.updateAccount(account.id, {
      status: expiring ? "expiring" : "active",
      status_message: null,
      last_synced_at: now().toISOString(),
      ...(result.backfillCursor ? { history_from: result.backfillCursor } : {}),
    });
  }

  await store.finishRun(runId, {
    status: result.status,
    range_from: rangeFrom,
    range_to: rangeTo,
    error: result.error,
    details: {
      calls,
      steps,
      requests: result.requests,
      usage: graph?.usage ?? null,
      budgetExhausted: result.budgetExhausted,
      backfill: { cursor: result.backfillCursor, done: result.backfillDone },
    },
  });
  return result;
}

/** Abonnés IG : ancre = total actuel (veille) ou ligne suivante (backfill), puis gains/pertes. */
function fillFollowers(rows: DailyUpsert[], anchor: { date: ISODate; followers: number; gained?: number | null; lost?: number | null } | null, anchorDate: ISODate | null) {
  let a = anchor;
  if (!a && anchorDate) {
    const r = rows.find((x) => x.date === anchorDate);
    if (r?.followers != null) a = { date: r.date, followers: r.followers };
  }
  const rebuilt = reconstructFollowers(
    rows.map((r) => ({ date: r.date, followers: r.followers, gained: r.followers_gained, lost: r.followers_lost })),
    a,
  );
  for (const r of rows) if (r.followers == null && rebuilt.has(r.date)) r.followers = rebuilt.get(r.date)!;
}

async function savePosts(store: SyncStore, account: SocialAccountRow, posts: FetchedPost[], now: Date) {
  if (!posts.length) return;
  const saved = await store.upsertPosts(
    posts.map((p) => ({
      account_id: account.id,
      network: account.network,
      external_id: p.externalId,
      published_at: p.publishedAt,
      format: p.format,
      caption: p.caption,
      permalink: p.permalink,
      thumbnail_url: p.thumbnailUrl,
      media_url: p.mediaUrl,
    })),
  );
  const byExt = new Map(posts.map((p) => [p.externalId, p]));
  const snaps = await store.getSnapshots(saved.map((s) => s.id));
  const rows: PostMetricsUpsert[] = [];
  for (const s of saved) {
    const p = byExt.get(s.external_id);
    if (!p) continue;
    const day = chooseSnapshotDay(s.published_at, now, snaps.filter((x) => x.post_id === s.id));
    if (!day) continue;
    const m = p.metrics;
    rows.push({
      post_id: s.id,
      snapshot_day: day,
      captured_at: now.toISOString(),
      reach: m.reach ?? null,
      views: m.views ?? null,
      interactions: m.interactions ?? null,
      likes: m.likes ?? null,
      comments: m.comments ?? null,
      shares: m.shares ?? null,
      saves: m.saves ?? null,
      video_views: m.video_views ?? null,
    });
  }
  if (rows.length) await store.upsertPostMetrics(rows);
}

export interface BatchSyncResult {
  processed: AccountSyncResult[];
  /** comptes restant à traiter (quotidien non fait ou backfill en cours) */
  remaining: number;
}

/**
 * Traite les comptes par lots dans le budget : d'abord la collecte quotidienne (les comptes
 * les moins récemment synchronisés en premier), puis le backfill. Reprend où il s'est arrêté
 * grâce à account_sync_state.
 */
export async function runSyncBatch(opts: SyncOptions & { accountIds?: string[] }): Promise<BatchSyncResult> {
  const now = opts.now ?? (() => new Date());
  const today = opts.today ?? localDate(now());
  const accounts = (await opts.store.listAccounts(opts.accountIds ? { ids: opts.accountIds } : undefined)).filter(
    (a) => a.network === "fb" || a.network === "ig",
  );
  const states = new Map((await opts.store.listStates(accounts.map((a) => a.id))).map((s) => [s.account_id, s]));
  const processed: AccountSyncResult[] = [];
  const order = [...accounts].sort((a, b) => (states.get(a.id)?.last_daily_on ?? "") < (states.get(b.id)?.last_daily_on ?? "") ? -1 : 1);

  const dueDaily = order.filter((a) => states.get(a.id)?.last_daily_on !== today && a.status !== REAUTH_STATUS);
  for (const a of dueDaily) {
    if (Date.now() > opts.deadline - SAFETY_MS * 2) break;
    const r = await syncAccount(a, states.get(a.id) ?? null, { ...opts, today, backfill: false });
    processed.push(r);
    states.set(a.id, { ...(states.get(a.id) ?? emptyState(a.id)), last_daily_on: r.dailyDone ? today : (states.get(a.id)?.last_daily_on ?? null), backfill_cursor: r.backfillCursor, backfill_done: r.backfillDone });
  }
  const dueBackfill = order.filter((a) => {
    const s = states.get(a.id);
    return s?.last_daily_on === today && !s.backfill_done && a.status !== REAUTH_STATUS && !processed.some((p) => p.accountId === a.id && p.reauthRequired);
  });
  for (const a of dueBackfill) {
    if (Date.now() > opts.deadline - SAFETY_MS * 2) break;
    const r = await syncAccount(a, states.get(a.id) ?? null, { ...opts, today, daily: false });
    processed.push(r);
    states.set(a.id, { ...(states.get(a.id) ?? emptyState(a.id)), backfill_cursor: r.backfillCursor, backfill_done: r.backfillDone });
  }
  const remaining = accounts.filter((a) => {
    const s = states.get(a.id);
    return a.status !== REAUTH_STATUS && (s?.last_daily_on !== today || !s?.backfill_done);
  }).length;
  return { processed, remaining };
}

function emptyState(accountId: string): AccountSyncStateRow {
  return { account_id: accountId, backfill_cursor: null, backfill_done: false, last_daily_on: null, audience_synced_at: null, meta: {}, updated_at: new Date().toISOString() };
}
