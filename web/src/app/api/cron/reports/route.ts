import { NextResponse, type NextRequest } from "next/server";
import { assertCronRequest } from "@/lib/auth/cron";
import { isDemoMode } from "@/lib/env";
import { appUrl } from "@/lib/env.server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { buildReportModel } from "@/lib/reports/build";
import { buildReportEmail, nextRunAt, schedulePeriod, sendWithResend } from "@/lib/reports/email";
import { CONTENT_TYPES, renderReport, reportFileName } from "@/lib/reports/export";
import { createSystemReportLoader } from "@/lib/reports/system-loader";
import { todayISO } from "@/lib/metrics";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const BUDGET_MS = 50_000;

/**
 * Envois programmés (Vercel Cron, 10:30 UTC) : report_schedules actifs dont next_run_at ≤ maintenant.
 * Pour chacun : rapport dans la langue de l'envoi → bucket « exports » + report_exports →
 * e-mail HTML (FR/EN) avec le fichier en pièce jointe via Resend → next_run_at avancé.
 * Sans RESEND_API_KEY : journalise et n'envoie rien (les envois restent dus).
 */
export async function GET(request: NextRequest) {
  const denied = assertCronRequest(request);
  if (denied) return denied;
  if (isDemoMode()) return NextResponse.json({ ok: true, skipped: "demo" });

  const started = Date.now();
  const admin = createSupabaseAdminClient();
  const { data: due, error } = await admin
    .from("report_schedules")
    .select("*")
    .eq("active", true)
    .lte("next_run_at", new Date().toISOString())
    .order("next_run_at")
    .limit(50);
  if (error) return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  if (!due?.length) return NextResponse.json({ ok: true, due: 0 });

  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) {
    console.warn(`[cron/reports] RESEND_API_KEY absente : ${due.length} envoi(s) dû(s) non envoyé(s).`);
    return NextResponse.json({ ok: true, due: due.length, sent: 0, skipped: "no_resend_key" });
  }
  const from = process.env.REPORTS_FROM_EMAIL || "Orbit <rapports@orbit.local>";
  const today = todayISO();
  const loader = createSystemReportLoader();
  const results: { scheduleId: string; ok: boolean; error?: string }[] = [];

  for (const s of due) {
    if (Date.now() - started > BUDGET_MS - 10_000) break;
    const format = s.format;
    let exportId: string | null = null;
    try {
      if (!s.recipients.length) throw new Error("aucun destinataire");
      const model = await buildReportModel(
        { brandId: s.brand_id, period: schedulePeriod(s.frequency, today), compare: s.compare, sections: s.sections, lang: s.locale, networks: s.networks },
        { loader },
      );
      const file = await renderReport(model, format);
      const { data: row } = await admin
        .from("report_exports")
        .insert({
          brand_id: s.brand_id, schedule_id: s.id, kind: model.period.type, period_start: model.period.range.from, period_end: model.period.range.to,
          locale: s.locale, format, networks: s.networks, sections: model.sections, status: "processing", created_by: s.created_by,
        })
        .select("id")
        .single();
      exportId = row?.id ?? null;
      if (exportId) {
        const path = `${s.brand_id}/${exportId}.${format}`;
        const up = await admin.storage.from("exports").upload(path, file, { contentType: CONTENT_TYPES[format], upsert: true });
        if (!up.error) await admin.from("report_exports").update({ storage_path: path }).eq("id", exportId);
      }
      const mail = buildReportEmail(model, { appUrl: appUrl(), format });
      await sendWithResend({ apiKey, from, to: s.recipients, subject: mail.subject, html: mail.html, text: mail.text, attachment: { filename: reportFileName(model, format), content: file } });
      if (exportId) await admin.from("report_exports").update({ status: "ready", completed_at: new Date().toISOString() }).eq("id", exportId);
      await admin.from("report_schedules").update({ last_run_at: new Date().toISOString(), next_run_at: nextRunAt(s.frequency, today) }).eq("id", s.id);
      results.push({ scheduleId: s.id, ok: true });
    } catch (err) {
      const message = (err as Error).message;
      console.error(`[cron/reports] envoi ${s.id} :`, message);
      if (exportId) await admin.from("report_exports").update({ status: "error", error: message }).eq("id", exportId);
      results.push({ scheduleId: s.id, ok: false, error: message });
    }
  }
  return NextResponse.json({ ok: true, due: due.length, sent: results.filter((r) => r.ok).length, results, durationMs: Date.now() - started });
}
