import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { buildReportModel } from "../build";
import { testLoader } from "../__fixtures__/loader";
import { renderReportPdf } from "./pdf";
import { renderReportPptx } from "./pptx";
import { renderReportCsv } from "./csv";
import { loadImage } from "./images";
import { pdfSafe } from "./theme";

const opts = { loader: testLoader(), today: "2026-11-13", now: new Date("2026-11-13T12:00:00Z") };
// pixel PNG 1×1 (image de repli pour les tests, sans réseau)
const PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";

describe("rendu des rapports", () => {
  it("PDF non vide (FR, toutes sections, avec images)", async () => {
    const model = await buildReportModel({ brandId: "b1", period: { type: "month", value: "2026-10" }, compare: true, sections: [], lang: "fr" }, opts);
    model.brand.avatarUrl = PNG;
    model.topPosts[0].thumbnailUrl = PNG;
    const pdf = await renderReportPdf(model);
    if (process.env.REPORT_PREVIEW) writeFileSync(`${process.env.REPORT_PREVIEW}/rapport-fr.pdf`, pdf);
    expect(pdf.subarray(0, 5).toString()).toBe("%PDF-");
    expect(pdf.length).toBeGreaterThan(20_000);
    const pages = (pdf.toString("latin1").match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(pages).toBe(1 + model.sections.length);
  });

  it("PDF EN sans images (repli) et PPTX + CSV", async () => {
    const model = await buildReportModel({ brandId: "b1", period: { type: "year", value: "2026" }, compare: false, sections: [], lang: "en" }, opts);
    const pdf = await renderReportPdf(model, { images: new Map() });
    expect(pdf.length).toBeGreaterThan(10_000);
    const pptx = await renderReportPptx(model, { images: new Map() });
    expect(pptx.subarray(0, 2).toString()).toBe("PK");
    expect(pptx.length).toBeGreaterThan(20_000);
    const csv = renderReportCsv(model);
    expect(csv.startsWith("﻿Date;Network;Account;Followers")).toBe(true);
    if (process.env.REPORT_PREVIEW) {
      writeFileSync(`${process.env.REPORT_PREVIEW}/rapport-en.pdf`, pdf);
      writeFileSync(`${process.env.REPORT_PREVIEW}/rapport-en.pptx`, pptx);
    }
  });

  it("images : data URI acceptée, format non pris en charge ignoré ; texte PDF nettoyé", async () => {
    expect((await loadImage(PNG))?.format).toBe("png");
    expect(await loadImage("data:image/webp;base64,AAAA")).toBeNull();
    expect(await loadImage("http://insecure.test/a.jpg")).toBeNull();
    expect(pdfSafe("Nouveau menu ☀️ du midi 🍽  −12 %")).toBe("Nouveau menu du midi −12 %");
  });
});
