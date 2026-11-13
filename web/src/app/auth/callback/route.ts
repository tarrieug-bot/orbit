import { NextResponse, type NextRequest } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { createSupabaseServerClient } from "@/lib/supabase/server";

/**
 * Retour du lien magique. Accepte :
 *  - ?code=…               (flux PKCE, même navigateur)
 *  - ?token_hash=…&type=…  (modèle d'e-mail recommandé : fonctionne d'un appareil à l'autre)
 * Journalise la connexion (access_logs) puis redirige vers ?next ou l'accueil du rôle.
 */
export async function GET(request: NextRequest) {
  const url = request.nextUrl;
  const next = url.searchParams.get("next");
  const dest = next && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  const supabase = await createSupabaseServerClient();

  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type") as EmailOtpType | null;

  let ok = false;
  if (code) ok = !(await supabase.auth.exchangeCodeForSession(code)).error;
  else if (tokenHash && type) ok = !(await supabase.auth.verifyOtp({ token_hash: tokenHash, type })).error;

  if (!ok) return NextResponse.redirect(new URL("/login?error=link", url.origin));

  const { data } = await supabase.auth.getUser();
  if (data.user) {
    await supabase.from("access_logs").insert({
      user_id: data.user.id,
      event: "login",
      path: dest,
      user_agent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
    });
    await supabase.from("profiles").update({ last_seen_at: new Date().toISOString() }).eq("id", data.user.id);
  }
  return NextResponse.redirect(new URL(dest, url.origin));
}
