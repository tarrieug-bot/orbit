import { describe, expect, it } from "vitest";
import type { AccountDailyMetricsRow, AccountSyncStateRow, AudienceSnapshotRow, SocialAccountRow, SyncRunRow } from "@/lib/db/types";
import { GraphClient } from "@/lib/meta/graph";
import { fail, fakeFetch, ok, type FakeHandler } from "@/lib/meta/__fixtures__/fake-graph";
import err190 from "@/lib/meta/__fixtures__/error-190.json";
import igMedia from "@/lib/meta/__fixtures__/ig-media.json";
import { chooseSnapshotDay, dailyRange, mergeDailyRows, nextBackfillChunk, reconstructFollowers } from "./rules";
import { runSyncBatch, syncAccount } from "./engine";
import type { PostMetricsUpsert, PostUpsert, SyncStore } from "./store";

describe("règles de collecte", () => {
  it("plages : 3 derniers jours, 90 au premier passage, tranches de backfill jusqu'à 2 ans", () => {
    expect(dailyRange("2026-11-13", false)).toEqual({ from: "2026-11-10", to: "2026-11-12" });
    expect(dailyRange("2026-11-13", true)).toEqual({ from: "2026-08-15", to: "2026-11-12" });
    expect(nextBackfillChunk("2026-11-13", "2026-08-15")).toEqual({ from: "2026-05-17", to: "2026-08-14" });
    expect(nextBackfillChunk("2026-11-13", "2024-11-20")).toEqual({ from: "2024-11-13", to: "2024-11-19" });
    expect(nextBackfillChunk("2026-11-13", "2024-11-13")).toBeNull();
  });

  it("snapshots J+1 / J+7 / J+28", () => {
    const pub = "2026-11-01T12:00:00Z";
    const at = (d: number) => new Date(Date.parse(pub) + d * 86_400_000);
    expect(chooseSnapshotDay(pub, at(0.5), [])).toBe(1); // provisoire
    expect(chooseSnapshotDay(pub, at(1.2), [{ snapshot_day: 1, captured_at: at(0.5).toISOString() }])).toBe(1); // devient définitif
    expect(chooseSnapshotDay(pub, at(2), [{ snapshot_day: 1, captured_at: at(1.2).toISOString() }])).toBe(7);
    expect(chooseSnapshotDay(pub, at(10), [])).toBe(7); // J+1 manqué
    expect(chooseSnapshotDay(pub, at(200), [])).toBe(28);
    expect(
      chooseSnapshotDay(pub, at(30), [
        { snapshot_day: 1, captured_at: at(1).toISOString() },
        { snapshot_day: 7, captured_at: at(7).toISOString() },
        { snapshot_day: 28, captured_at: at(28.5).toISOString() },
      ]),
    ).toBeNull();
  });

  it("reconstruit les abonnés IG à partir du total et des gains / pertes", () => {
    const rows = [
      { date: "2026-11-10", gained: 5, lost: 1 },
      { date: "2026-11-11", gained: 10, lost: 2 },
      { date: "2026-11-12", gained: 4, lost: 0 },
    ];
    const m = reconstructFollowers(rows, { date: "2026-11-12", followers: 1000 });
    expect(Object.fromEntries(m)).toEqual({ "2026-11-12": 1000, "2026-11-11": 996, "2026-11-10": 988 });
    // ancre hors des lignes (backfill : jour suivant déjà en base)
    const b = reconstructFollowers([{ date: "2026-08-14", gained: 1, lost: 0 }], { date: "2026-08-15", followers: 500, gained: 3, lost: 1 });
    expect(b.get("2026-08-14")).toBe(498);
  });

  it("fusion idempotente : une métrique absente ne remet pas l'existant à NULL", () => {
    const existing = [{ account_id: "a", date: "2026-11-10", reach: 100, views: 200, followers: 10 } as unknown as AccountDailyMetricsRow];
    const merged = mergeDailyRows("a", existing, [{ date: "2026-11-10", values: { reach: 120 } }], new Map([["2026-11-10", { posts_count: 2 }]]));
    expect(merged[0]).toMatchObject({ reach: 120, views: 200, followers: 10, posts_count: 2, likes: null });
    const again = mergeDailyRows("a", existing, [{ date: "2026-11-10", values: { reach: 120 } }], new Map([["2026-11-10", { posts_count: 2 }]]));
    expect(again).toEqual(merged);
  });
});

