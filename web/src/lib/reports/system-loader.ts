import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseSource } from "@/lib/db/source/supabase";
import type { AccountSummary, AudienceData, BrandSummary, PostItem } from "@/lib/db/queries";
import { BRAND_SECTIONS, type Network } from "@/lib/db/types";
import { addDays, buildDailySeries, computeTotals, normalizeDailyRow, spanWithPrevious, todayISO } from "@/lib/metrics";
import type { ReportDataLoader } from "./build";

/**
 * Loader « système » pour les envois programmés (cron, sans utilisateur) : client service role,
 * mêmes calculs que @/lib/db/queries (via @/lib/metrics). À n'utiliser QUE pour une marque
 * dont l'envoi a été programmé par l'agence.
 * NB (lead) : si queries.ts acceptait une DataSource explicite, ce fichier pourrait disparaître.
 */
export function createSystemReportLoader(): ReportDataLoader {
  const admin = createSupabaseAdminClient();
  const ds = createSupabaseSource(admin as unknown as Parameters<typeof createSupabaseSource>[0]);
  const brandCache = new Map<string, BrandSummary | null>();
  let orgId: string | null = null;

  async function getBrand(brandId: string): Promise<BrandSummary | null> {
    if (brandCache.has(brandId)) return brandCache.get(brandId)!;
    const { data: b } = await admin.from("brands").select("*").eq("id", brandId).is("archived_at", null).maybeSingle();
    if (!b) {
      brandCache.set(brandId, null);
      return null;
    }
    orgId = b.organization_id;
    const accounts: AccountSummary[] = (await ds.listAccounts([brandId])).map((a) => ({
      id: a.id, brandId: a.brand_id, network: a.network, externalId: a.external_id, handle: a.handle, name: a.name,
      avatarUrl: a.avatar_url, followersCount: a.followers_count, status: a.status, statusMessage: a.status_message,
      lastSyncedAt: a.last_synced_at, tokenExpiresAt: a.token_expires_at,
    }));
    const order: Network[] = ["ig", "fb", "tt", "li", "yt"];
    accounts.sort((x, y) => order.indexOf(x.network) - order.indexOf(y.network));
    const brand: BrandSummary = {
      id: b.id, name: b.name, slug: b.slug, sector: b.sector, color: b.color,
      avatarUrl: b.avatar_url ?? accounts.find((a) => a.avatarUrl)?.avatarUrl ?? null,
      accounts, networks: [...new Set(accounts.map((a) => a.network))], sections: [...BRAND_SECTIONS],
    };
    brandCache.set(brandId, brand);
    return brand;
  }

  return {
    getBrand,
    async getBrandMetrics(brandId, f) {
      const brand = await getBrand(brandId);
      if (!brand) return null;
      const accounts = brand.accounts.filter((a) => f.networks.includes(a.network));
      const net = new Map(accounts.map((a) => [a.id, a.network]));
      const span = spanWithPrevious(f.range, f.previous);
      const rows = (await ds.listDailyMetrics([...net.keys()], { from: addDays(span.from, -1), to: span.to })).map((r) => normalizeDailyRow(r, net.get(r.account_id)!));
      const of = (ids: string[]) => rows.filter((r) => ids.includes(r.accountId));
      const networks = [...new Set(accounts.map((a) => a.network))];
      return {
        brand, range: f.range, previousRange: f.previous, accounts,
        totals: computeTotals(rows, f.range), previous: f.previous ? computeTotals(rows, f.previous) : null,
        series: buildDailySeries(rows, f.range), previousSeries: f.previous ? buildDailySeries(rows, f.previous) : null,
        byNetwork: networks.map((network) => {
          const accs = accounts.filter((a) => a.network === network);
          const r = of(accs.map((a) => a.id));
          return { network, accounts: accs, totals: computeTotals(r, f.range), previous: f.previous ? computeTotals(r, f.previous) : null };
        }),
        rows,
      };
    },
    async getPosts(brandId, q) {
      const brand = await getBrand(brandId);
      if (!brand) return [];
      const accs = brand.accounts.filter((a) => !q.networks || q.networks.includes(a.network));
      const byId = new Map(accs.map((a) => [a.id, a]));
      const raw = await ds.listPosts([...byId.keys()], q.range, { limit: q.limit ?? 500 });
      return raw.map((p): PostItem => {
        const acc = byId.get(p.account_id)!;
        const m = p.metrics;
        const interactions = m?.interactions ?? (m?.likes ?? 0) + (m?.comments ?? 0) + (m?.shares ?? 0) + (m?.saves ?? 0);
        const reach = m?.reach != null ? Number(m.reach) : null;
        return {
          id: p.id, accountId: p.account_id, brandId, network: p.network, externalId: p.external_id, publishedAt: p.published_at,
          format: p.format, caption: p.caption, permalink: p.permalink, thumbnailUrl: p.thumbnail_url, campaignId: p.campaign_id,
          account: { handle: acc.handle, name: acc.name, avatarUrl: acc.avatarUrl },
          metrics: {
            reach, views: m?.views != null ? Number(m.views) : null, interactions, likes: m?.likes ?? null, comments: m?.comments ?? null,
            shares: m?.shares ?? null, saves: m?.saves ?? null, videoViews: m?.video_views != null ? Number(m.video_views) : null,
            engagementRate: reach ? interactions / reach : acc.followersCount ? interactions / acc.followersCount : null,
            snapshotDay: m?.snapshot_day ?? null,
          },
        };
      });
    },
    async getAudience(brandId): Promise<AudienceData | null> {
      const brand = await getBrand(brandId);
      const ig = brand?.accounts.find((a) => a.network === "ig");
      if (!ig) return null;
      const [snap] = await ds.latestAudience([ig.id]);
      if (!snap) return null;
      const d = snap.demographics ?? {};
      const ag = d.age_gender ?? [];
      const total = ag.reduce((t, r) => t + r.value, 0) || 1;
      const sum = (age: string | null, g: "F" | "M" | "U") => ag.filter((r) => (age == null || r.age === age) && r.gender === g).reduce((t, r) => t + r.value, 0) / total;
      const shares = (rows: { key: string; value: number }[] | undefined) => {
        const tot = (rows ?? []).reduce((t, r) => t + r.value, 0) || 1;
        return [...(rows ?? [])].sort((a, b) => b.value - a.value).slice(0, 8).map((r) => ({ ...r, share: r.value / tot }));
      };
      return {
        account: ig, date: snap.date,
        ageGender: [...new Set(ag.map((r) => r.age))].sort().map((age) => ({ age, female: sum(age, "F"), male: sum(age, "M"), unknown: sum(age, "U") })),
        genderShares: { female: sum(null, "F"), male: sum(null, "M"), unknown: sum(null, "U") },
        cities: shares(d.cities), countries: shares(d.countries), onlineHeatmap: null, raw: d,
      };
    },
    async getCampaigns(brandId) {
      const today = todayISO();
      return (await ds.listCampaigns([brandId])).map((c) => ({
        id: c.id, brandId: c.brand_id, name: c.name, description: c.description, range: { from: c.starts_on, to: c.ends_on },
        hashtags: c.hashtags, color: c.color, status: today < c.starts_on ? ("upcoming" as const) : today > c.ends_on ? ("finished" as const) : ("running" as const),
      }));
    },
    async getOrganization() {
      if (!orgId) return null;
      const { data } = await admin.from("organizations").select("name,logo_url").eq("id", orgId).maybeSingle();
      return data ? { name: data.name, logoUrl: data.logo_url } : null;
    },
  };
}
