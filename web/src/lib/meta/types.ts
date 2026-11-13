import type { AudienceDemographics, ISODate, ISOTimestamp, Network, OnlineFollowers, PostFormat, SyncCallLog } from "@/lib/db/types";
import type { DateRange } from "@/lib/metrics/types";
import type { DailyColumn, PostColumn } from "./metric-map";
import type { GraphClient } from "./graph";

/** Contexte d'appel : jeton DÉCHIFFRÉ (jamais journalisé), côté serveur uniquement. */
export interface MetaCallContext {
  /** id de la Page FB ou de l'IG User */
  externalId: string;
  accessToken: string;
  apiVersion: string;
  /** client Graph partagé (quotas, compteur de requêtes) ; créé à la volée sinon */
  graph?: GraphClient;
}

/** Résultat commun : données + journal des appels (→ sync_runs.details.calls). */
export interface MetaResult<T> {
  data: T;
  calls: SyncCallLog[];
}

/** Valeurs d'un jour, prêtes pour un upsert dans account_daily_metrics (absent = indisponible). */
export interface DailyValues {
  date: ISODate;
  values: Partial<Record<DailyColumn, number>>;
}

export interface FetchedPost {
  externalId: string;
  network: Extract<Network, "fb" | "ig">;
  publishedAt: ISOTimestamp;
  format: PostFormat;
  caption: string | null;
  permalink: string | null;
  thumbnailUrl: string | null;
  mediaUrl: string | null;
  /** statistiques au moment de l'appel (le snapshot J+1/J+7/J+28 est choisi par la synchro) */
  metrics: Partial<Record<PostColumn, number>>;
}

export interface FetchedAudience {
  date: ISODate;
  demographics: AudienceDemographics;
  onlineFollowers: OnlineFollowers | null;
}

/** Profil d'un compte : sert à rafraîchir name / handle / avatar_url / followers_count. */
export interface FetchedProfile {
  externalId: string;
  network: Extract<Network, "fb" | "ig">;
  name: string | null;
  handle: string | null;
  avatarUrl: string | null;
  followersCount: number | null;
}

/** Compte découvert après Facebook Login for Business (Page + IG lié éventuel). */
export interface DiscoveredAccount extends FetchedProfile {
  /** jeton de Page (longue durée si dérivé d'un jeton utilisateur longue durée) */
  pageAccessToken: string;
  /** IG : id de la Page FB porteuse */
  parentPageId: string | null;
  /** FB : catégorie de la Page (→ secteur de la marque) */
  category?: string | null;
}

export interface ExchangedToken {
  accessToken: string;
  /** null = n'expire pas (jeton de Page dérivé) */
  expiresAt: ISOTimestamp | null;
}

export type { DateRange };
