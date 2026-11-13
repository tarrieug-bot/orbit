import type { AccountDailyMetricsRow } from "@/lib/db/types";
import type { AccountSummary, BrandSummary, PostItem } from "@/lib/db/queries";
import { buildDailySeries, computeTotals, normalizeDailyRow, addDays, eachDay } from "@/lib/metrics";
import type { ReportDataLoader } from "../build";

/** Loader de test : une marque, 2 comptes, 120 jours de données déterministes, 12 publications. */
export function testLoader(opts: { sections?: BrandSummary["sections"] } = {}): ReportDataLoader {
  const acc = (id: string, network: "ig" | "fb"): AccountSummary => ({
    id, brandId: "b1", network, externalId: id, handle: network === "ig" ? "@cafelumiere" : "Café Lumière", name: "Café Lumière",
    avatarUrl: null, followersCount: network === "ig" ? 4800 : 1500, status: "active", statusMessage: null, lastSyncedAt: null, tokenExpiresAt: null,
  });
  const accounts = [acc("a-ig", "ig"), acc("a-fb", "fb")];
  const brand: BrandSummary = {
    id: "b1", name: "Café Lumière", slug: "cafe-lumiere", sector: "Café", color: "#C2410C", avatarUrl: null,
    accounts, networks: ["ig", "fb"], sections: opts.sections ?? ["analytics", "posts", "audience", "campaigns", "reports"],
  };
  const raw: AccountDailyMetricsRow[] = [];
  eachDay({ from: "2026-07-01", to: "2026-11-12" }).forEach((date, i) => {
    for (const a of accounts) {
      const ig = a.network === "ig";
      raw.push({
        account_id: a.id, date, followers: (ig ? 4000 : 1300) + i * (ig ? 6 : 2), followers_gained: ig ? 8 : 3, followers_lost: ig ? 2 : 1,
        reach: (ig ? 900 : 400) + (i % 7) * 30, views: (ig ? 2000 : 700) + (i % 5) * 50, interactions: null,
        likes: ig ? 60 + (i % 4) : 20, comments: ig ? 6 : 2, shares: 3, saves: ig ? 4 : null, profile_visits: ig ? 40 : 12, link_clicks: ig ? 5 : null,
        posts_count: i % 3 === 0 ? 1 : 0, video_views: null, raw: null, updated_at: "",
      });
    }
  });
  const rows = raw.map((r) => normalizeDailyRow(r, r.account_id === "a-ig" ? "ig" : "fb"));
  const formats = ["reel", "image", "carousel", "reel", "image", "video"] as const;
  const posts: PostItem[] = Array.from({ length: 12 }, (_, i) => {
    const network = i % 2 ? "fb" : "ig";
    const reach = 800 + i * 120;
    const interactions = 40 + ((i * 37) % 90);
    return {
      id: `p${i}`, accountId: network === "ig" ? "a-ig" : "a-fb", brandId: "b1", network, externalId: `x${i}`,
      publishedAt: `${addDays("2026-10-01", i * 2)}T${String(12 + (i % 8)).padStart(2, "0")}:00:00Z`,
      format: network === "fb" && formats[i % 6] === "reel" ? "video" : formats[i % 6], caption: i === 3 ? null : `Publication n°${i} #cafelumiere`,
      permalink: `https://example.test/p${i}`, thumbnailUrl: null, campaignId: null,
      account: { handle: null, name: null, avatarUrl: null },
      metrics: { reach, views: reach * 2, interactions, likes: interactions - 5, comments: 3, shares: 2, saves: null, videoViews: null, engagementRate: interactions / reach, snapshotDay: 7 },
    };
  });
  return {
    async getBrand(id) {
      return id === "b1" ? brand : null;
    },
    async getBrandMetrics(id, f) {
      if (id !== "b1") return null;
      const accs = accounts.filter((a) => f.networks.includes(a.network));
      const rs = rows.filter((r) => accs.some((a) => a.id === r.accountId));
      return {
        brand, range: f.range, previousRange: f.previous, accounts: accs,
        totals: computeTotals(rs, f.range), previous: f.previous ? computeTotals(rs, f.previous) : null,
        series: buildDailySeries(rs, f.range), previousSeries: f.previous ? buildDailySeries(rs, f.previous) : null,
        byNetwork: (["ig", "fb"] as const).filter((n) => f.networks.includes(n)).map((n) => {
          const r2 = rs.filter((r) => r.network === n);
          return { network: n, accounts: accs.filter((a) => a.network === n), totals: computeTotals(r2, f.range), previous: f.previous ? computeTotals(r2, f.previous) : null };
        }),
        rows: rs,
      };
    },
    async getPosts(_id, q) {
      return posts.filter((p) => p.publishedAt.slice(0, 10) >= q.range.from && p.publishedAt.slice(0, 10) <= q.range.to);
    },
    async getAudience() {
      return {
        account: accounts[0], date: "2026-11-10",
        ageGender: [{ age: "18-24", female: 0.2, male: 0.1, unknown: 0 }, { age: "25-34", female: 0.4, male: 0.3, unknown: 0 }],
        genderShares: { female: 0.6, male: 0.4, unknown: 0 },
        cities: [{ key: "Fort-de-France, Martinique", value: 400, share: 0.5 }], countries: [{ key: "MQ", value: 700, share: 0.8 }, { key: "FR", value: 100, share: 0.12 }],
        onlineHeatmap: null, raw: {},
      };
    },
    async getCampaigns() {
      return [{ id: "c1", brandId: "b1", name: "Rentrée gourmande", description: null, range: { from: "2026-09-01", to: "2026-09-30" }, hashtags: [], color: null, status: "finished" }];
    },
    async getOrganization() {
      return { name: "Agence Test", logoUrl: null };
    },
  };
}
