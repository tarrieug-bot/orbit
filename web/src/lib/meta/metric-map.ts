/**
 * Table de correspondance VERSIONNÉE : nos métriques internes ↔ métriques de l'API Graph Meta.
 *
 * Vérifiée le 2026-11 sur un vrai compte (Graph API v25, app en mode test,
 * Facebook Login for Business) — toutes les entrées « verified: true » ont répondu.
 * Quand Meta renomme / supprime une métrique : ajouter une NOUVELLE version
 * (ne pas réécrire l'ancienne) et faire pointer META_METRIC_MAP dessus.
 *
 * Colonnes internes = colonnes de account_daily_metrics / post_metrics.
 */
import type { AccountDailyMetricsRow, PostMetricsRow } from "@/lib/db/types";

export type DailyColumn = Exclude<keyof AccountDailyMetricsRow, "account_id" | "date" | "raw" | "updated_at">;
export type PostColumn = Exclude<keyof PostMetricsRow, "post_id" | "snapshot_day" | "captured_at" | "raw">;

export interface ApiMetric<Col extends string> {
  /** colonne interne alimentée */
  column: Col;
  /** nom de la métrique côté Meta */
  metric: string;
  period?: "day" | "lifetime";
  /** IG : métriques « total_value » interrogées jour par jour */
  metricType?: "time_series" | "total_value";
  breakdown?: string;
  /** fenêtre max par appel (jours) */
  maxWindowDays?: number;
  /** a répondu lors du diagnostic réel */
  verified: boolean;
  notes?: string;
}

export interface MetaMetricMap {
  apiVersion: string;
  verifiedAt: string;
  facebookPage: ApiMetric<DailyColumn>[];
  instagramAccount: ApiMetric<DailyColumn>[];
  facebookPost: ApiMetric<PostColumn>[];
  instagramMedia: ApiMetric<PostColumn>[];
  instagramAudience: { metric: string; breakdowns: string[]; period: "lifetime"; metricType: "total_value"; verified: boolean; notes?: string }[];
  /** permissions requises par Facebook Login for Business */
  permissions: string[];
}

export const META_METRIC_MAP_V25: MetaMetricMap = {
  apiVersion: "v25.0",
  verifiedAt: "2026-11",
  facebookPage: [
    { column: "followers", metric: "page_follows", period: "day", maxWindowDays: 89, verified: true, notes: "stock d'abonnés de fin de journée" },
    { column: "followers_gained", metric: "page_daily_follows_unique", period: "day", maxWindowDays: 89, verified: true },
    { column: "followers_lost", metric: "page_daily_unfollows_unique", period: "day", maxWindowDays: 89, verified: true },
    { column: "reach", metric: "page_total_media_view_unique", period: "day", maxWindowDays: 89, verified: true, notes: "remplace page_impressions_unique (portée) depuis 2026" },
    { column: "views", metric: "page_media_view", period: "day", maxWindowDays: 89, verified: true, notes: "remplace page_impressions (vues)" },
    { column: "interactions", metric: "page_post_engagements", period: "day", maxWindowDays: 89, verified: true },
    { column: "profile_visits", metric: "page_views_total", period: "day", maxWindowDays: 89, verified: true },
  ],
  instagramAccount: [
    { column: "reach", metric: "reach", period: "day", metricType: "time_series", maxWindowDays: 30, verified: true, notes: "fenêtres ≤ 30 jours" },
    { column: "views", metric: "views", period: "day", metricType: "total_value", maxWindowDays: 1, verified: true, notes: "remplace impressions ; un appel par jour (batch)" },
    { column: "interactions", metric: "total_interactions", period: "day", metricType: "total_value", maxWindowDays: 1, verified: true },
    { column: "likes", metric: "likes", period: "day", metricType: "total_value", maxWindowDays: 1, verified: true },
    { column: "comments", metric: "comments", period: "day", metricType: "total_value", maxWindowDays: 1, verified: true },
    { column: "shares", metric: "shares", period: "day", metricType: "total_value", maxWindowDays: 1, verified: true },
    { column: "saves", metric: "saves", period: "day", metricType: "total_value", maxWindowDays: 1, verified: true },
    { column: "profile_visits", metric: "profile_views", period: "day", metricType: "total_value", maxWindowDays: 1, verified: true },
    { column: "link_clicks", metric: "profile_links_taps", period: "day", metricType: "total_value", maxWindowDays: 1, verified: true },
    { column: "followers_gained", metric: "follows_and_unfollows", period: "day", metricType: "total_value", breakdown: "follow_type", maxWindowDays: 1, verified: true, notes: "dimension FOLLOWER" },
    { column: "followers_lost", metric: "follows_and_unfollows", period: "day", metricType: "total_value", breakdown: "follow_type", maxWindowDays: 1, verified: true, notes: "dimension NON_FOLLOWER" },
    { column: "followers", metric: "followers_count", verified: true, notes: "champ du nœud IG User (pas une métrique insights) : relevé quotidien, l'historique se reconstruit par gains/pertes" },
  ],
  facebookPost: [
    { column: "reach", metric: "post_total_media_view_unique", period: "lifetime", verified: true, notes: "/{page}/published_posts exige pages_read_user_content" },
    { column: "views", metric: "post_media_view", period: "lifetime", verified: true },
    { column: "likes", metric: "reactions.summary(total_count)", verified: true, notes: "champ de la publication, pas insights" },
    { column: "comments", metric: "comments.summary(total_count)", verified: true, notes: "champ de la publication" },
    { column: "shares", metric: "shares", verified: true, notes: "champ de la publication (shares.count)" },
  ],
  instagramMedia: [
    { column: "reach", metric: "reach", period: "lifetime", verified: true },
    { column: "views", metric: "views", period: "lifetime", verified: true },
    { column: "saves", metric: "saved", period: "lifetime", verified: true },
    { column: "shares", metric: "shares", period: "lifetime", verified: true },
    { column: "interactions", metric: "total_interactions", period: "lifetime", verified: true },
    { column: "likes", metric: "like_count", verified: true, notes: "champ du média" },
    { column: "comments", metric: "comments_count", verified: true, notes: "champ du média" },
  ],
  instagramAudience: [
    { metric: "follower_demographics", breakdowns: ["age,gender", "city", "country"], period: "lifetime", metricType: "total_value", verified: true, notes: "réessayer avec timeframe=this_month puis last_90_days si erreur" },
    { metric: "online_followers", breakdowns: [], period: "lifetime", metricType: "total_value", verified: false, notes: "peut échouer selon le compte : repli = heatmap d'engagement des publications" },
  ],
  permissions: [
    "pages_show_list",
    "pages_read_engagement",
    "pages_read_user_content",
    "read_insights",
    "instagram_basic",
    "instagram_manage_insights",
    "business_management",
  ],
};

/** Version utilisée par la collecte. */
export const META_METRIC_MAP: MetaMetricMap = META_METRIC_MAP_V25;
