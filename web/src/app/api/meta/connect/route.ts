import { randomBytes } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";
import { getSessionUser } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { appUrl, serverEnv } from "@/lib/env.server";
import { metaDialogUrl, OAUTH_STATE_COOKIE } from "@/lib/sync/oauth";

export const dynamic = "force-dynamic";

/**
 * GET /api/meta/connect (agence uniquement) → fenêtre Facebook Login for Business (flux « code »).
 * Le state anti-CSRF est conservé dans un cookie httpOnly et vérifié par /api/meta/callback.
 */
export async function GET(_request: NextRequest) {
  const back = (q: string) => NextResponse.redirect(`${appUrl()}/settings/accounts?${q}`);
  if (isDemoMode()) return back("error=demo");
  const user = await getSessionUser();
  if (!user) return NextResponse.redirect(`${appUrl()}/login?next=/settings/accounts`);
  if (!user.isAgency || !user.organizationId) return NextResponse.json({ error: "forbidden" }, { status: 403 });

  const state = randomBytes(24).toString("base64url");
  let url: string;
  try {
    url = metaDialogUrl({ appId: serverEnv("META_APP_ID"), configId: serverEnv("META_CONFIG_ID"), state });
  } catch {
    return back("error=config");
  }
  const res = NextResponse.redirect(url);
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/api/meta",
    maxAge: 600,
  });
  return res;
}
