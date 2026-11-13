import { NextResponse, type NextRequest } from "next/server";
import { assertCronRequest } from "@/lib/auth/cron";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * Envois programmés (report_schedules dont next_run_at ≤ maintenant).
 * STUB — propriétaire : agent back/data (rendu : src/lib/reports/render, gabarits : src/lib/reports/templates).
 * Générer dans la langue de l'envoi, déposer dans le bucket « exports », envoyer via Resend,
 * créer report_exports et avancer next_run_at.
 */
export async function GET(request: NextRequest) {
  const denied = assertCronRequest(request);
  if (denied) return denied;
  return NextResponse.json({ ok: false, status: "not_implemented" }, { status: 501 });
}
