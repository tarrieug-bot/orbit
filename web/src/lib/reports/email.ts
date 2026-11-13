import type { ExportFormat, ISODate, ReportFrequency } from "@/lib/db/types";
import type { ReportModel, ReportPeriodInput } from "./model";
import { reportTranslator } from "./build";
import { addDays, endOfMonth } from "@/lib/metrics";

/**
 * E-mail HTML des envois programmés (FR / EN) et calendrier des envois. Pur et testable ;
 * l'envoi lui-même passe par l'API HTTP de Resend (sendWithResend).
 */

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export function buildReportEmail(model: ReportModel, opts: { appUrl: string; format: ExportFormat }): { subject: string; html: string; text: string } {
  const t = reportTranslator(model.lang);
  const tr = (k: string, v?: Record<string, string>) => t(`reports.email.${k}` as never, v as never) as string;
  const kindLower = model.period.title.charAt(0).toLowerCase() + model.period.title.slice(1);
  const subject = tr("subject", { brand: model.brand.name, kind: model.period.title, period: model.period.label });
  const intro = tr("intro", { kind: kindLower, brand: model.brand.name, period: model.period.label });
  const kpis = model.kpis.filter((k) => ["followers", "reach", "interactions", "engagementRate"].includes(k.key));
  const link = `${opts.appUrl}/reports?brand=${encodeURIComponent(model.brand.id)}`;
  const avatar = model.brand.avatarUrl
    ? `<img src="${esc(model.brand.avatarUrl)}" width="56" height="56" alt="" style="border-radius:50%;display:block;border:3px solid #ffffff">`
    : `<div style="width:56px;height:56px;border-radius:50%;background:${esc(model.brand.color)};color:#fff;font:700 20px/56px Inter,Arial,sans-serif;text-align:center">${esc(model.brand.initials)}</div>`;
  const tile = (k: (typeof kpis)[number]) => {
    const col = k.delta?.positive === true ? "#16A34A" : k.delta?.positive === false ? "#DC2626" : "#64748B";
    return `<td style="padding:6px" width="25%"><div style="background:#ffffff;border:1px solid #E7E9F0;border-top:3px solid ${esc(model.brand.color)};border-radius:10px;padding:12px">
      <div style="font:600 10px Inter,Arial,sans-serif;color:#64748B;text-transform:uppercase;letter-spacing:.5px">${esc(k.label)}</div>
      <div style="font:800 22px Inter,Arial,sans-serif;color:#0F172A;margin-top:4px">${esc(k.display)}</div>
      ${k.delta ? `<div style="font:600 11px Inter,Arial,sans-serif;color:${col};margin-top:4px">${esc(k.delta.display)}</div>` : ""}
    </div></td>`;
  };
  const insights = model.insights
    .slice(0, 4)
    .map((i) => `<li style="margin:0 0 8px">${i.segments.map((s) => (s.bold ? `<strong style="color:#0F172A">${esc(s.text)}</strong>` : esc(s.text))).join("")}</li>`)
    .join("");
  const html = `<!doctype html><html lang="${model.lang}"><body style="margin:0;background:#F5F6FA">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#F5F6FA;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%">
  <tr><td style="background:linear-gradient(135deg,#1E1B4B,${esc(model.brand.color)});background-color:#1E1B4B;border-radius:14px 14px 0 0;padding:24px">
    <table role="presentation" cellpadding="0" cellspacing="0"><tr><td>${avatar}</td><td style="padding-left:14px">
      <div style="font:600 11px Inter,Arial,sans-serif;color:#C7D2FE;letter-spacing:1px;text-transform:uppercase">${esc(model.period.title)}</div>
      <div style="font:800 22px Inter,Arial,sans-serif;color:#ffffff">${esc(model.brand.name)}</div>
      <div style="font:400 14px Inter,Arial,sans-serif;color:#E0E7FF">${esc(model.period.label)}</div>
    </td></tr></table>
  </td></tr>
  <tr><td style="background:#ffffff;padding:24px;font:400 14px/1.55 Inter,Arial,sans-serif;color:#475569">
    <p style="margin:0 0 8px">${esc(tr("greeting"))}</p>
    <p style="margin:0 0 18px">${esc(intro)}</p>
    <div style="font:700 13px Inter,Arial,sans-serif;color:#0F172A;margin-bottom:6px">${esc(tr("highlights"))}</div>
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>${kpis.map(tile).join("")}</tr></table>
    <ul style="padding-left:18px;margin:18px 0">${insights}</ul>
    <p style="margin:0 0 18px">${esc(tr("attachment", { format: opts.format.toUpperCase() }))}</p>
    <a href="${esc(link)}" style="display:inline-block;background:#6366F1;color:#ffffff;text-decoration:none;font:600 14px Inter,Arial,sans-serif;padding:11px 20px;border-radius:9px">${esc(tr("cta"))}</a>
  </td></tr>
  <tr><td style="padding:16px 24px;font:400 11px Inter,Arial,sans-serif;color:#94A3B8;text-align:center">${esc(model.agency.name ?? "Orbit")} · ${esc(tr("footer"))}</td></tr>
</table></td></tr></table></body></html>`;
  const text = [tr("greeting"), "", intro, "", ...kpis.map((k) => `${k.label} : ${k.display}${k.delta ? ` (${k.delta.display})` : ""}`), "", ...model.insights.slice(0, 4).map((i) => `• ${i.text}`), "", link].join("\n");
  return { subject, html, text };
}

