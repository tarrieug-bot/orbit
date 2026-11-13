import "server-only";
import type {
  DailyValues,
  DateRange,
  DiscoveredAccount,
  ExchangedToken,
  FetchedAudience,
  FetchedPost,
  FetchedProfile,
  MetaCallContext,
  MetaResult,
} from "./types";

/**
 * Client API Graph Meta — STUBS typés.
 * Propriétaire : agent back/data. Référence d'implémentation : module « MODE LIVE »
 * de /index.html (loadFbRange, loadFbPosts, loadIgRange, loadIgMedia, loadDemo) et
 * la table ./metric-map.ts. Contraintes :
 *   - serveur uniquement ; App Secret via serverEnv("META_APP_SECRET") ; appsecret_proof recommandé ;
 *   - ne jamais journaliser un jeton (masquer access_token=… dans les messages) ;
 *   - code 190 = jeton invalide → statut « expired » ; code 100 = métrique indisponible → l'ignorer
 *     ensuite pour ce compte ; respecter les quotas (en-têtes X-App-Usage / X-Business-Use-Case-Usage) ;
 *   - requêtes groupées (batch, 50 max) pour les métriques IG jour par jour.
 */

export class MetaNotImplementedError extends Error {
  constructor(fn: string) {
    super(`lib/meta : ${fn}() n'est pas encore implémenté (agent back/data).`);
  }
}

/** Métriques quotidiennes d'une Page Facebook (fenêtres de 89 jours). */
export async function fetchPageDaily(_ctx: MetaCallContext, _range: DateRange): Promise<MetaResult<DailyValues[]>> {
  throw new MetaNotImplementedError("fetchPageDaily");
}

/** Métriques quotidiennes d'un compte Instagram professionnel. */
export async function fetchIgDaily(_ctx: MetaCallContext, _range: DateRange): Promise<MetaResult<DailyValues[]>> {
  throw new MetaNotImplementedError("fetchIgDaily");
}

/** Publications (FB : /published_posts ; IG : /media) publiées depuis `since`, avec statistiques. */
export async function fetchPosts(
  _ctx: MetaCallContext,
  _opts: { network: "fb" | "ig"; since: string; limit?: number },
): Promise<MetaResult<FetchedPost[]>> {
  throw new MetaNotImplementedError("fetchPosts");
}

/** Démographie + abonnés en ligne (Instagram uniquement). */
export async function fetchAudience(_ctx: MetaCallContext): Promise<MetaResult<FetchedAudience>> {
  throw new MetaNotImplementedError("fetchAudience");
}

/** Profil (nom, @, photo de profil, abonnés) — appelé à chaque synchro pour rafraîchir avatar_url. */
export async function fetchProfile(_ctx: MetaCallContext, _network: "fb" | "ig"): Promise<MetaResult<FetchedProfile>> {
  throw new MetaNotImplementedError("fetchProfile");
}

/** Échange un jeton utilisateur court (Login for Business) contre un jeton longue durée. */
export async function exchangeToken(_shortLivedUserToken: string): Promise<ExchangedToken> {
  throw new MetaNotImplementedError("exchangeToken");
}

/** Liste les Pages et comptes IG accessibles avec un jeton utilisateur longue durée. */
export async function discoverAccounts(_longLivedUserToken: string): Promise<DiscoveredAccount[]> {
  throw new MetaNotImplementedError("discoverAccounts");
}
