import { describe, expect, it } from "vitest";
import fbFollows from "./__fixtures__/fb-page-follows.json";
import fbReach from "./__fixtures__/fb-page-reach.json";
import err100 from "./__fixtures__/error-100.json";
import err190 from "./__fixtures__/error-190.json";
import err4 from "./__fixtures__/error-4.json";
import igTotals from "./__fixtures__/ig-totals-day.json";
import igFollows from "./__fixtures__/ig-follows-day.json";
import igReach from "./__fixtures__/ig-reach.json";
import fbPosts from "./__fixtures__/fb-published-posts.json";
import igMedia from "./__fixtures__/ig-media.json";
import igMediaInsights from "./__fixtures__/ig-media-insights.json";
import demoAge from "./__fixtures__/ig-demographics-age-gender.json";
import demoCity from "./__fixtures__/ig-demographics-city.json";
import online from "./__fixtures__/ig-online-followers.json";
import meAccounts from "./__fixtures__/me-accounts.json";
import { fail, fakeFetch, ok } from "./__fixtures__/fake-graph";
import { GraphClient, MetaApiError, maskTokens, parseUsageHeaders } from "./graph";
import {
  breakdownRows,
  chunkRange,
  endTimeToDate,
  parseDailySeries,
  parseDemographics,
  parseFbPost,
  parseFollowsBreakdown,
  parseIgMedia,
  parseMediaInsights,
  parseOnlineFollowers,
  parseTotalValues,
  toUnix,
} from "./parse";
import { discoveredFromPages, fetchAudience, fetchIgDaily, fetchPageDaily, fetchPosts } from "./client";

const noSleep = async () => {};
const graph = (impl: typeof fetch) => new GraphClient({ accessToken: "EAATESTTOKEN1234567890abcdefghij", apiVersion: "v25.0", fetchImpl: impl, sleep: noSleep });
const ctx = (impl: typeof fetch, id = "1111") => ({ externalId: id, accessToken: "x", apiVersion: "v25.0", graph: graph(impl) });

describe("dates Meta", () => {
  it("end_time (fin de jour Pacifique) → jour = date(end_time − 1 j)", () => {
    expect(endTimeToDate("2026-11-12T08:00:00+0000")).toBe("2026-11-11");
    expect(endTimeToDate("2026-07-02T07:00:00+0000")).toBe("2026-07-01");
    expect(endTimeToDate("2026-01-01T08:00:00+0000")).toBe("2025-12-31");
  });
  it("découpe les périodes en fenêtres", () => {
    const w = chunkRange({ from: "2026-01-01", to: "2026-04-30" }, 89);
    expect(w).toEqual([
      { from: "2026-01-01", to: "2026-03-30" },
      { from: "2026-03-31", to: "2026-04-30" },
    ]);
    expect(toUnix("2026-01-01")).toBe(1767225600);
  });
});

describe("parsing", () => {
  it("série quotidienne Page, filtrée sur la période", () => {
    const m = parseDailySeries(fbFollows, { from: "2026-11-09", to: "2026-11-11" });
    expect([...m.entries()]).toEqual([
      ["2026-11-09", 1523],
      ["2026-11-10", 1527],
      ["2026-11-11", 1530],
    ]);
  });
  it("totaux IG, follows/unfollows", () => {
    expect(parseTotalValues(igTotals)).toMatchObject({ views: 4210, total_interactions: 187, profile_links_taps: 7 });
    expect(parseFollowsBreakdown(igFollows)).toEqual({ gained: 14, lost: 3 });
    expect(parseFollowsBreakdown({ data: [] })).toEqual({ gained: null, lost: null });
  });
  it("publication Facebook", () => {
    const [p1, p2, p3] = fbPosts.data.map(parseFbPost);
    expect(p1).toMatchObject({ format: "image", metrics: { likes: 57, comments: 6, shares: 4, reach: 1340, views: 1702, interactions: 67 } });
    expect(p1.publishedAt).toBe("2026-11-10T16:30:00.000Z");
    expect(p2).toMatchObject({ format: "video", caption: null, metrics: { likes: 20, shares: 0 } });
    expect(p2.metrics.reach).toBeUndefined();
    expect(p3.format).toBe("link");
  });
  it("média Instagram + insights", () => {
    const ins = parseMediaInsights(igMediaInsights);
    const p = parseIgMedia(igMedia.data[0], ins);
    expect(p).toMatchObject({ format: "reel", thumbnailUrl: "https://scontent.cdninstagram.com/v/reel1.jpg", metrics: { reach: 3120, views: 5480, saves: 33, shares: 21, interactions: 282, video_views: 5480 } });
    const c = parseIgMedia(igMedia.data[1], {});
    expect(c).toMatchObject({ format: "carousel", thumbnailUrl: "https://scontent.cdninstagram.com/v/car1.jpg", metrics: { likes: 98, comments: 5, interactions: 103 } });
  });
  it("démographie et abonnés en ligne", () => {
    const d = parseDemographics({ ageGender: breakdownRows(demoAge), city: breakdownRows(demoCity), country: null });
    expect(d.age_gender).toHaveLength(5);
    expect(d.age_gender?.[4]).toEqual({ age: "25-34", gender: "U", value: 12 });
    expect(d.cities?.[0]).toEqual({ key: "Fort-de-France, Martinique", value: 410 });
    expect(d.countries).toBeUndefined();
    expect(parseOnlineFollowers(online)).toEqual({ "2026-11-10": { "0": 40, "1": 22, "12": 180, "19": 260 } });
  });
  it("découverte : Page + IG lié, Page sans jeton ignorée", () => {
    const list = discoveredFromPages(meAccounts.data);
    expect(list.map((a) => [a.network, a.externalId, a.parentPageId])).toEqual([
      ["fb", "1111", null],
      ["ig", "2222", "1111"],
      ["fb", "3333", null],
    ]);
    expect(list[1]).toMatchObject({ handle: "@cafelumiere", avatarUrl: "https://scontent.cdninstagram.com/v/ig1.jpg", followersCount: 4820 });
    expect(list[2]).toMatchObject({ followersCount: 880, avatarUrl: "https://scontent.xx.fbcdn.net/v/page2.jpg" });
  });
});

