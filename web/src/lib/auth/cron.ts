import "server-only";
import { timingSafeEqual } from "node:crypto";
import { NextResponse, type NextRequest } from "next/server";

/**
 * Vérifie l'appel d'une route /api/cron/* : Vercel Cron envoie
 * « Authorization: Bearer $CRON_SECRET ». Renvoie une réponse 401 si invalide, sinon null.
 */
export function assertCronRequest(request: NextRequest): NextResponse | null {
  const secret = process.env.CRON_SECRET;
  const header = request.headers.get("authorization") ?? "";
  const expected = `Bearer ${secret ?? ""}`;
  const ok =
    !!secret &&
    secret.length >= 16 &&
    header.length === expected.length &&
    timingSafeEqual(Buffer.from(header), Buffer.from(expected));
  return ok ? null : NextResponse.json({ error: "unauthorized" }, { status: 401 });
}
