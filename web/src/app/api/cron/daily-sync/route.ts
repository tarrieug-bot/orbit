import { NextResponse, type NextRequest } from "next/server";
import { assertCronRequest } from "@/lib/auth/cron";
import { isDemoMode } from "@/lib/env";
import { DEFAULT_BUDGET_MS, runSyncBatch } from "@/lib/sync/engine";
import { createSupabaseSyncStore } from "@/lib/sync/supabase-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * Collecte quotidienne (Vercel Cron, 10:00 UTC = 06:00 Martinique), protégée par CRON_SECRET.
 * Traite les comptes par lots dans un budget de ~50 s (quotidien d'abord, puis backfill) et
 * reprend où il s'est arrêté au prochain appel (account_sync_state). Peut être appelée
 * plusieurs fois par jour sans doublon (idempotent).
 */
export async function GET(request: NextRequest) {
  const denied = assertCronRequest(request);
  if (denied) return denied;
  if (isDemoMode()) return NextResponse.json({ ok: true, skipped: "demo" });
  const started = Date.now();
  const res = await runSyncBatch({ store: createSupabaseSyncStore(), trigger: "cron", deadline: started + DEFAULT_BUDGET_MS });
  return NextResponse.json({
    ok: true,
    durationMs: Date.now() - started,
    processed: res.processed.length,
    remaining: res.remaining,
    results: res.processed.map((r) => ({
      accountId: r.accountId,
      status: r.status,
      reauthRequired: r.reauthRequired,
      budgetExhausted: r.budgetExhausted,
      backfillDone: r.backfillDone,
      backfillCursor: r.backfillCursor,
      requests: r.requests,
    })),
  });
}
