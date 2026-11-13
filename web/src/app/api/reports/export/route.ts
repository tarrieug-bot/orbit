import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getSessionUser } from "@/lib/db";
import { isDemoMode } from "@/lib/env";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildReportModel, ReportError } from "@/lib/reports/build";
import { CONTENT_TYPES, renderReport, reportFileName } from "@/lib/reports/export";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

/**
 * POST /api/reports/export — CONTRAT appelé par le front (ne pas modifier) :
 *   { brandId, period: { type: "month"|"year"|"campaign"|"custom", value?, from?, to? },
 *     compare: boolean, sections: string[], lang: "fr"|"en", format: "pdf"|"pptx"|"csv" }
 * → 200 fichier en téléchargement (Content-Disposition: attachment), en-tête X-Report-Export-Id si stocké.
 * Erreurs JSON : 400 invalid_body / invalid_period, 401 unauthorized, 403 forbidden, 404 not_found, 500 render_failed.
 * Accès : marque visible (RLS) + rubrique « reports » pour un client. En mode démo : pas de stockage.
 */
const bodySchema = z.object({
  brandId: z.string().min(1).max(64),
  period: z.object({
    type: z.enum(["month", "year", "campaign", "custom"]),
    value: z.string().max(64).optional(),
    from: z.string().max(10).optional(),
    to: z.string().max(10).optional(),
  }),
  compare: z.boolean(),
  sections: z.array(z.string().max(32)).max(20),
  lang: z.enum(["fr", "en"]),
  format: z.enum(["pdf", "pptx", "csv"]),
});

export async function POST(request: NextRequest) {
  const user = await getSessionUser();
  if (!user) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return NextResponse.json({ error: "invalid_body" }, { status: 400 });
  }
  const parsed = bodySchema.safeParse(raw);
  if (!parsed.success) return NextResponse.json({ error: "invalid_body", issues: parsed.error.issues.map((i) => i.path.join(".")) }, { status: 400 });
  const body = parsed.data;

  let model;
  try {
    model = await buildReportModel({ brandId: body.brandId, period: body.period, compare: body.compare, sections: body.sections, lang: body.lang });
  } catch (err) {
    if (err instanceof ReportError) {
      const status = err.code === "not_found" ? 404 : err.code === "forbidden" ? 403 : 400;
      return NextResponse.json({ error: err.code, message: err.message }, { status });
    }
    console.error("[reports/export] modèle :", (err as Error).message);
    return NextResponse.json({ error: "render_failed" }, { status: 500 });
  }

  let file: Buffer;
  try {
    file = await renderReport(model, body.format);
  } catch (err) {
    console.error("[reports/export] rendu :", (err as Error).message);
    return NextResponse.json({ error: "render_failed" }, { status: 500 });
  }

  const name = reportFileName(model, body.format);
  const headers = new Headers({
    "content-type": CONTENT_TYPES[body.format],
    "content-disposition": `attachment; filename="${name}"; filename*=UTF-8''${encodeURIComponent(name)}`,
    "cache-control": "no-store",
  });

  if (!isDemoMode()) {
    const exportId = await storeExport({ userId: user.id, model, format: body.format, file, campaignId: body.period.type === "campaign" ? (body.period.value ?? null) : null }).catch((err: Error) => {
      console.error("[reports/export] stockage :", err.message);
      return null;
    });
    if (exportId) headers.set("x-report-export-id", exportId);
  }
  return new NextResponse(new Uint8Array(file), { status: 200, headers });
}

/** Ligne report_exports (avec les droits de l'utilisateur : RLS) puis dépôt dans le bucket « exports ». */
async function storeExport(o: { userId: string; model: Awaited<ReturnType<typeof buildReportModel>>; format: "pdf" | "pptx" | "csv"; file: Buffer; campaignId: string | null }): Promise<string | null> {
  const db = await createSupabaseServerClient();
  const kind = o.model.period.type;
  const { data: row, error } = await db
    .from("report_exports")
    .insert({
      brand_id: o.model.brand.id,
      campaign_id: o.campaignId,
      kind,
      period_start: o.model.period.range.from,
      period_end: o.model.period.range.to,
      locale: o.model.lang,
      format: o.format,
      networks: o.model.accounts.map((a) => a.network).filter((n, i, arr) => arr.indexOf(n) === i),
      sections: o.model.sections,
      status: "processing",
      created_by: o.userId,
    })
    .select("id")
    .single();
  if (error || !row) throw new Error(error?.message ?? "insertion report_exports");
  const admin = createSupabaseAdminClient();
  const path = `${o.model.brand.id}/${row.id}.${o.format}`;
  const up = await admin.storage.from("exports").upload(path, o.file, { contentType: CONTENT_TYPES[o.format], upsert: true });
  await admin
    .from("report_exports")
    .update(up.error ? { status: "error", error: up.error.message } : { status: "ready", storage_path: path, completed_at: new Date().toISOString() })
    .eq("id", row.id);
  return row.id;
}
