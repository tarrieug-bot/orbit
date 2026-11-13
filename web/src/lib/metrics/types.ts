import type { ISODate, Network } from "@/lib/db/types";

/** Période calendaire inclusive [from ; to]. */
export interface DateRange {
  from: ISODate;
  to: ISODate;
}

/** Métriques additives (sommables jour par jour). */
export const SUMMABLE_KEYS = [
  "followersGained",
  "followersLost",
  "reach",
  "views",
  "interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "profileVisits",
  "linkClicks",
  "posts",
  "videoViews",
] as const;
export type SummableKey = (typeof SUMMABLE_KEYS)[number];
/** followers = stock (valeur de fin de journée), les autres sont des flux. */
export type MetricKey = "followers" | SummableKey;

/** Une ligne quotidienne normalisée (camelCase) — entrée de tous les calculs. */
export interface DailyMetrics {
  accountId: string;
  network: Network;
  date: ISODate;
  followers: number | null;
  followersGained: number | null;
  followersLost: number | null;
  reach: number | null;
  views: number | null;
  /** déjà complété par likes+comments+shares+saves si la plateforme ne le fournit pas */
  interactions: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  profileVisits: number | null;
  linkClicks: number | null;
  posts: number | null;
  videoViews: number | null;
}

/** Totaux d'une période (un compte, une marque ou toutes les marques). */
export interface MetricTotals extends Record<SummableKey, number> {
  /** abonnés en fin de période */
  followers: number;
  /** abonnés la veille du début de période */
  followersStart: number;
  /** évolution abonnés = fin − veille du début (SPEC §5) */
  followersNet: number;
  /** évolution relative = followersNet ÷ followersStart */
  followersGrowth: number;
  /** taux d'engagement = interactions ÷ portée (SPEC §5) */
  engagementRate: number;
  /** variante : interactions ÷ abonnés (fin de période) */
  engagementRateFollowers: number;
  interactionsPerPost: number;
  days: number;
  /** false = la métrique n'a AUCUNE valeur sur la période (indisponible ≠ 0) */
  available: Record<MetricKey, boolean>;
}

/** Point de série temporelle (somme de plusieurs comptes). */
export type SeriesPoint = { date: ISODate } & Record<MetricKey, number | null>;

export type Trend = "up" | "down" | "flat";

export interface Delta {
  current: number;
  previous: number | null;
  /** current − previous (en points × 100 pour les taux si mode « points ») */
  diff: number | null;
  /** variation relative (0.12 = +12 %) ; null si previous absent ou nul */
  ratio: number | null;
  trend: Trend;
}
