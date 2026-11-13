/**
 * Faux serveur Graph API pour les tests : route GET et Batch API vers un gestionnaire
 * (relativeUrl → { code, body }). Enregistre les URL appelées (pour vérifier l'absence de jeton).
 */
export interface FakeResponse {
  code: number;
  body: unknown;
  headers?: Record<string, string>;
}
export type FakeHandler = (relativeUrl: string) => FakeResponse;

export function fakeFetch(handler: FakeHandler) {
  const calls: { url: string; batch?: string[] }[] = [];
  const impl = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = String(input);
    if (init?.method === "POST") {
      const form = new URLSearchParams(String(init.body));
      const items = JSON.parse(form.get("batch") ?? "[]") as { relative_url: string }[];
      calls.push({ url, batch: items.map((i) => i.relative_url) });
      const out = items.map((i) => {
        const r = handler(i.relative_url);
        return { code: r.code, headers: [], body: JSON.stringify(r.body) };
      });
      return new Response(JSON.stringify(out), { status: 200, headers: { "content-type": "application/json" } });
    }
    calls.push({ url });
    const rel = url.replace(/^https:\/\/graph\.facebook\.com\/v\d+\.\d+\//, "");
    const r = handler(rel);
    return new Response(JSON.stringify(r.body), { status: r.code, headers: { "content-type": "application/json", ...(r.headers ?? {}) } });
  }) as typeof fetch;
  return { impl, calls };
}

export const ok = (body: unknown): FakeResponse => ({ code: 200, body });
export const fail = (body: unknown, code = 400): FakeResponse => ({ code, body });