// -----------------------------------------------------------------------------
// Moteur avec une base en mémoire et un faux Graph
// -----------------------------------------------------------------------------
function memoryStore(accounts: SocialAccountRow[]) {
  const daily = new Map<string, AccountDailyMetricsRow>();
  const states = new Map<string, AccountSyncStateRow>();
  const posts = new Map<string, PostUpsert & { id: string }>();
  const metrics = new Map<string, PostMetricsUpsert>();
  const audience: Omit<AudienceSnapshotRow, "created_at">[] = [];
  const runs: Partial<SyncRunRow>[] = [];
  const brandAvatar: Record<string, string> = {};
  const store: SyncStore = {
    async listAccounts() {
      return accounts;
    },
    async listStates(ids) {
      return ids.map((id) => states.get(id)).filter((x): x is AccountSyncStateRow => !!x);
    },
    async saveState(id, patch) {
      const prev = states.get(id) ?? { account_id: id, backfill_cursor: null, backfill_done: false, last_daily_on: null, audience_synced_at: null, meta: {}, updated_at: "" };
      states.set(id, { ...prev, ...patch });
    },
    async getToken() {
      return "EAAFAKETOKEN";
    },
    async updateAccount(id, patch) {
      Object.assign(accounts.find((a) => a.id === id)!, patch);
    },
    async refreshBrandAvatar(account, profile) {
      if (profile.avatarUrl) brandAvatar[account.brand_id] = profile.avatarUrl;
    },
    async getDailyRows(id, r) {
      return [...daily.values()].filter((x) => x.account_id === id && x.date >= r.from && x.date <= r.to);
    },
    async getDailyRow(id, date) {
      return daily.get(`${id}|${date}`) ?? null;
    },
    async upsertDailyRows(rows) {
      for (const r of rows) daily.set(`${r.account_id}|${r.date}`, { ...r, raw: null, updated_at: "" });
    },
    async upsertPosts(rows) {
      return rows.map((r) => {
        const key = `${r.account_id}|${r.external_id}`;
        const id = posts.get(key)?.id ?? `p${posts.size + 1}`;
        posts.set(key, { ...r, id });
        return { id, external_id: r.external_id, published_at: r.published_at };
      });
    },
    async getSnapshots(ids) {
      return [...metrics.values()].filter((m) => ids.includes(m.post_id)).map((m) => ({ post_id: m.post_id, snapshot_day: m.snapshot_day, captured_at: m.captured_at }));
    },
    async upsertPostMetrics(rows) {
      for (const r of rows) metrics.set(`${r.post_id}|${r.snapshot_day}`, r);
    },
    async upsertAudience(row) {
      audience.push(row);
    },
    async startRun(row) {
      runs.push({ ...row, status: "running" });
      return runs.length - 1;
    },
    async finishRun(id, patch) {
      if (id != null) Object.assign(runs[id], patch);
    },
  };
  return { store, daily, states, posts, metrics, audience, runs, brandAvatar };
}

function account(id: string, network: "fb" | "ig", ext: string): SocialAccountRow {
  return {
    id, brand_id: "b1", network, external_id: ext, parent_page_id: null, handle: null, name: null, avatar_url: null,
    followers_count: null, token_expires_at: null, status: "active", status_message: null, last_synced_at: null,
    history_from: null, connected_by: null, created_at: "", updated_at: "",
  };
}

/** Faux Graph IG : 1 000 abonnés, 10 gagnés / 2 perdus par jour, reach 500/jour ; historique jusqu'au 2026-06-01. */
const igHandler: FakeHandler = (u) => {
  const url = decodeURIComponent(u);
  const since = Number(/since=(\d+)/.exec(url)?.[1] ?? 0);
  const old = since && since < Date.parse("2026-06-01T00:00:00Z") / 1000;
  if (url.startsWith("2222?fields")) return ok({ id: "2222", username: "cafelumiere", followers_count: 1000, profile_picture_url: "https://cdn/ig.jpg" });
  if (url.startsWith("2222/media")) return ok(igMedia);
  if (/^\d{11}\/insights/.test(url)) return ok({ data: [{ name: "reach", values: [{ value: 300 }] }] });
  if (url.includes("follower_demographics")) return ok({ data: [{ total_value: { breakdowns: [{ results: [{ dimension_values: ["25-34", "F"], value: 9 }] }] } }] });
  if (url.includes("online_followers")) return ok({ data: [] });
  if (old) return ok({ data: [] });
  if (url.includes("metric=reach&")) {
    const until = Number(/until=(\d+)/.exec(url)![1]);
    const values = [];
    for (let t = since + 86400; t <= until; t += 86400) values.push({ value: 500, end_time: new Date((t + 8 * 3600) * 1000).toISOString().replace(".000Z", "+0000") });
    return ok({ data: [{ name: "reach", values }] });
  }
  if (url.includes("follows_and_unfollows")) return ok({ data: [{ total_value: { breakdowns: [{ results: [{ dimension_values: ["FOLLOWER"], value: 10 }, { dimension_values: ["NON_FOLLOWER"], value: 2 }] }] } }] });
  if (url.includes("metric_type=total_value")) return ok({ data: [{ name: "views", total_value: { value: 900 } }, { name: "likes", total_value: { value: 40 } }] });
  return ok({ data: [] });
};

