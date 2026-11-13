import "server-only";
import fixtureJson from "./fixture.json";
import { addDays, todayISO } from "@/lib/metrics/dates";
import type {
  AccessLogRow,
  AccountDailyMetricsRow,
  AppLocale,
  AppRole,
  AudienceSnapshotRow,
  BrandAccessRow,
  BrandRow,
  BrandSection,
  CampaignRow,
  ISODate,
  Network,
  OrganizationRow,
  PostFormat,
  PostLatestMetricsRow,
  PostRow,
  ProfileRow,
  ReportScheduleRow,
  SocialAccountRow,
  SyncRunRow,
} from "../types";
import type { DataSource, PostWithLatestMetrics, SessionUser } from "../source/types";

/**
 * Source « démo » : données de web/scripts/generate-demo-data.mjs, sans base.
 * Simule la RLS (un client ne voit que ses marques). L'utilisateur démo est
 * choisi sur /login (cookie orbit_demo_user) — admin par défaut.
 */

interface Fixture {
  organization: { id: string; name: string; slug: string };
  users: { id: string; email: string; full_name: string; role: AppRole; locale: AppLocale; organization_id: string }[];
  brands: { id: string; name: string; slug: string; sector: string; color: string; avatar_url: string; organization_id: string }[];
  accounts: { id: string; brand_id: string; network: Network; external_id: string; parent_page_id: string | null; handle: string; name: string; avatar_url: string; followers_count: number; status: string; token_expires_in_days: number }[];
  campaigns: { id: string; brand_id: string; name: string; description: string; start: number; end: number; hashtags: string[]; color: string }[];
  daily: ({ account_id: string; offset: number } & Record<string, number | string | null>)[];
  posts: { id: string; account_id: string; network: Network; external_id: string; offset: number; time: string; format: PostFormat; caption: string; permalink: string; thumbnail_url: string | null; campaign_id: string | null }[];
  postMetrics: ({ post_id: string; snapshot_day: 1 | 7 | 28 } & Record<string, number | null>)[];
  audience: { account_id: string; offset: number; demographics: AudienceSnapshotRow["demographics"]; online_followers: Record<string, Record<string, number>> }[];
  brandAccess: { user_id: string; brand_id: string; visible_sections: BrandSection[] }[];
  syncRuns: { account_id: string; kind: string; trigger: string; offset: number; status: SyncRunRow["status"]; details: SyncRunRow["details"] }[];
  reportSchedules: { id: string; brand_id: string; name: string; kind: ReportScheduleRow["kind"]; frequency: ReportScheduleRow["frequency"]; recipients: string[]; locale: AppLocale; format: ReportScheduleRow["format"] }[];
}

const fx = fixtureJson as unknown as Fixture;
export const DEMO_USER_COOKIE = "orbit_demo_user";
export const DEMO_USERS = fx.users.map((u) => ({ email: u.email, fullName: u.full_name, role: u.role }));

/** Horodatage UTC d'une heure locale Martinique (UTC−4). */
function localTs(date: ISODate, time = "06:00"): string {
  const [h, m] = time.split(":").map(Number);
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCHours(h + 4, m);
  return d.toISOString();
}

export interface DemoDb {
  today: ISODate;
  org: OrganizationRow;
  profiles: ProfileRow[];
  brands: BrandRow[];
  accounts: SocialAccountRow[];
  daily: AccountDailyMetricsRow[];
  posts: PostRow[];
  latest: Map<string, PostLatestMetricsRow>;
  campaigns: CampaignRow[];
  audience: AudienceSnapshotRow[];
  access: BrandAccessRow[];
  syncRuns: SyncRunRow[];
  schedules: ReportScheduleRow[];
}

let cache: DemoDb | null = null;

