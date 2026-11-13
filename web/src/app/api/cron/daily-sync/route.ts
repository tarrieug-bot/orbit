import { NextResponse, type NextRequest } from "next/server";
import { assertCronRequest } from "@/lib/auth/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Collecte quotidienne (Vercel Cron, 10:00 UTC = 06:00 Martinique).
 * STUB — propriétaire : agent back/data. À implémenter dans src/lib/sync/ :
 *  1. lister les social_accounts actifs (client service role) ;
 *  2. pour chacun : déchiffrer le jeton (lib/security/tokens), fetchProfile (avatar_url, followers_count),
 *     fetchPageDaily / fetchIgDaily pour J−1 (+ rattrapage des jours manquants), fetchPosts récents
 *     et snapshots J+1/J+7/J+28, fetchAudience (IG, 1×/semaine) ;
 *  3. upsert des tables + une ligne sync_runs par compte (details.calls = journal des appels) ;
 *  4. statut du compte : expired (code 190), expiring (< 7 j), error.
 */
export async function GET(request: NextRequest) {
  const denied = assertCronRequest(request);
  if (denied) return denied;
  return NextResponse.json({ ok: false, status: "not_implemented" }, { status: 501 });
}
