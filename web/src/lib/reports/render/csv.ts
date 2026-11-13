import type { ReportModel } from "../model";

/** Export CSV (séparateur « ; », BOM UTF-8 pour Excel) des lignes quotidiennes du rapport. */
export function renderReportCsv(model: ReportModel): string {
  const esc = (v: string) => (/[;"\n\r]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return "﻿" + model.csv.map((row) => row.map(esc).join(";")).join("\r\n") + "\r\n";
}
