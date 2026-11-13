/** CSV compatible Excel (BOM UTF-8, séparateur « ; » en français, « , » en anglais). */
export function toCsv(rows: (string | number | null | undefined)[][], locale: "fr" | "en"): string {
  const sep = locale === "fr" ? ";" : ",";
  const esc = (v: string | number | null | undefined) => {
    if (v == null) return "";
    const s = typeof v === "number" ? (locale === "fr" ? String(v).replace(".", ",") : String(v)) : v;
    return (locale === "fr" ? /[";\n\r]/ : /[",\n\r]/).test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  return "﻿" + rows.map((r) => r.map(esc).join(sep)).join("\r\n");
}

export function csvResponse(body: string, filename: string): Response {
  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename.replace(/[^\w.-]+/g, "-")}"`,
      "Cache-Control": "no-store",
    },
  });
}

/** Arrondi d'un ratio en pourcentage à 2 décimales (0.0345 → 3.45). */
export const pct2 = (r: number) => Math.round(r * 10000) / 100;
