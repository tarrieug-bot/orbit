/**
 * NB : des `type` (et non des `interface`) — supabase-js exige des Row compatibles
 * avec Record<string, unknown>.
 *
 * Types des tables Supabase d'Orbit — miroir de supabase/migrations/*.sql.
 *
 * Écrits à la main (propriété : lead). Toute nouvelle migration DOIT mettre ce
 * fichier à jour dans le même commit. Alternative : `npx supabase gen types
 * typescript --local > src/lib/db/database.generated.ts` puis comparer.
 */

export type AppRole = "admin" | "manager" | "client";
export type AppLocale = "fr" | "en";
/** ig = Instagram, fb = Facebook, tt = TikTok, li = LinkedIn, yt = YouTube */
export type Network = "ig" | "fb" | "tt" | "li" | "yt";
export type AccountStatus = "pending" | "active" | "expiring" | "expired" | "error" | "disconnected";
export type PostFormat = "image" | "carousel" | "reel" | "video" | "story" | "link" | "status";
export type SyncStatus = "running" | "success" | "partial" | "error";
export type ReportKind = "month" | "campaign" | "year" | "custom";
export type ReportFrequency = "weekly" | "monthly" | "quarterly" | "yearly";
export type ExportFormat = "pdf" | "pptx" | "csv";
export type ExportStatus = "pending" | "processing" | "ready" | "error";
export type BrandSection = "analytics" | "posts" | "audience" | "campaigns" | "reports";

export const NETWORKS: readonly Network[] = ["ig", "fb", "tt", "li", "yt"];
/** Réseaux disponibles en V1 (les autres sont affichés « bientôt »). */
export const LIVE_NETWORKS: readonly Network[] = ["ig", "fb"];
export const BRAND_SECTIONS: readonly BrandSection[] = ["analytics", "posts", "audience", "campaigns", "reports"];

/** Date calendaire ISO « YYYY-MM-DD ». */
export type ISODate = string;
/** Horodatage ISO 8601 (timestamptz). */
export type ISOTimestamp = string;
type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

// ---------------------------------------------------------------------------
// Lignes
// ---------------------------------------------------------------------------
export type OrganizationRow = {
  id: string;
  name: string;
  slug: string;
  logo_url: string | null;
  timezone: string;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
};

export type ProfileRow = {
  id: string;
  organization_id: string | null;
  email: string;
  full_name: string | null;
  role: AppRole;
  locale: AppLocale;
  avatar_url: string | null;
  last_seen_at: ISOTimestamp | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
};

export type BrandRow = {
  id: string;
  organization_id: string;
  name: string;
  slug: string;
  sector: string | null;
  color: string;
  avatar_url: string | null;
  archived_at: ISOTimestamp | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
};

export type SocialAccountRow = {
  id: string;
  brand_id: string;
  network: Network;
  external_id: string;
  parent_page_id: string | null;
  handle: string | null;
  name: string | null;
  avatar_url: string | null;
  followers_count: number | null;
  token_expires_at: ISOTimestamp | null;
  status: AccountStatus;
  status_message: string | null;
  last_synced_at: ISOTimestamp | null;
  history_from: ISODate | null;
  connected_by: string | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
};

/** Service role uniquement. access_token_enc : voir lib/security/tokens.ts */
export type SocialAccountTokenRow = {
  account_id: string;
  access_token_enc: string;
  token_type: string;
  scopes: string[];
  expires_at: ISOTimestamp | null;
  updated_at: ISOTimestamp;
};

/** État de la collecte par compte (service role uniquement) — migration 20261113180000. */
export type AccountSyncStateRow = {
  account_id: string;
  backfill_cursor: ISODate | null;
  backfill_done: boolean;
  last_daily_on: ISODate | null;
  audience_synced_at: ISOTimestamp | null;
  meta: { [key: string]: Json | undefined };
  updated_at: ISOTimestamp;
};

/** NULL = métrique indisponible pour ce compte / ce jour (≠ 0). */
export type AccountDailyMetricsRow = {
  account_id: string;
  date: ISODate;
  followers: number | null;
  followers_gained: number | null;
  followers_lost: number | null;
  reach: number | null;
  views: number | null;
  interactions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  profile_visits: number | null;
  link_clicks: number | null;
  posts_count: number | null;
  video_views: number | null;
  raw: Json | null;
  updated_at: ISOTimestamp;
};

export type CampaignRow = {
  id: string;
  brand_id: string;
  name: string;
  description: string | null;
  starts_on: ISODate;
  ends_on: ISODate;
  hashtags: string[];
  color: string | null;
  created_by: string | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
};

export type PostRow = {
  id: string;
  account_id: string;
  network: Network;
  external_id: string;
  published_at: ISOTimestamp;
  format: PostFormat;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
  campaign_id: string | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
};

export type PostMetricsRow = {
  post_id: string;
  snapshot_day: 1 | 7 | 28;
  captured_at: ISOTimestamp;
  reach: number | null;
  views: number | null;
  interactions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  video_views: number | null;
  raw: Json | null;
};

export type PostLatestMetricsRow = Omit<PostMetricsRow, "raw">;

export type AudienceDemographics = {
  age_gender?: { age: string; gender: "F" | "M" | "U"; value: number }[];
  cities?: { key: string; value: number }[];
  /** key = code pays ISO 3166-1 alpha-2 */
  countries?: { key: string; value: number }[];
};
/** { "YYYY-MM-DD": { "0": n, …, "23": n } } — heures selon Meta (Pacifique). */
export type OnlineFollowers = Record<string, Record<string, number>>;

export type AudienceSnapshotRow = {
  account_id: string;
  date: ISODate;
  demographics: AudienceDemographics;
  online_followers: OnlineFollowers | null;
  created_at: ISOTimestamp;
};

