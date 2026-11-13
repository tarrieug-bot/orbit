import { NextResponse, type NextRequest } from "next/server";
import { isDemoMode } from "@/lib/env";
import { updateSession } from "@/lib/supabase/proxy";

/** Chemins accessibles sans session. */
const PUBLIC_PATHS = ["/login", "/auth", "/api/cron", "/api/health"];

/**
 * Proxy (ex-middleware, Next.js 16) : rafraîchit la session Supabase et renvoie
 * vers /login si besoin. Contrôle « optimiste » seulement : l'autorisation réelle
 * est faite par la RLS et les gardes de lib/auth/guards.ts.
 */
export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  if (isDemoMode()) return NextResponse.next();

  const { response, user } = await updateSession(request);
  if (!user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = pathname !== "/" ? `?next=${encodeURIComponent(pathname + request.nextUrl.search)}` : "";
    return NextResponse.redirect(url);
  }
  return response;
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico|demo/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)"],
};