describe("client Graph", () => {
  it("masque les jetons", () => {
    expect(maskTokens("https://x/?access_token=EAAabc&foo=1")).toBe("https://x/?access_token=…&foo=1");
    expect(maskTokens("jeton EAAB1234567890123456789012345 invalide")).toBe("jeton EAA… invalide");
  });
  it("lit les en-têtes de quota", () => {
    const u = parseUsageHeaders({
      "x-app-usage": JSON.stringify({ call_count: 12, total_time: 40, total_cputime: 5 }),
      "x-business-use-case-usage": JSON.stringify({ "1111": [{ type: "pages", call_count: 91, total_cputime: 3, total_time: 2, estimated_time_to_regain_access: 0 }] }),
    });
    expect(u).toEqual({ maxPercent: 91, regainMinutes: 0 });
  });
  it("réessaie sur le code 4 puis réussit", async () => {
    let n = 0;
    const f = fakeFetch(() => (++n < 3 ? fail(err4, 400) : ok({ id: "1" })));
    const g = graph(f.impl);
    await expect(g.get("1111")).resolves.toEqual({ id: "1" });
    expect(n).toBe(3);
  });
  it("190 → MetaApiError d'authentification, sans jeton dans le message", async () => {
    const f = fakeFetch(() => fail(err190, 400));
    const e = await graph(f.impl).get("1111").catch((x) => x);
    expect(e).toBeInstanceOf(MetaApiError);
    expect(e.isAuthError).toBe(true);
    expect(e.message).not.toContain("EAATEST");
  });
  it("batch : découpe par 50, un résultat par requête, erreurs isolées", async () => {
    const f = fakeFetch((u) => (u.includes("bad") ? fail(err100) : ok({ u })));
    const reqs = Array.from({ length: 120 }, (_, i) => ({ relativeUrl: i === 7 ? "bad" : `ok${i}` }));
    const res = await graph(f.impl).batch(reqs);
    expect(f.calls.filter((c) => c.batch).map((c) => c.batch!.length)).toEqual([50, 50, 20]);
    expect(res).toHaveLength(120);
    expect(res[7].ok).toBe(false);
    expect(res[8]).toEqual({ ok: true, body: { u: "ok8" } });
    // le jeton n'est jamais dans les URL relatives
    expect(f.calls.flatMap((c) => c.batch ?? []).some((u) => u.includes("access_token"))).toBe(false);
  });
  it("batch : 190 dans un lot interrompt la collecte", async () => {
    const f = fakeFetch(() => fail(err190));
    await expect(graph(f.impl).batch([{ relativeUrl: "a" }])).rejects.toMatchObject({ code: 190 });
  });
});

