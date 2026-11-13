import { timingSafeEqual } from "node:crypto";
import { after, NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { appUrl } from "@/lib/env.server";
import { discoverAccounts, exchangeCode, exchangeToken, tokenExpiry } from "@/lib/meta/client";
import { maskTokens } from "@/lib/meta/graph";
import { persistDiscoveredAccounts } from "@/lib/sync/connect";
import { DEFAULT_BUDGET_MS, runSyncBatch } from "@/lib/sync/engine";
import { metaRedirectUri, OAUTH_STATE_COOKIE } from "@/lib/sync/oauth";
import { createSupabaseSyncStore } from "@/lib/sync/supabase-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * GET /api/meta/callback?code=…&state=… — retour de Facebook Login for Business.
 * code → jeton utilisateur → jeton longue durée → Pages + jetons de Page + comptes IG liés + photos
 * → marques / comptes / jetons chiffrés, puis premier remplissage en tâche de fond (after()).
 */
export async function GET(request: NextRequest) {
  const done = (q: string) => {
    const res = NextResponse.redirect(`${appUrl()}/settings/accounts?${q}`);
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/api/meta", maxAge: 0 });
    return res;
  };
  if (isDemoMode()) return done("error=demo");
  const sp = request.nextUrl.searchParams;
  if (sp.get("error")) return done("error=cancelled");

  const expected = request.cookies.get(OAUTH_STATE_COOKIE)?.value ?? "";
  const state = sp.get("state") ?? "";
  if (!expected || expected.length !== state.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(state))) {
    return done("error=state");
  }
  const code = sp.get("code");
  if (!code) return done("error=code");

  const user = await getSessionUser();
  if (!user?.isAgency || !user.organizationId) return done("error=forbidden");

  try {
    const short = await exchangeCode(code, metaRedirectUri());
    const long = await exchangeToken(short.accessToken);
    const accounts = await discoverAccounts(long.accessToken);
    if (!accounts.length) return done("error=no_pages");
    const saved = await persistDiscoveredAccounts({
      organizationId: user.organizationId,
      userId: user.id,
      accounts,
      tokenExpiresAt: async (a) => (await tokenExpiry(a.pageAccessToken)) ?? long.expiresAt,
    });
    if (saved.accountIds.length) {
      after(async () => {
        try {
          await runSyncBatch({ store: createSupabaseSyncStore(), trigger: "connect", deadline: Date.now() + DEFAULT_BUDGET_MS, accountIds: saved.accountIds });
        } catch (err) {
          console.error("[meta/callback] premier remplissage :", maskTokens((err as Error).message));
        }
      });
    }
    return done(`connected=1&accounts=${saved.accountIds.length}&brands=${saved.createdBrands}`);
  } catch (err) {
    console.error("[meta/callback]", maskTokens((err as Error).message));
    return done("error=meta");
  }
}