function db(): DemoDb {
  const today = todayISO();
  if (cache && cache.today === today) return cache;
  const day = (offset: number) => addDays(today, offset);
  const created = localTs(day(-180));
  const org: OrganizationRow = { ...fx.organization, logo_url: null, timezone: "America/Martinique", created_at: created, updated_at: created };
  const latest = new Map<string, PostLatestMetricsRow>();
  for (const m of fx.postMetrics) {
    const prev = latest.get(m.post_id);
    if (prev && prev.snapshot_day >= m.snapshot_day) continue;
    const post = fx.posts.find((p) => p.id === m.post_id);
    latest.set(m.post_id, {
      post_id: m.post_id,
      snapshot_day: m.snapshot_day,
      captured_at: localTs(day((post?.offset ?? 0) + m.snapshot_day)),
      reach: m.reach ?? null, views: m.views ?? null, interactions: m.interactions ?? null, likes: m.likes ?? null,
      comments: m.comments ?? null, shares: m.shares ?? null, saves: m.saves ?? null, video_views: m.video_views ?? null,
    });
  }
  cache = {
    today,
    org,
    profiles: fx.users.map((u) => ({
      id: u.id, organization_id: u.organization_id, email: u.email, full_name: u.full_name, role: u.role, locale: u.locale,
      avatar_url: null, last_seen_at: localTs(day(-2), "09:12"), created_at: created, updated_at: created,
    })),
    brands: fx.brands.map((b) => ({ ...b, archived_at: null, created_at: created, updated_at: created })),
    accounts: fx.accounts.map((a) => ({
      id: a.id, brand_id: a.brand_id, network: a.network, external_id: a.external_id, parent_page_id: a.parent_page_id,
      handle: a.handle, name: a.name, avatar_url: a.avatar_url, followers_count: a.followers_count,
      token_expires_at: localTs(day(a.token_expires_in_days)), status: "active", status_message: null,
      last_synced_at: localTs(today, "06:00"), history_from: day(-180), connected_by: fx.users[0].id, created_at: created, updated_at: created,
    })),
    daily: fx.daily.map(({ offset, ...r }) => ({ ...(r as unknown as Omit<AccountDailyMetricsRow, "date" | "raw" | "updated_at">), date: day(offset), raw: null, updated_at: localTs(day(offset + 1)) })),
    posts: fx.posts.map(({ offset, time, ...p }) => ({ ...p, published_at: localTs(day(offset), time), media_url: null, created_at: created, updated_at: created })),
    latest,
    campaigns: fx.campaigns.map(({ start, end, ...c }) => ({ ...c, starts_on: day(start), ends_on: day(end), created_by: fx.users[1].id, created_at: created, updated_at: created })),
    audience: fx.audience.map((a) => ({
      account_id: a.account_id, date: day(a.offset), demographics: a.demographics, created_at: created,
      online_followers: Object.fromEntries(Object.entries(a.online_followers).map(([off, v]) => [day(Number(off)), v])),
    })),
    access: fx.brandAccess.map((b) => ({ ...b, invited_by: fx.users[0].id, created_at: created })),
    syncRuns: fx.syncRuns.map((s, i) => ({
      id: i + 1, account_id: s.account_id, kind: s.kind, trigger: s.trigger, started_at: localTs(day(s.offset), "06:00"),
      finished_at: localTs(day(s.offset), "06:02"), status: s.status, range_from: day(s.offset - 1), range_to: day(s.offset - 1), details: s.details, error: null,
    })),
    schedules: fx.reportSchedules.map((r) => ({
      ...r, template_id: null, networks: ["ig", "fb"], sections: [], compare: true, active: true,
      next_run_at: localTs(addDays(`${today.slice(0, 7)}-01`, 31).slice(0, 8) + "01", "06:00"), last_run_at: null, created_by: fx.users[0].id, created_at: created, updated_at: created,
    })),
  };
  return cache;
}

/** Store en mémoire du mode démo (mutations simulées : lib/db/mutations.ts). */
export function demoStore(): DemoDb {
  return db();
}

