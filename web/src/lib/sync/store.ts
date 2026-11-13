import type {
  AccountDailyMetricsRow,
  AccountSyncStateRow,
  AudienceSnapshotRow,
  ISODate,
  PostFormat,
  PostMetricsRow,
  SocialAccountRow,
  SyncRunRow,
} from "@/lib/db/types";
import type { FetchedProfile } from "@/lib/meta/types";
import type { DateRange } from "@/lib/metrics/types";
import type { DailyUpsert } from "./rules";

/**
 * Accès base de la collecte (abstrait pour les tests). Implémentation Supabase
 * (service role) : ./supabase-store.ts. Aucune méthode ne renvoie ni ne journalise de jeton
 * sauf getToken (déchiffré, en mémoire uniquement).
 */
export interface PostUpsert {
  account_id: string;
  network: SocialAccountRow["network"];
  external_id: string;
  published_at: string;
  format: PostFormat;
  caption: string | null;
  permalink: string | null;
  thumbnail_url: string | null;
  media_url: string | null;
}

export type PostMetricsUpsert = Omit<PostMetricsRow, "raw"> & { raw?: null };

export interface SyncStore {
  listAccounts(opts?: { ids?: string[] }): Promise<SocialAccountRow[]>;
  listStates(accountIds: string[]): Promise<AccountSyncStateRow[]>;
  saveState(accountId: string, patch: Partial<Omit<AccountSyncStateRow, "account_id" | "updated_at">>): Promise<void>;
  /** jeton DÉCHIFFRÉ (null si absent / illisible) */
  getToken(accountId: string): Promise<string | null>;
  updateAccount(accountId: string, patch: Partial<Pick<SocialAccountRow, "name" | "handle" | "avatar_url" | "followers_count" | "status" | "status_message" | "last_synced_at" | "history_from">>): Promise<void>;
  /** photo de la marque = photo de la Page FB (sinon du compte IG si la marque n'a pas de Page) */
  refreshBrandAvatar(account: SocialAccountRow, profile: FetchedProfile): Promise<void>;
  getDailyRows(accountId: string, range: DateRange): Promise<AccountDailyMetricsRow[]>;
  /** abonnés connus d'un jour (ancre de reconstruction) */
  getDailyRow(accountId: string, date: ISODate): Promise<AccountDailyMetricsRow | null>;
  upsertDailyRows(rows: DailyUpsert[]): Promise<void>;
  /** upsert sur (account_id, external_id) → ids internes */
  upsertPosts(rows: PostUpsert[]): Promise<{ id: string; external_id: string; published_at: string }[]>;
  getSnapshots(postIds: string[]): Promise<{ post_id: string; snapshot_day: number; captured_at: string }[]>;
  upsertPostMetrics(rows: PostMetricsUpsert[]): Promise<void>;
  upsertAudience(row: Omit<AudienceSnapshotRow, "created_at">): Promise<void>;
  startRun(row: Pick<SyncRunRow, "account_id" | "kind" | "trigger" | "range_from" | "range_to">): Promise<number | null>;
  finishRun(id: number | null, patch: Pick<SyncRunRow, "status" | "details" | "error" | "range_from" | "range_to">): Promise<void>;
}
