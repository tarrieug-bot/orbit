import "server-only";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addDays } from "@/lib/metrics/dates";
import type { DateRange } from "@/lib/metrics/types";
import type { AppLocale, AudienceSnapshotRow, BrandSection, ISODate } from "../types";
import type { BrandAccessWithProfile, DataSource, PostWithLatestMetrics, SessionUser } from "./types";

const PAGE = 1000; // limite max-rows par défaut de PostgREST
const TZ = "America/Martinique";

type Client = Awaited<ReturnType<typeof createSupabaseServerClient>>;

function fail(context: string, error: { message: string } | null): never {
  throw new Error(`[db] ${context} : ${error?.message ?? "erreur inconnue"}`);
}

/** Date locale (agence) d'un horodatage. */
function localDate(ts: string): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
}

/** Bornes UTC d'une période de jours locaux (Martinique = UTC−4). */
function tsBounds(range: DateRange) {
  return { gte: `${range.from}T04:00:00Z`, lt: `${addDays(range.to, 1)}T04:00:00Z` };
}

export function createSupabaseSource(client: Client): DataSource {
  return {
    kind: "supabase",

    async getSessionUser(): Promise<SessionUser | null> {
      const { data: auth } = await client.auth.getUser();
      if (!auth.user) return null;
      const { data: profile, error } = await client.from("profiles").select("*").eq("id", auth.user.id).maybeSingle();
      if (error) fail("profil", error);
      if (!profile) return null;
      const isAgency = profile.role !== "client" && profile.organization_id != null;
      let clientAccess: SessionUser["clientAccess"] = [];
      if (!isAgency) {
        const { data, error: e2 } = await client.from("brand_access").select("brand_id, visible_sections").eq("user_id", profile.id);
        if (e2) fail("accès client", e2);
        clientAccess = (data ?? []).map((r) => ({ brandId: r.brand_id, sections: r.visible_sections as BrandSection[] }));
      }
      return {
        id: profile.id,
        email: profile.email,
        fullName: profile.full_name,
        role: profile.role,
        locale: profile.locale as AppLocale,
        organizationId: profile.organization_id,
        isAgency,
        clientAccess,
      };
    },

    async getOrganization() {
      const { data, error } = await client.from("organizations").select("*").limit(1).maybeSingle();
      if (error) fail("organisation", error);
      return data;
    },

    async listBrands() {
      const { data, error } = await client.from("brands").select("*").is("archived_at", null).order("name");
      if (error) fail("marques", error);
      return data ?? [];
    },

    async listAccounts(brandIds) {
      let q = client.from("social_accounts").select("*").order("network");
      if (brandIds) q = q.in("brand_id", brandIds);
      const { data, error } = await q;
      if (error) fail("comptes", error);
      return data ?? [];
    },

    async listDailyMetrics(accountIds, range) {
      if (!accountIds.length) return [];
      const out = [];
      for (let offset = 0; ; offset += PAGE) {
        const { data, error } = await client
          .from("account_daily_metrics")
          .select("account_id,date,followers,followers_gained,followers_lost,reach,views,interactions,likes,comments,shares,saves,profile_visits,link_clicks,posts_count,video_views,updated_at")
          .in("account_id", accountIds)
          .gte("date", range.from)
          .lte("date", range.to)
          .order("date")
          .order("account_id")
          .range(offset, offset + PAGE - 1);
        if (error) fail("métriques quotidiennes", error);
        out.push(...(data ?? []).map((r) => ({ ...r, raw: null })));
        if (!data || data.length < PAGE) break;
      }
      return out;
    },

    async listPosts(accountIds, range, opts) {
      if (!accountIds.length) return [];
      const { gte, lt } = tsBounds(range);
      const limit = opts?.limit ?? 500;
      const { data, error } = await client
        .from("posts")
        .select("*")
        .in("account_id", accountIds)
        .gte("published_at", gte)
        .lt("published_at", lt)
        .order("published_at", { ascending: false })
        .limit(limit);
      if (error) fail("publications", error);
      const posts = data ?? [];
      if (!posts.length) return [];
      const metrics = new Map<string, PostWithLatestMetrics["metrics"]>();
      for (let i = 0; i < posts.length; i += 200) {
        const ids = posts.slice(i, i + 200).map((p) => p.id);
        const { data: m, error: e2 } = await client.from("post_latest_metrics").select("*").in("post_id", ids);
        if (e2) fail("statistiques des publications", e2);
        (m ?? []).forEach((row) => metrics.set(row.post_id, row));
      }
      return posts.map((p) => ({ ...p, metrics: metrics.get(p.id) ?? null }));
    },

    async lastPostDates(accountIds, before) {
      const out: Record<string, ISODate> = {};
      await Promise.all(
        accountIds.map(async (id) => {
          const { data } = await client
            .from("posts")
            .select("published_at")
            .eq("account_id", id)
            .lt("published_at", `${addDays(before, 1)}T04:00:00Z`)
            .order("published_at", { ascending: false })
            .limit(1)
            .maybeSingle();
          if (data) out[id] = localDate(data.published_at);
        }),
      );
      return out;
    },

    async listCampaigns(brandIds) {
      let q = client.from("campaigns").select("*").order("starts_on", { ascending: false });
      if (brandIds) q = q.in("brand_id", brandIds);
      const { data, error } = await q;
      if (error) fail("campagnes", error);
      return data ?? [];
    },

    async latestAudience(accountIds) {
      if (!accountIds.length) return [];
      const { data, error } = await client
        .from("audience_snapshots")
        .select("*")
        .in("account_id", accountIds)
        .order("date", { ascending: false })
        .limit(accountIds.length * 5);
      if (error) fail("audience", error);
      const seen = new Set<string>();
      const out: AudienceSnapshotRow[] = [];
      for (const r of data ?? []) {
        if (seen.has(r.account_id)) continue;
        seen.add(r.account_id);
        out.push(r);
      }
      return out;
    },

    async listBrandAccess(brandIds) {
      let q = client.from("brand_access").select("*");
      if (brandIds) q = q.in("brand_id", brandIds);
      const { data, error } = await q;
      if (error) fail("accès clients", error);
      const rows = data ?? [];
      const userIds = [...new Set(rows.map((r) => r.user_id))];
      const { data: profiles, error: e2 } = userIds.length
        ? await client.from("profiles").select("id,email,full_name,locale,last_seen_at").in("id", userIds)
        : { data: [], error: null };
      if (e2) fail("profils clients", e2);
      const byId = new Map((profiles ?? []).map((p) => [p.id, p]));
      return rows
        .filter((r) => byId.has(r.user_id))
        .map((r) => ({ ...r, profile: byId.get(r.user_id)! })) as BrandAccessWithProfile[];
    },

    async listSyncRuns({ accountIds, limit }) {
      let q = client.from("sync_runs").select("*").order("started_at", { ascending: false }).limit(limit);
      if (accountIds) q = q.in("account_id", accountIds);
      const { data, error } = await q;
      if (error) fail("journal de collecte", error);
      return data ?? [];
    },

    async listReportSchedules(brandIds) {
      let q = client.from("report_schedules").select("*").order("created_at");
      if (brandIds) q = q.in("brand_id", brandIds);
      const { data, error } = await q;
      if (error) fail("envois programmés", error);
      return data ?? [];
    },

    async listAccessLogs({ limit }) {
      const { data, error } = await client.from("access_logs").select("*").order("created_at", { ascending: false }).limit(limit);
      if (error) fail("journal des connexions", error);
      return data ?? [];
    },
  };
}
