import "server-only";
import { appUrl } from "@/lib/env.server";
import { apiVersion } from "@/lib/meta/client";

/** Cookie anti-CSRF du flux OAuth Meta (httpOnly, 10 min). */
export const OAUTH_STATE_COOKIE = "orbit_meta_oauth_state";

/** URI de redirection à déclarer dans l'app Meta (Facebook Login for Business › Paramètres). */
export function metaRedirectUri(): string {
  return `${appUrl()}/api/meta/callback`;
}

export function metaDialogUrl(opts: { appId: string; configId: string; state: string }): string {
  const u = new URL(`https://www.facebook.com/${apiVersion()}/dialog/oauth`);
  u.searchParams.set("client_id", opts.appId);
  u.searchParams.set("redirect_uri", metaRedirectUri());
  u.searchParams.set("config_id", opts.configId);
  u.searchParams.set("response_type", "code");
  u.searchParams.set("state", opts.state);
  return u.toString();
}
