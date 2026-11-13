import { NextResponse, type NextRequest } from "next/server";
import { getConnectedAccounts, getSessionUser } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { DEFAULT_BUDGET_MS, syncAccount } from "@/lib/sync/engine";
import { createSupabaseSyncStore } from "@/lib/sync/supabase-store";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/accounts/{id}/sync (agence) — synchro manuelle d'un compte : profil, 3 derniers jours
 * (90 au premier passage), publications, puis backfill dans le budget restant.
 * Réponse : { ok, result: { status, reauthRequired, budgetExhausted, backfillDone, backfillCursor, requests, error } }
 */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  if (!user.isAgency) return NextResponse.json({ error: "forbidden" }, { status: 403 });
  if (isDemoMode()) return NextResponse.json({ error: "demo", message: "Synchronisation indisponible en mode démo." }, { status: 409 });

  // visibilité vérifiée avec les droits de l'utilisateur (RLS)
  const visible = (await getConnectedAccounts()).find((a) => a.id === id);
  if (!visible) return NextResponse.json({ error: "not_found" }, { status: 404 });

  const store = createSupabaseSyncStore();
  const [account] = await store.listAccounts({ ids: [id] });
  if (!account) return NextResponse.json({ error: "not_found" }, { status: 404 });
  const [state] = await store.listStates([id]);
  const result = await syncAccount(account, state ?? null, {
    store,
    trigger: "manual",
    force: true,
    deadline: Date.now() + DEFAULT_BUDGET_MS,
  });
  return NextResponse.json({ ok: result.status !== "error", result }, { status: result.reauthRequired ? 409 : 200 });
}