describe("moteur de collecte", () => {
  const today = "2026-11-13";
  const now = () => new Date("2026-11-13T12:00:00Z");

  it("premier passage IG : profil, 90 jours, abonnés reconstruits, publications, audience, backfill jusqu'à épuisement", async () => {
    const acc = account("a-ig", "ig", "2222");
    const db = memoryStore([acc]);
    const f = fakeFetch(igHandler);
    const r = await syncAccount(acc, null, {
      store: db.store, trigger: "connect", deadline: Date.now() + 60_000, today, now,
      graphFactory: (t) => new GraphClient({ accessToken: t, fetchImpl: f.impl, sleep: async () => {} }),
    });
    expect(r).toMatchObject({ status: "success", dailyDone: true, backfillDone: true, reauthRequired: false });
    expect(acc.avatar_url).toBe("https://cdn/ig.jpg");
    expect(db.brandAvatar.b1).toBe("https://cdn/ig.jpg");
    const y = db.daily.get("a-ig|2026-11-12")!;
    expect(y).toMatchObject({ followers: 1000, reach: 500, views: 900, followers_gained: 10, followers_lost: 2 });
    expect(db.daily.get("a-ig|2026-11-11")!.followers).toBe(992);
    expect(db.daily.get("a-ig|2026-11-10")!.followers).toBe(984);
    // posts_count par jour local
    expect(db.daily.get("a-ig|2026-11-11")!.posts_count).toBe(1);
    expect(db.posts.size).toBe(3);
    expect(db.audience).toHaveLength(1);
    // backfill : la tranche mai-août a des données (jusqu'au 1er juin), la suivante est vide → terminé
    expect(db.states.get("a-ig")).toMatchObject({ last_daily_on: today, backfill_done: true });
    expect(db.daily.has("a-ig|2026-06-15")).toBe(true);
    expect(db.runs[0]).toMatchObject({ kind: "connect", status: "success" });
    const details = db.runs[0].details as { calls: { message?: string }[] };
    expect(JSON.stringify(details)).not.toContain("EAAFAKETOKEN");
  });

  it("idempotent : un 2e passage le même jour ne refait pas le quotidien", async () => {
    const acc = account("a-ig", "ig", "2222");
    const db = memoryStore([acc]);
    const f = fakeFetch(igHandler);
    const opts = { store: db.store, trigger: "cron" as const, deadline: Date.now() + 60_000, today, now, graphFactory: (t: string) => new GraphClient({ accessToken: t, fetchImpl: f.impl, sleep: async () => {} }) };
    await runSyncBatch(opts);
    const size = db.daily.size;
    const calls = f.calls.length;
    const second = await runSyncBatch(opts);
    expect(second.processed).toHaveLength(0);
    expect(second.remaining).toBe(0);
    expect(db.daily.size).toBe(size);
    expect(f.calls.length).toBe(calls);
  });

  it("jeton invalide (190) → reconnexion requise, sans casser le lot", async () => {
    const bad = account("a-fb", "fb", "1111");
    const good = account("a-ig", "ig", "2222");
    const db = memoryStore([bad, good]);
    const f = fakeFetch((u) => (u.startsWith("1111") ? fail(err190) : igHandler(u)));
    const res = await runSyncBatch({ store: db.store, trigger: "cron", deadline: Date.now() + 60_000, today, now, graphFactory: (t) => new GraphClient({ accessToken: t, fetchImpl: f.impl, sleep: async () => {} }) });
    const rb = res.processed.find((p) => p.accountId === "a-fb")!;
    expect(rb.reauthRequired).toBe(true);
    expect(bad.status).toBe("expired");
    expect(bad.status_message).toContain("reauth_required");
    expect(good.status).toBe("active");
  });

  it("budget épuisé → arrêt propre, statut partiel, reprise possible", async () => {
    const acc = account("a-ig", "ig", "2222");
    const db = memoryStore([acc]);
    const f = fakeFetch(igHandler);
    const r = await syncAccount(acc, null, { store: db.store, trigger: "cron", deadline: Date.now() + 1000, today, now, graphFactory: (t) => new GraphClient({ accessToken: t, fetchImpl: f.impl }) });
    expect(r.budgetExhausted).toBe(true);
    expect(r.status).toBe("partial");
    expect(db.states.get("a-ig")?.last_daily_on).toBeUndefined();
  });
});