describe("fetchPageDaily / fetchIgDaily", () => {
  it("Page : fusionne les métriques, tolère une métrique en erreur (100)", async () => {
    const f = fakeFetch((u) => {
      if (u.includes("metric=page_follows&")) return ok(fbFollows);
      if (u.includes("metric=page_total_media_view_unique")) return ok(fbReach);
      if (u.includes("metric=page_views_total")) return fail(err100);
      return ok({ data: [] });
    });
    const r = await fetchPageDaily(ctx(f.impl), { from: "2026-11-08", to: "2026-11-11" });
    expect(r.data.find((d) => d.date === "2026-11-10")?.values).toEqual({ followers: 1527, reach: 933 });
    expect(r.data.map((d) => d.date)).toEqual(["2026-11-08", "2026-11-09", "2026-11-10", "2026-11-11"]);
    const bad = r.calls.find((c) => c.metric === "fb:page_views_total");
    expect(bad).toMatchObject({ ok: false });
    expect(bad?.message).toContain("#100");
    expect(r.calls.find((c) => c.metric === "fb:page_follows")).toMatchObject({ ok: true, values: 4 });
  });

  it("Instagram : sonde, reach en série, totaux et abonnements par jour (batch)", async () => {
    const f = fakeFetch((u) => {
      if (u.includes("metric=profile_links_taps&")) return fail(err100); // indisponible à la sonde
      if (u.includes("metric=reach&")) return ok(igReach);
      if (u.includes("follows_and_unfollows")) return ok(igFollows);
      if (u.includes("metric_type=total_value")) return ok(igTotals);
      return ok({ data: [] });
    });
    const r = await fetchIgDaily(ctx(f.impl, "2222"), { from: "2026-11-10", to: "2026-11-11" });
    const d = r.data.find((x) => x.date === "2026-11-11")!.values;
    expect(d).toMatchObject({ reach: 2650, views: 4210, interactions: 187, saves: 16, profile_visits: 64, followers_gained: 14, followers_lost: 3 });
    // profile_links_taps exclu après la sonde : n'est plus demandé
    const totalsUrls = f.calls.flatMap((c) => c.batch ?? []).map(decodeURIComponent).filter((u) => u.includes("metric=views,"));
    expect(totalsUrls.length).toBe(2);
    expect(totalsUrls.every((u) => !u.includes("profile_links_taps"))).toBe(true);
    expect(r.calls.some((c) => c.metric === "ig:profile_links_taps" && !c.ok)).toBe(true);
  });
});

describe("fetchPosts / fetchAudience", () => {
  it("Facebook : repli sans insights si la première page échoue", async () => {
    const f = fakeFetch((u) => (u.includes("insights.metric") ? fail(err100) : ok(fbPosts)));
    const r = await fetchPosts(ctx(f.impl), { network: "fb", since: "2026-11-01", until: "2026-11-12" });
    expect(r.data).toHaveLength(3);
    expect(r.calls.find((c) => c.metric === "fb:post_insights")?.ok).toBe(false);
  });
  it("Instagram : s'arrête avant `since`, sonde puis batch des insights", async () => {
    const f = fakeFetch((u) => {
      if (u.startsWith("2222/media")) return ok(igMedia);
      if (u.startsWith("17900000002/insights?metric=views")) return fail(err100); // carrousel sans « views »
      if (u.includes("/insights")) return ok(igMediaInsights);
      return ok({});
    });
    const r = await fetchPosts(ctx(f.impl, "2222"), { network: "ig", since: "2026-11-01" });
    expect(r.data.map((p) => p.externalId)).toEqual(["17900000001", "17900000002"]);
    expect(r.data[0].metrics.reach).toBe(3120);
    const mediaBatch = f.calls.flatMap((c) => c.batch ?? []).map(decodeURIComponent).filter((u) => u.includes(","));
    expect(mediaBatch.find((u) => u.startsWith("17900000002"))).not.toContain("views");
  });
  it("audience : réessaie avec timeframe, tolère online_followers en erreur", async () => {
    const f = fakeFetch((u) => {
      if (u.includes("online_followers")) return fail(err100);
      if (u.includes("breakdown=age%2Cgender") || u.includes("breakdown=age,gender")) return ok(demoAge);
      if (u.includes("breakdown=city")) return u.includes("timeframe=this_month") ? ok(demoCity) : fail(err100);
      return fail(err100);
    });
    const r = await fetchAudience(ctx(f.impl, "2222"));
    expect(r.data.demographics.age_gender).toHaveLength(5);
    expect(r.data.demographics.cities).toHaveLength(2);
    expect(r.data.demographics.countries).toBeUndefined();
    expect(r.data.onlineFollowers).toBeNull();
    expect(r.calls.filter((c) => !c.ok).map((c) => c.metric)).toEqual(["ig:follower_demographics:country", "ig:online_followers"]);
  });
});