export function createDemoSource(userEmail?: string | null): DataSource {
  const d = db();
  const profile = d.profiles.find((p) => p.email === userEmail) ?? d.profiles[0];
  const isAgency = profile.role !== "client";
  const access = d.access.filter((a) => a.user_id === profile.id);
  const readable = new Set(isAgency ? d.brands.map((b) => b.id) : access.map((a) => a.brand_id));
  const readableAccounts = new Set(d.accounts.filter((a) => readable.has(a.brand_id)).map((a) => a.id));
  const agencyOnly = <T>(rows: T[]): T[] => (isAgency ? rows : []);
  const byBrand = <T extends { brand_id: string }>(rows: T[], brandIds?: string[]) =>
    rows.filter((r) => readable.has(r.brand_id) && (!brandIds || brandIds.includes(r.brand_id)));

  return {
    kind: "demo",
    async getSessionUser(): Promise<SessionUser> {
      return {
        id: profile.id, email: profile.email, fullName: profile.full_name, role: profile.role, locale: profile.locale,
        organizationId: profile.organization_id, isAgency,
        clientAccess: isAgency ? [] : access.map((a) => ({ brandId: a.brand_id, sections: a.visible_sections })),
      };
    },
    async getOrganization() {
      return d.org;
    },
    async listBrands() {
      return d.brands.filter((b) => readable.has(b.id)).sort((a, b) => a.name.localeCompare(b.name, "fr"));
    },
    async listAccounts(brandIds) {
      return byBrand(d.accounts, brandIds);
    },
    async listDailyMetrics(accountIds, range) {
      const ids = new Set(accountIds.filter((id) => readableAccounts.has(id)));
      return d.daily.filter((r) => ids.has(r.account_id) && r.date >= range.from && r.date <= range.to);
    },
    async listPosts(accountIds, range, opts): Promise<PostWithLatestMetrics[]> {
      const ids = new Set(accountIds.filter((id) => readableAccounts.has(id)));
      const lo = localTs(range.from, "00:00");
      const hi = localTs(addDays(range.to, 1), "00:00");
      return d.posts
        .filter((p) => ids.has(p.account_id) && p.published_at >= lo && p.published_at < hi)
        .sort((a, b) => (a.published_at < b.published_at ? 1 : -1))
        .slice(0, opts?.limit ?? 500)
        .map((p) => ({ ...p, metrics: d.latest.get(p.id) ?? null }));
    },
    async lastPostDates(accountIds, before) {
      const out: Record<string, ISODate> = {};
      const hi = localTs(addDays(before, 1), "00:00");
      for (const p of d.posts) {
        if (!readableAccounts.has(p.account_id) || !accountIds.includes(p.account_id) || p.published_at >= hi) continue;
        const local = new Date(new Date(p.published_at).getTime() - 4 * 3600_000).toISOString().slice(0, 10);
        if (!out[p.account_id] || out[p.account_id] < local) out[p.account_id] = local;
      }
      return out;
    },
    async listCampaigns(brandIds) {
      return byBrand(d.campaigns, brandIds).sort((a, b) => (a.starts_on < b.starts_on ? 1 : -1));
    },
    async latestAudience(accountIds) {
      return d.audience.filter((a) => readableAccounts.has(a.account_id) && accountIds.includes(a.account_id));
    },
    async listBrandAccess(brandIds) {
      const rows = isAgency ? byBrand(d.access, brandIds) : access;
      return rows.map((r) => {
        const p = d.profiles.find((x) => x.id === r.user_id)!;
        return { ...r, profile: { id: p.id, email: p.email, full_name: p.full_name, locale: p.locale, last_seen_at: p.last_seen_at } };
      });
    },
    async listSyncRuns({ accountIds, limit }) {
      return agencyOnly(d.syncRuns)
        .filter((r) => !accountIds || (r.account_id && accountIds.includes(r.account_id)))
        .sort((a, b) => (a.started_at < b.started_at ? 1 : -1))
        .slice(0, limit);
    },
    async listReportSchedules(brandIds) {
      return agencyOnly(byBrand(d.schedules, brandIds));
    },
    async listAccessLogs({ limit }): Promise<AccessLogRow[]> {
      if (!isAgency) return [];
      return d.access.slice(0, limit).map((a, i) => ({
        id: i + 1, user_id: a.user_id, brand_id: a.brand_id, event: "login", path: `/brands/${a.brand_id}`, user_agent: null, created_at: localTs(addDays(d.today, -2 - i * 3), "09:12"),
      }));
    },
  };
}
