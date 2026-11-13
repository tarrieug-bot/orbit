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
  OrganizationRow,
  PostLatestMetricsRow,
  PostRow,
  ProfileRow,
  ReportScheduleRow,
  SocialAccountRow,
  SyncRunRow,
} from "../types";
import type { DateRange } from "@/lib/metrics/types";

/** Utilisateur connecté, tel que le voit l'application. */
export interface SessionUser {
  id: string;
  email: string;
  fullName: string | null;
  role: AppRole;
  locale: AppLocale;
  organizationId: string | null;
  /** admin ou manager */
  isAgency: boolean;
  /** client : marques accessibles et rubriques visibles par marque (vide pour l'agence = tout) */
  clientAccess: { brandId: string; sections: BrandSection[] }[];
}

export type PostWithLatestMetrics = PostRow & { metrics: PostLatestMetricsRow | null };
export type BrandAccessWithProfile = BrandAccessRow & {
  profile: Pick<ProfileRow, "id" | "email" | "full_name" | "locale" | "last_seen_at">;
};

/**
 * Accès brut aux données, SOUMIS AUX DROITS de l'utilisateur courant
 * (RLS côté Supabase, simulée côté démo). Implémentations : supabase.ts, demo.ts.
 * Ne pas utiliser directement dans les pages : passer par lib/db/queries.ts.
 */
export interface DataSource {
  readonly kind: "supabase" | "demo";
  getSessionUser(): Promise<SessionUser | null>;
  getOrganization(): Promise<OrganizationRow | null>;
  listBrands(): Promise<BrandRow[]>;
  listAccounts(brandIds?: string[]): Promise<SocialAccountRow[]>;
  listDailyMetrics(accountIds: string[], range: DateRange): Promise<AccountDailyMetricsRow[]>;
  listPosts(accountIds: string[], range: DateRange, opts?: { limit?: number }): Promise<PostWithLatestMetrics[]>;
  /** date (fuseau agence) de la dernière publication ≤ before, par compte */
  lastPostDates(accountIds: string[], before: ISODate): Promise<Record<string, ISODate>>;
  listCampaigns(brandIds?: string[]): Promise<CampaignRow[]>;
  /** dernier snapshot d'audience de chaque compte */
  latestAudience(accountIds: string[]): Promise<AudienceSnapshotRow[]>;
  listBrandAccess(brandIds?: string[]): Promise<BrandAccessWithProfile[]>;
  listSyncRuns(opts: { accountIds?: string[]; limit: number }): Promise<SyncRunRow[]>;
  listReportSchedules(brandIds?: string[]): Promise<ReportScheduleRow[]>;
  listAccessLogs(opts: { limit: number }): Promise<AccessLogRow[]>;
}
