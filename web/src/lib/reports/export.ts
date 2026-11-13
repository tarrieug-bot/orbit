import "server-only";
import type { ExportFormat } from "@/lib/db/types";
import type { ReportModel } from "./model";
import { renderReportCsv } from "./render/csv";
import { renderReportPdf } from "./render/pdf";
import { renderReportPptx } from "./render/pptx";
import { loadReportImages } from "./render/images";
import { slugify } from "@/lib/sync/rules";

export const CONTENT_TYPES: Record<ExportFormat, string> = {
  pdf: "application/pdf",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  csv: "text/csv; charset=utf-8",
};

/** Rend un rapport dans le format demandé. */
export async function renderReport(model: ReportModel, format: ExportFormat): Promise<Buffer> {
  if (format === "csv") return Buffer.from(renderReportCsv(model), "utf8");
  const images = await loadReportImages(model);
  return format === "pdf" ? renderReportPdf(model, { images }) : renderReportPptx(model, { images });
}

/** « orbit-cafe-lumiere-2026-10-01_2026-10-31-fr.pdf » */
export function reportFileName(model: ReportModel, format: ExportFormat): string {
  return `orbit-${slugify(model.brand.name)}-${model.period.range.from}_${model.period.range.to}-${model.lang}.${format}`;
}
