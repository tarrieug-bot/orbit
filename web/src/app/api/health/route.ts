import { NextResponse } from "next/server";
import { isDemoMode } from "@/lib/env";

export const dynamic = "force-dynamic";

/** Sonde de disponibilité (aucune donnée sensible). */
export function GET() {
  return NextResponse.json({ ok: true, dataSource: isDemoMode() ? "demo" : "supabase" });
}