export type BrandAccessRow = {
  user_id: string;
  brand_id: string;
  visible_sections: BrandSection[];
  invited_by: string | null;
  created_at: ISOTimestamp;
};

export type AccessLogRow = {
  id: number;
  user_id: string;
  brand_id: string | null;
  event: string;
  path: string | null;
  user_agent: string | null;
  created_at: ISOTimestamp;
};

export type ReportTemplateRow = {
  id: string;
  organization_id: string;
  name: string;
  sections: string[];
  networks: Network[];
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
};

export type ReportScheduleRow = {
  id: string;
  brand_id: string;
  template_id: string | null;
  name: string;
  kind: ReportKind;
  frequency: ReportFrequency;
  recipients: string[];
  locale: AppLocale;
  format: ExportFormat;
  networks: Network[];
  sections: string[];
  compare: boolean;
  active: boolean;
  next_run_at: ISOTimestamp | null;
  last_run_at: ISOTimestamp | null;
  created_by: string | null;
  created_at: ISOTimestamp;
  updated_at: ISOTimestamp;
};

export type ReportExportRow = {
  id: string;
  brand_id: string;
  schedule_id: string | null;
  campaign_id: string | null;
  kind: ReportKind;
  period_start: ISODate;
  period_end: ISODate;
  locale: AppLocale;
  format: ExportFormat;
  networks: Network[];
  sections: string[];
  status: ExportStatus;
  storage_path: string | null;
  error: string | null;
  created_by: string | null;
  created_at: ISOTimestamp;
  completed_at: ISOTimestamp | null;
};

/** Un appel à l'API d'un réseau, tracé dans sync_runs.details.calls */
export type SyncCallLog = {
  metric: string;
  ok: boolean;
  values?: number;
  message?: string;
};

export type SyncRunRow = {
  id: number;
  account_id: string | null;
  kind: string;
  trigger: string;
  started_at: ISOTimestamp;
  finished_at: ISOTimestamp | null;
  status: SyncStatus;
  range_from: ISODate | null;
  range_to: ISODate | null;
  details: { calls?: SyncCallLog[]; [key: string]: unknown };
  error: string | null;
};

// ---------------------------------------------------------------------------
// Type Database pour supabase-js (createClient<Database>)
// ---------------------------------------------------------------------------
type Table<Row, Required extends keyof Row = never> = {
  Row: Row;
  Insert: Partial<Row> & Pick<Row, Required>;
  Update: Partial<Row>;
  Relationships: [];
};

export type BrandMetricsFnRow = {
  date: ISODate;
  network: Network;
  followers: number | null;
  followers_gained: number | null;
  followers_lost: number | null;
  reach: number | null;
  views: number | null;
  interactions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  profile_visits: number | null;
  link_clicks: number | null;
  posts_count: number | null;
  video_views: number | null;
};

export type AccountPeriodTotalsFnRow = Omit<BrandMetricsFnRow, "date" | "followers"> & {
  account_id: string;
  brand_id: string;
  followers_start: number | null;
  followers_end: number | null;
  last_post_at: ISOTimestamp | null;
};

export type Database = {
  public: {
    Tables: {
      organizations: Table<OrganizationRow, "name" | "slug">;
      profiles: Table<ProfileRow, "id" | "email">;
      brands: Table<BrandRow, "organization_id" | "name" | "slug">;
      social_accounts: Table<SocialAccountRow, "brand_id" | "network" | "external_id">;
      social_account_tokens: Table<SocialAccountTokenRow, "account_id" | "access_token_enc">;
      account_sync_state: Table<AccountSyncStateRow, "account_id">;
      account_daily_metrics: Table<AccountDailyMetricsRow, "account_id" | "date">;
      campaigns: Table<CampaignRow, "brand_id" | "name" | "starts_on" | "ends_on">;
      posts: Table<PostRow, "account_id" | "network" | "external_id" | "published_at" | "format">;
      post_metrics: Table<PostMetricsRow, "post_id" | "snapshot_day">;
      audience_snapshots: Table<AudienceSnapshotRow, "account_id" | "date">;
      brand_access: Table<BrandAccessRow, "user_id" | "brand_id">;
      access_logs: Table<AccessLogRow, "user_id">;
      report_templates: Table<ReportTemplateRow, "organization_id" | "name">;
      report_schedules: Table<ReportScheduleRow, "brand_id" | "name">;
      report_exports: Table<ReportExportRow, "brand_id" | "kind" | "period_start" | "period_end">;
      sync_runs: Table<SyncRunRow>;
    };
    Views: {
      post_latest_metrics: { Row: PostLatestMetricsRow; Relationships: [] };
    };
    Functions: {
      brand_metrics: {
        Args: { p_brand_id: string; p_from: ISODate; p_to: ISODate; p_networks?: Network[] | null };
        Returns: BrandMetricsFnRow[];
      };
      account_period_totals: {
        Args: { p_from: ISODate; p_to: ISODate; p_brand_ids?: string[] | null; p_networks?: Network[] | null };
        Returns: AccountPeriodTotalsFnRow[];
      };
      can_read_brand: { Args: { p_brand_id: string }; Returns: boolean };
      can_manage_brand: { Args: { p_brand_id: string }; Returns: boolean };
      brand_sections: { Args: { p_brand_id: string }; Returns: string[] };
      is_agency_member: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
    };
    Enums: {
      app_role: AppRole;
      app_locale: AppLocale;
      network: Network;
      account_status: AccountStatus;
      post_format: PostFormat;
      sync_status: SyncStatus;
      report_kind: ReportKind;
      report_frequency: ReportFrequency;
      export_format: ExportFormat;
      export_status: ExportStatus;
    };
    CompositeTypes: Record<string, never>;
  };
};
