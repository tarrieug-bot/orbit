import { createHmac } from "node:crypto";

/**
 * Client HTTP léger pour l'API Graph Meta (fetch natif).
 *  - version : META_API_VERSION (défaut v25.0) ;
 *  - appsecret_proof ajouté si l'App Secret est connu ;
 *  - retries exponentiels sur les erreurs de quota (4, 17, 32, 613, 80000-80014) et les 5xx ;
 *  - lecture des en-têtes x-app-usage / x-business-use-case-usage (pourcentage de quota consommé) ;
 *  - Batch API (POST /, ≤ 50 requêtes par lot), chaque requête du lot réussit ou échoue seule ;
 *  - aucun jeton dans les messages d'erreur (masqués).
 * Pas d'import "server-only" ici pour rester testable ; les points d'entrée (client.ts) le sont.
 */

export const GRAPH_HOST = "https://graph.facebook.com";
export const DEFAULT_API_VERSION = "v25.0";
export const BATCH_LIMIT = 50;

/** Codes d'erreur Meta de dépassement de quota / indisponibilité temporaire. */
const RETRYABLE_CODES = new Set([1, 2, 4, 17, 32, 341, 613]);
const isBusinessThrottle = (code: number) => code >= 80000 && code <= 80014;

export function maskTokens(text: string): string {
  return String(text ?? "")
    .replace(/(access_token|input_token|appsecret_proof|fb_exchange_token|client_secret|code)=([^&\s"']+)/g, "$1=…")
    .replace(/EAA[A-Za-z0-9]{20,}/g, "EAA…");
}

export class MetaApiError extends Error {
  readonly code: number;
  readonly subcode: number | null;
  readonly status: number;
  readonly type: string | null;
  constructor(message: string, opts: { code?: number; subcode?: number | null; status?: number; type?: string | null }) {
    super(maskTokens(message));
    this.name = "MetaApiError";
    this.code = opts.code ?? 0;
    this.subcode = opts.subcode ?? null;
    this.status = opts.status ?? 0;
    this.type = opts.type ?? null;
  }
  /** jeton invalide / expiré / révoqué → reconnexion nécessaire */
  get isAuthError(): boolean {
    return this.code === 190 || this.code === 102 || (this.code === 10 && this.subcode === 460);
  }
  /** métrique / champ indisponible pour ce compte ou cette version */
  get isUnavailable(): boolean {
    return this.code === 100;
  }
  get isRetryable(): boolean {
    return RETRYABLE_CODES.has(this.code) || isBusinessThrottle(this.code) || this.status >= 500 || this.status === 429;
  }
}

export interface GraphErrorBody {
  error?: { message?: string; code?: number; error_subcode?: number; type?: string };
}

export function errorFromBody(body: unknown, status: number): MetaApiError {
  const e = (body as GraphErrorBody | null)?.error;
  return new MetaApiError(e?.message ?? `HTTP ${status}`, { code: e?.code, subcode: e?.error_subcode ?? null, status, type: e?.type ?? null });
}

export interface UsageSnapshot {
  /** pourcentage max consommé (0–100) sur les en-têtes connus */
  maxPercent: number;
  /** minutes avant retour d'accès annoncées par Meta (0 si non bloqué) */
  regainMinutes: number;
}

/** Lit x-app-usage, x-page-usage, x-ad-account-usage et x-business-use-case-usage. */
export function parseUsageHeaders(headers: Headers | Record<string, string | null | undefined>): UsageSnapshot {
  const get = (k: string): string | null | undefined =>
    headers instanceof Headers ? headers.get(k) : (headers[k] ?? headers[k.toLowerCase()]);
  let maxPercent = 0;
  let regainMinutes = 0;
  const take = (o: unknown) => {
    if (!o || typeof o !== "object") return;
    const r = o as Record<string, unknown>;
    for (const k of ["call_count", "total_time", "total_cputime", "acc_id_util_pct"]) {
      const v = Number(r[k]);
      if (Number.isFinite(v)) maxPercent = Math.max(maxPercent, v);
    }
    const t = Number(r.estimated_time_to_regain_access);
    if (Number.isFinite(t)) regainMinutes = Math.max(regainMinutes, t);
  };
  for (const name of ["x-app-usage", "x-page-usage", "x-ad-account-usage"]) {
    const raw = get(name);
    if (!raw) continue;
    try {
      take(JSON.parse(raw));
    } catch {
      /* en-tête illisible : ignoré */
    }
  }
  const buc = get("x-business-use-case-usage");
  if (buc) {
    try {
      const parsed = JSON.parse(buc) as Record<string, unknown>;
      for (const list of Object.values(parsed)) if (Array.isArray(list)) list.forEach(take);
    } catch {
      /* ignoré */
    }
  }
  return { maxPercent, regainMinutes };
}

export interface GraphClientOptions {
  accessToken: string;
  apiVersion?: string;
  /** App Secret : ajoute appsecret_proof (recommandé par Meta) */
  appSecret?: string | null;
  fetchImpl?: typeof fetch;
  sleep?: (ms: number) => Promise<void>;
  maxRetries?: number;
  /** base du délai exponentiel (ms) */
  backoffMs?: number;
  /** horodatage (ms) au-delà duquel on ne réessaie plus */
  deadline?: number;
}

export interface BatchRequest {
  /** chemin relatif SANS jeton, ex. « 123/insights?metric=reach&period=day » */
  relativeUrl: string;
}

export type BatchResult<T = unknown> = { ok: true; body: T } | { ok: false; error: MetaApiError };

type Params = Record<string, string | number | boolean | undefined | null>;

const defaultSleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

export class GraphClient {
  readonly apiVersion: string;
  /** nombre de requêtes HTTP envoyées (un lot = 1) */
  requests = 0;
  usage: UsageSnapshot = { maxPercent: 0, regainMinutes: 0 };
  private readonly token: string;
  private readonly proof: string | null;
  private readonly fetchImpl: typeof fetch;
  private readonly sleep: (ms: number) => Promise<void>;
  private readonly maxRetries: number;
  private readonly backoffMs: number;
  private readonly deadline: number | null;

  constructor(opts: GraphClientOptions) {
    this.token = opts.accessToken;
    this.apiVersion = opts.apiVersion || DEFAULT_API_VERSION;
    this.proof = opts.appSecret && opts.accessToken ? createHmac("sha256", opts.appSecret).update(opts.accessToken).digest("hex") : null;
    this.fetchImpl = opts.fetchImpl ?? fetch;
    this.sleep = opts.sleep ?? defaultSleep;
    this.maxRetries = opts.maxRetries ?? 3;
    this.backoffMs = opts.backoffMs ?? 800;
    this.deadline = opts.deadline ?? null;
  }

  /** true si le quota consommé dépasse le seuil : la collecte doit s'arrêter et reprendre plus tard. */
  isThrottled(threshold = 85): boolean {
    return this.usage.maxPercent >= threshold || this.usage.regainMinutes > 0;
  }

  private authParams(): Record<string, string> {
    if (!this.token) return {};
    return this.proof ? { access_token: this.token, appsecret_proof: this.proof } : { access_token: this.token };
  }

  url(path: string, params: Params = {}, withAuth = true): string {
    const u = new URL(`${GRAPH_HOST}/${this.apiVersion}/${path.replace(/^\//, "")}`);
    for (const [k, v] of Object.entries(params)) if (v !== undefined && v !== null) u.searchParams.set(k, String(v));
    if (withAuth) for (const [k, v] of Object.entries(this.authParams())) u.searchParams.set(k, v);
    return u.toString();
  }

  private canRetry(attempt: number, delay: number): boolean {
    if (attempt >= this.maxRetries) return false;
    return this.deadline == null || Date.now() + delay < this.deadline;
  }

  private async send(url: string, init?: RequestInit): Promise<unknown> {
    for (let attempt = 0; ; attempt++) {
      let res: Response;
      try {
        this.requests++;
        res = await this.fetchImpl(url, init);
      } catch (err) {
        const e = new MetaApiError(`Réseau : ${(err as Error).message}`, { status: 599 });
        const delay = this.backoffMs * 2 ** attempt;
        if (this.canRetry(attempt, delay)) {
          await this.sleep(delay);
          continue;
        }
        throw e;
      }
      const usage = parseUsageHeaders(res.headers);
      if (usage.maxPercent || usage.regainMinutes) {
        this.usage = {
          maxPercent: Math.max(this.usage.maxPercent, usage.maxPercent),
          regainMinutes: Math.max(this.usage.regainMinutes, usage.regainMinutes),
        };
      }
      let body: unknown = null;
      try {
        body = await res.json();
      } catch {
        body = null;
      }
      const hasError = !res.ok || (body as GraphErrorBody | null)?.error;
      if (!hasError) return body;
      const err = errorFromBody(body, res.status);
      const delay = this.backoffMs * 2 ** attempt;
      if (err.isRetryable && this.canRetry(attempt, delay)) {
        await this.sleep(delay);
        continue;
      }
      throw err;
    }
  }

  /** GET /{version}/{path}?params */
  async get<T = unknown>(path: string, params: Params = {}): Promise<T> {
    return (await this.send(this.url(path, params))) as T;
  }

  /** GET d'une URL complète (paging.next renvoyé par Meta, jeton déjà inclus). */
  async getUrl<T = unknown>(url: string): Promise<T> {
    if (!url.startsWith(GRAPH_HOST)) throw new MetaApiError("URL de pagination inattendue", { status: 400 });
    return (await this.send(url)) as T;
  }

  /** POST de formulaire (ex. Batch API). */
  async post<T = unknown>(path: string, form: Record<string, string>): Promise<T> {
    const body = new URLSearchParams({ ...form, ...this.authParams() });
    return (await this.send(`${GRAPH_HOST}/${this.apiVersion}/${path.replace(/^\//, "")}`, {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body,
    })) as T;
  }

  /**
   * Batch API : découpe en lots de 50, renvoie un résultat par requête (même ordre).
   * Les requêtes en erreur de quota sont réessayées (backoff) ; une erreur 190 est relancée.
   */
  async batch<T = unknown>(requests: BatchRequest[]): Promise<BatchResult<T>[]> {
    const out: BatchResult<T>[] = new Array(requests.length);
    let pending = requests.map((r, i) => ({ r, i }));
    for (let attempt = 0; pending.length; attempt++) {
      const retry: typeof pending = [];
      for (let k = 0; k < pending.length; k += BATCH_LIMIT) {
        const chunk = pending.slice(k, k + BATCH_LIMIT);
        let raw: unknown;
        try {
          raw = await this.post("", {
            batch: JSON.stringify(chunk.map(({ r }) => ({ method: "GET", relative_url: r.relativeUrl }))),
            include_headers: "false",
          });
        } catch (err) {
          const e = err instanceof MetaApiError ? err : new MetaApiError((err as Error).message, {});
          if (e.isAuthError) throw e;
          chunk.forEach(({ i }) => (out[i] = { ok: false, error: e }));
          continue;
        }
        const items = Array.isArray(raw) ? (raw as ({ code?: number; body?: string } | null)[]) : [];
        chunk.forEach(({ r, i }, j) => {
          const item = items[j];
          if (!item) {
            out[i] = { ok: false, error: new MetaApiError("Délai dépassé (requête groupée)", { status: 504 }) };
            retry.push({ r, i });
            return;
          }
          let body: unknown = null;
          try {
            body = item.body ? JSON.parse(item.body) : null;
          } catch {
            body = null;
          }
          if (item.code === 200 && !(body as GraphErrorBody | null)?.error) {
            out[i] = { ok: true, body: body as T };
            return;
          }
          const e = errorFromBody(body, item.code ?? 500);
          out[i] = { ok: false, error: e };
          if (e.isRetryable) retry.push({ r, i });
        });
      }
      const authFail = out.find((x) => x && !x.ok && x.error.isAuthError);
      if (authFail && !authFail.ok) throw authFail.error;
      const delay = this.backoffMs * 2 ** attempt;
      if (!retry.length || !this.canRetry(attempt, delay)) break;
      await this.sleep(delay);
      pending = retry;
    }
    return out;
  }
}