/** Période couverte par un envoi programmé, à la date `today` (période révolue la plus récente). */
export function schedulePeriod(frequency: ReportFrequency, today: ISODate): ReportPeriodInput {
  const yesterday = addDays(today, -1);
  switch (frequency) {
    case "weekly":
      return { type: "custom", from: addDays(yesterday, -6), to: yesterday };
    case "monthly":
      return { type: "month", value: addDays(`${today.slice(0, 7)}-01`, -1).slice(0, 7) };
    case "quarterly": {
      const y = Number(today.slice(0, 4));
      const q = Math.floor((Number(today.slice(5, 7)) - 1) / 3); // trimestre en cours (0–3)
      const [py, pq] = q === 0 ? [y - 1, 3] : [y, q - 1];
      const from = `${py}-${String(pq * 3 + 1).padStart(2, "0")}-01`;
      return { type: "custom", from, to: endOfMonth(`${py}-${String(pq * 3 + 3).padStart(2, "0")}-01`) };
    }
    case "yearly":
      return { type: "year", value: String(Number(today.slice(0, 4)) - 1) };
  }
}

/** Prochain envoi (06:00 Martinique = 10:00 UTC) après `today`. */
export function nextRunAt(frequency: ReportFrequency, today: ISODate): string {
  let d: ISODate;
  if (frequency === "weekly") d = addDays(today, 7);
  else if (frequency === "monthly") d = addDays(endOfMonth(today), 1);
  else if (frequency === "quarterly") {
    const m = Number(today.slice(5, 7));
    const nm = Math.floor((m - 1) / 3) * 3 + 4;
    d = nm > 12 ? `${Number(today.slice(0, 4)) + 1}-01-01` : `${today.slice(0, 4)}-${String(nm).padStart(2, "0")}-01`;
  } else d = `${Number(today.slice(0, 4)) + 1}-01-01`;
  return `${d}T10:00:00.000Z`;
}

/** Envoi via l'API Resend (https://resend.com/docs/api-reference/emails/send-email). */
export async function sendWithResend(o: {
  apiKey: string;
  from: string;
  to: string[];
  subject: string;
  html: string;
  text: string;
  attachment: { filename: string; content: Buffer };
  fetchImpl?: typeof fetch;
}): Promise<{ id: string }> {
  const res = await (o.fetchImpl ?? fetch)("https://api.resend.com/emails", {
    method: "POST",
    headers: { authorization: `Bearer ${o.apiKey}`, "content-type": "application/json" },
    body: JSON.stringify({
      from: o.from,
      to: o.to,
      subject: o.subject,
      html: o.html,
      text: o.text,
      attachments: [{ filename: o.attachment.filename, content: o.attachment.content.toString("base64") }],
    }),
  });
  const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
  if (!res.ok || !body.id) throw new Error(`Resend ${res.status} : ${body.message ?? "erreur inconnue"}`);
  return { id: body.id };
}
