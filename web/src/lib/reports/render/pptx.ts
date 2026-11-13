import "server-only";
import PptxGenJS from "pptxgenjs";
import type { ReportKpi, ReportModel, ReportSectionKey } from "../model";
import { loadReportImages, type ImageMap } from "./images";
import { footerText, networkColor, shade, THEME } from "./theme";

/**
 * Rendu PowerPoint (16:9) d'un ReportModel avec pptxgenjs : graphiques natifs (modifiables),
 * tuiles KPI, top publications avec miniatures, analyses en texte riche.
 */

const c = (hex: string) => hex.replace("#", "").toUpperCase();
const FONT = "Inter";
const SW = 13.333;
const SH = 7.5;
const M = 0.5;

type Slide = ReturnType<PptxGenJS["addSlide"]>;

function avatar(slide: Slide, images: ImageMap, src: string | null, name: string, color: string, x: number, y: number, d: number) {
  const img = src ? images.get(src) : undefined;
  if (img) {
    slide.addImage({ data: img.dataUri, x, y, w: d, h: d, rounding: true });
    return;
  }
  slide.addShape("ellipse", { x, y, w: d, h: d, fill: { color: c(color) }, line: { color: "FFFFFF", width: 2 } });
  const initials = name.split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]!.toUpperCase()).join("");
  slide.addText(initials, { x, y, w: d, h: d, align: "center", valign: "middle", fontFace: FONT, bold: true, color: "FFFFFF", fontSize: Math.round(d * 26) });
}

function header(slide: Slide, model: ReportModel, section: ReportSectionKey, images: ImageMap) {
  slide.addShape("rect", { x: M, y: 0.45, w: 0.07, h: 0.62, fill: { color: c(model.brand.color) }, line: { color: c(model.brand.color) } });
  slide.addText(model.labels.sections[section], { x: M + 0.2, y: 0.35, w: 8.5, h: 0.5, fontFace: FONT, fontSize: 24, bold: true, color: c(THEME.ink) });
  slide.addText(model.labels.sectionIntros[section], { x: M + 0.2, y: 0.82, w: 8.5, h: 0.3, fontFace: FONT, fontSize: 11, color: c(THEME.ink2) });
  slide.addText(
    [
      { text: model.brand.name, options: { bold: true, color: c(THEME.ink), fontSize: 11, breakLine: true } },
      { text: model.period.label, options: { color: c(THEME.ink3), fontSize: 9 } },
    ],
    { x: SW - M - 4.1, y: 0.42, w: 3.4, h: 0.6, align: "right", fontFace: FONT },
  );
  avatar(slide, images, model.brand.avatarUrl, model.brand.name, model.brand.color, SW - M - 0.6, 0.42, 0.6);
}

function kpiTile(slide: Slide, k: ReportKpi, x: number, y: number, w: number, accent: string) {
  const h = 1.25;
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.08, fill: { color: "FFFFFF" }, line: { color: c(THEME.line), width: 0.75 }, shadow: { type: "outer", blur: 6, offset: 1, angle: 90, color: "000000", opacity: 0.08 } });
  slide.addShape("rect", { x: x + 0.12, y, w: w - 0.24, h: 0.05, fill: { color: c(accent) }, line: { color: c(accent) } });
  slide.addText(k.label.toUpperCase(), { x: x + 0.15, y: y + 0.12, w: w - 0.3, h: 0.28, fontFace: FONT, fontSize: 8.5, color: c(THEME.ink2), charSpacing: 0.5 });
  slide.addText(k.display, { x: x + 0.15, y: y + 0.38, w: w - 0.3, h: 0.5, fontFace: FONT, fontSize: 22, bold: true, color: c(k.available ? THEME.ink : THEME.ink3) });
  if (k.delta) {
    const good = k.delta.positive;
    const fg = good === true ? THEME.positive : good === false ? THEME.negative : THEME.ink2;
    const bg = good === true ? THEME.positiveSoft : good === false ? THEME.negativeSoft : THEME.neutralSoft;
    const arrow = k.delta.trend === "up" ? "▲ " : k.delta.trend === "down" ? "▼ " : "";
    slide.addText(arrow + k.delta.display, { x: x + 0.15, y: y + 0.88, w: Math.min(w - 0.3, 1.35), h: 0.26, fontFace: FONT, fontSize: 8.5, bold: true, color: c(fg), fill: { color: c(bg) }, align: "center", rectRadius: 0.06, shape: "roundRect" });
  }
}

function card(slide: Slide, x: number, y: number, w: number, h: number, title?: string) {
  slide.addShape("roundRect", { x, y, w, h, rectRadius: 0.08, fill: { color: "FFFFFF" }, line: { color: c(THEME.line), width: 0.75 } });
  if (title) slide.addText(title, { x: x + 0.2, y: y + 0.1, w: w - 0.4, h: 0.32, fontFace: FONT, fontSize: 12, bold: true, color: c(THEME.ink) });
}

const axis = { catAxisLabelFontFace: FONT, valAxisLabelFontFace: FONT, catAxisLabelFontSize: 8, valAxisLabelFontSize: 8, catAxisLabelColor: c(THEME.ink3), valAxisLabelColor: c(THEME.ink3), valGridLine: { color: c(THEME.line), size: 0.5 }, catGridLine: { style: "none" as const }, legendFontFace: FONT, legendFontSize: 9 };

export async function renderReportPptx(model: ReportModel, opts: { images?: ImageMap } = {}): Promise<Buffer> {
  const images = opts.images ?? (await loadReportImages(model));
  const pptx = new PptxGenJS();
  pptx.layout = "LAYOUT_WIDE";
  pptx.title = `${model.brand.name} — ${model.period.title} · ${model.period.label}`;
  pptx.company = model.agency.name ?? "Orbit";
  pptx.author = model.agency.name ?? "Orbit";
  pptx.theme = { headFontFace: FONT, bodyFontFace: FONT };
  pptx.defineSlideMaster({
    title: "ORBIT",
    background: { color: c(THEME.canvas) },
    objects: [
      { line: { x: M, y: SH - 0.45, w: SW - 2 * M, h: 0, line: { color: c(THEME.line), width: 0.75 } } },
      { text: { text: footerText(model), options: { x: M, y: SH - 0.42, w: 7, h: 0.3, fontFace: FONT, fontSize: 8, color: c(THEME.ink3) } } },
      { text: { text: model.agency.name ?? model.labels.confidential, options: { x: SW / 2 - 2, y: SH - 0.42, w: 4, h: 0.3, align: "center", fontFace: FONT, fontSize: 8, color: c(THEME.ink3) } } },
    ],
    slideNumber: { x: SW - M - 0.8, y: SH - 0.42, w: 0.8, h: 0.3, fontFace: FONT, fontSize: 8, color: c(THEME.ink3), align: "right" },
  });

  // --- Couverture -------------------------------------------------------------
  const cover = pptx.addSlide();
  cover.background = { color: c(THEME.orbitDark) };
  cover.addShape("rect", { x: SW * 0.45, y: 0, w: SW * 0.55, h: SH, fill: { color: c(shade(model.brand.color, -0.3)), transparency: 10 }, line: { color: c(shade(model.brand.color, -0.3)) } });
  cover.addShape("ellipse", { x: SW * 0.62, y: SH * 0.35, w: 7, h: 7, fill: { color: c(model.brand.color), transparency: 55 }, line: { color: c(model.brand.color), transparency: 100 } });
  cover.addShape("rect", { x: M, y: SH - 0.25, w: 1.7, h: 0.07, fill: { color: c(THEME.facebook) }, line: { color: c(THEME.facebook) } });
  THEME.igGradient.forEach((col, i) => cover.addShape("rect", { x: M + 1.8 + i * 0.58, y: SH - 0.25, w: 0.58, h: 0.07, fill: { color: c(col) }, line: { color: c(col) } }));
  const logo = model.agency.logoUrl ? images.get(model.agency.logoUrl) : undefined;
  if (logo) cover.addImage({ data: logo.dataUri, x: SW - M - 2.2, y: M, w: 2.2, h: 0.75, sizing: { type: "contain", w: 2.2, h: 0.75 } });
  else {
    cover.addShape("roundRect", { x: SW - M - 2.2, y: M, w: 2.2, h: 0.75, rectRadius: 0.1, fill: { color: "FFFFFF", transparency: 100 }, line: { color: "FFFFFF", width: 1, dashType: "dash", transparency: 40 } });
    cover.addText(model.labels.agencyLogo.toUpperCase(), { x: SW - M - 2.2, y: M, w: 2.2, h: 0.75, align: "center", valign: "middle", fontFace: FONT, fontSize: 8, color: "FFFFFF", transparency: 30 });
  }
  cover.addShape("ellipse", { x: M + 0.15, y: 2.05, w: 2.1, h: 2.1, fill: { color: "FFFFFF" }, line: { color: "FFFFFF" } });
  avatar(cover, images, model.brand.avatarUrl, model.brand.name, model.brand.color, M + 0.22, 2.12, 1.96);
  cover.addText(model.labels.title.toUpperCase(), { x: M + 2.6, y: 1.95, w: 9, h: 0.4, fontFace: FONT, fontSize: 12, color: "FFFFFF", charSpacing: 1, transparency: 20 });
  cover.addText(model.brand.name, { x: M + 2.6, y: 2.35, w: 9.5, h: 0.9, fontFace: FONT, fontSize: 44, bold: true, color: "FFFFFF" });
  cover.addText(model.period.label, { x: M + 2.6, y: 3.25, w: 9, h: 0.5, fontFace: FONT, fontSize: 22, color: "FFFFFF" });
  cover.addText([model.labels.subtitle, model.labels.periodLine, model.labels.comparisonLine].filter(Boolean).join("   ·   "), { x: M + 2.6, y: 3.8, w: 9.5, h: 0.35, fontFace: FONT, fontSize: 11, color: "FFFFFF", transparency: 25 });
  model.accounts.forEach((a, i) => {
    const x = M + 0.2 + i * 3.1;
    const y = SH - 1.35;
    cover.addShape("roundRect", { x, y, w: 2.95, h: 0.62, rectRadius: 0.31, fill: { color: "FFFFFF" }, line: { color: "FFFFFF" } });
    avatar(cover, images, a.avatarUrl, a.name ?? a.handle ?? "?", networkColor(a.network), x + 0.08, y + 0.08, 0.46);
    cover.addShape("ellipse", { x: x + 0.4, y: y + 0.38, w: 0.18, h: 0.18, fill: { color: c(networkColor(a.network)) }, line: { color: "FFFFFF", width: 1 } });
    cover.addText(
      [
        { text: a.handle ?? a.name ?? "", options: { bold: true, fontSize: 10, color: c(THEME.ink), breakLine: true } },
        { text: `${a.networkLabel} · ${a.followersDisplay}`, options: { fontSize: 8, color: c(THEME.ink2) } },
      ],
      { x: x + 0.62, y: y + 0.04, w: 2.25, h: 0.54, fontFace: FONT, valign: "middle" },
    );
  });
  cover.addText(model.labels.generatedOn, { x: SW - M - 4, y: SH - 0.6, w: 4, h: 0.3, align: "right", fontFace: FONT, fontSize: 9, color: "FFFFFF", transparency: 30 });

  const pts = model.series.points;
  const labels = pts.map((p) => p.label);

  for (const sec of model.sections) {
    const slide = pptx.addSlide({ masterName: "ORBIT" });
    header(slide, model, sec, images);
    const top = 1.35;
    if (sec === "summary") {
      const w = (SW - 2 * M - 4 * 0.2) / 5;
      model.kpis.forEach((k, i) => kpiTile(slide, k, M + (i % 5) * (w + 0.2), top + Math.floor(i / 5) * 1.4, w, model.brand.color));
      const rows = model.byNetwork.map((n) => [
        { text: n.label, options: { bold: true, color: c(networkColor(n.network)) } },
        ...["followers", "reach", "views", "interactions", "engagementRate", "posts"].map((key) => {
          const k = n.kpis.find((x) => x.key === key)!;
          return { text: k.delta ? `${k.display}  (${k.delta.display})` : k.display };
        }),
      ]);
      if (rows.length) {
        const head = [model.labels.table.network, ...["followers", "reach", "views", "interactions", "engagementRate", "posts"].map((key) => model.kpis.find((x) => x.key === key)!.label)].map((t) => ({ text: t, options: { bold: true, color: c(THEME.ink2), fill: { color: c(THEME.surface2) } } }));
        slide.addTable([head, ...rows], { x: M, y: top + 3.0, w: SW - 2 * M, fontFace: FONT, fontSize: 10, color: c(THEME.ink), border: { type: "solid", color: c(THEME.line), pt: 0.75 }, rowH: 0.38, fill: { color: "FFFFFF" } });
      }
    } else if (sec === "audience") {
      const a = model.audience;
      if (!a) slide.addText(model.labels.noAudience, { x: M, y: top, w: SW - 2 * M, h: 0.5, fontFace: FONT, fontSize: 12, color: c(THEME.ink3) });
      else {
        card(slide, M, top, 7.2, 5.3, `${model.labels.ageGender} — ${model.labels.women} ${a.genders.female} · ${model.labels.men} ${a.genders.male}`);
        slide.addChart(
          "bar",
          [
            { name: model.labels.women, labels: a.ageGender.map((r) => r.age), values: a.ageGender.map((r) => Math.round(r.female * 1000) / 10) },
            { name: model.labels.men, labels: a.ageGender.map((r) => r.age), values: a.ageGender.map((r) => Math.round(r.male * 1000) / 10) },
          ],
          { x: M + 0.1, y: top + 0.5, w: 7, h: 4.7, barDir: "bar", chartColors: [c(THEME.women), c(THEME.men)], showLegend: true, legendPos: "b", ...axis, valAxisLabelFormatCode: '0"%"', barGapWidthPct: 40 },
        );
        const list = (title: string, rows: { label: string; display: string; share: number }[], y: number, color: string) => {
          card(slide, M + 7.4, y, SW - 2 * M - 7.4, 2.55, title);
          rows.slice(0, 5).forEach((r, i) => {
            const yy = y + 0.55 + i * 0.38;
            slide.addText(r.label, { x: M + 7.6, y: yy, w: 2.6, h: 0.3, fontFace: FONT, fontSize: 9.5, color: c(THEME.ink2) });
            const bw = 1.6 * (r.share / (rows[0]?.share || 1));
            slide.addShape("roundRect", { x: M + 10.25, y: yy + 0.09, w: Math.max(0.05, bw), h: 0.12, rectRadius: 0.06, fill: { color: c(color) }, line: { color: c(color) } });
            slide.addText(r.display, { x: SW - M - 0.85, y: yy, w: 0.75, h: 0.3, align: "right", fontFace: FONT, fontSize: 9.5, bold: true, color: c(THEME.ink) });
          });
        };
        list(model.labels.cities, a.cities, top, THEME.instagram);
        list(model.labels.countries, a.countries, top + 2.75, THEME.accent);
      }
    } else if (sec === "reach") {
      const w = (SW - 2 * M - 3 * 0.2) / 4;
      ["reach", "views", "profileVisits", "linkClicks"].forEach((key, i) => kpiTile(slide, model.kpis.find((k) => k.key === key)!, M + i * (w + 0.2), top, w, model.brand.color));
      card(slide, M, top + 1.45, 7.4, 3.9);
      slide.addChart(
        "line",
        [
          { name: model.labels.metrics.reach, labels, values: pts.map((p) => p.reach ?? 0) },
          { name: model.labels.metrics.views, labels, values: pts.map((p) => p.views ?? 0) },
        ],
        { x: M + 0.1, y: top + 1.55, w: 7.2, h: 3.7, chartColors: [c(model.brand.color), c(THEME.accent)], lineSize: 2, lineDataSymbol: "none", showLegend: true, legendPos: "t", ...axis },
      );
      card(slide, M + 7.6, top + 1.45, SW - 2 * M - 7.6, 3.9, model.labels.followersEvolution);
      const fv = pts.map((p) => p.followers ?? 0);
      slide.addChart("area", [{ name: model.labels.metrics.followers, labels, values: fv }], {
        x: M + 7.7, y: top + 1.95, w: SW - 2 * M - 7.8, h: 3.3, chartColors: [c(THEME.positive)], chartColorsOpacity: 35, showLegend: false, ...axis,
        valAxisMinVal: Math.max(0, Math.floor(Math.min(...fv.filter((v) => v > 0), 0) * 0.98)),
      });
    } else if (sec === "engagement") {
      const w = (SW - 2 * M - 3 * 0.2) / 4;
      ["interactions", "engagementRate", "posts", "followersGained"].forEach((key, i) => kpiTile(slide, model.kpis.find((k) => k.key === key)!, M + i * (w + 0.2), top, w, model.brand.color));
      card(slide, M, top + 1.45, SW - 2 * M, 3.9);
      slide.addChart(
        "bar",
        (["likes", "comments", "shares", "saves"] as const).map((key) => ({ name: model.labels.metrics[key], labels, values: pts.map((p) => p[key] ?? 0) })),
        { x: M + 0.1, y: top + 1.55, w: SW - 2 * M - 0.2, h: 3.7, barGrouping: "stacked", chartColors: [THEME.series.likes, THEME.series.comments, THEME.series.shares, THEME.series.saves].map(c), showLegend: true, legendPos: "t", barGapWidthPct: 35, ...axis },
      );
    } else if (sec === "formats") {
      if (!model.formats.length) slide.addText(model.labels.noPosts, { x: M, y: top, w: 8, h: 0.5, fontFace: FONT, fontSize: 12, color: c(THEME.ink3) });
      else {
        const L = model.labels.table;
        const head = [L.format, L.posts, L.avgReach, L.avgInteractions, L.engagementRate].map((t) => ({ text: t, options: { bold: true, color: c(THEME.ink2), fill: { color: c(THEME.surface2) } } }));
        const rows = model.formats.slice(0, 10).map((r) => [
          { text: [{ text: "● ", options: { color: c(networkColor(r.network)) } }, { text: `${r.formatLabel} · ${r.networkLabel}`, options: { bold: true } }] },
          { text: r.display.posts, options: { align: "right" as const } },
          { text: r.display.avgReach, options: { align: "right" as const } },
          { text: r.display.avgInteractions, options: { align: "right" as const } },
          { text: r.display.engagementRate, options: { align: "right" as const, bold: true } },
        ]);
        slide.addTable([head, ...rows], { x: M, y: top, w: 8.2, colW: [3.2, 1.1, 1.3, 1.3, 1.3], fontFace: FONT, fontSize: 10.5, color: c(THEME.ink), border: { type: "solid", color: c(THEME.line), pt: 0.75 }, rowH: 0.42, fill: { color: "FFFFFF" } });
        card(slide, M + 8.4, top, SW - 2 * M - 8.4, 5.3, L.engagementRate);
        slide.addChart(
          "bar",
          [{ name: L.engagementRate, labels: model.formats.slice(0, 8).map((r) => `${r.formatLabel} ${r.networkLabel}`), values: model.formats.slice(0, 8).map((r) => Math.round(r.engagementRate * 10000) / 100) }],
          { x: M + 8.5, y: top + 0.5, w: SW - 2 * M - 8.6, h: 4.7, barDir: "bar", chartColors: model.formats.slice(0, 8).map((r) => c(networkColor(r.network))), showValue: true, dataLabelFormatCode: '0.00"%"', dataLabelFontSize: 8, showLegend: false, ...axis, valAxisHidden: true },
        );
      }
    } else if (sec === "top") {
      if (!model.topPosts.length) slide.addText(model.labels.noPosts, { x: M, y: top, w: 8, h: 0.5, fontFace: FONT, fontSize: 12, color: c(THEME.ink3) });
      const cw = (SW - 2 * M - 2 * 0.25) / 3;
      model.topPosts.slice(0, 6).forEach((p, i) => {
        const x = M + (i % 3) * (cw + 0.25);
        const y = top + Math.floor(i / 3) * 2.75;
        card(slide, x, y, cw, 2.55);
        const img = p.thumbnailUrl ? images.get(p.thumbnailUrl) : undefined;
        if (img) slide.addImage({ data: img.dataUri, x: x + 0.12, y: y + 0.12, w: 1.5, h: 2.31, sizing: { type: "cover", w: 1.5, h: 2.31 } });
        else {
          slide.addShape("roundRect", { x: x + 0.12, y: y + 0.12, w: 1.5, h: 2.31, rectRadius: 0.06, fill: { color: c(shade(networkColor(p.network), 0.75)) }, line: { color: c(shade(networkColor(p.network), 0.75)) } });
          slide.addText(p.formatLabel, { x: x + 0.12, y: y + 0.12, w: 1.5, h: 2.31, align: "center", valign: "middle", fontFace: FONT, fontSize: 11, bold: true, color: c(networkColor(p.network)) });
        }
        slide.addText(`#${i + 1}`, { x: x + 0.2, y: y + 0.2, w: 0.45, h: 0.26, fontFace: FONT, fontSize: 9, bold: true, color: "FFFFFF", fill: { color: c(THEME.ink) }, align: "center", shape: "roundRect", rectRadius: 0.1 });
        slide.addText(`${p.networkLabel} · ${p.formatLabel} · ${p.dateLabel}`, { x: x + 1.72, y: y + 0.12, w: cw - 1.84, h: 0.28, fontFace: FONT, fontSize: 8, color: c(networkColor(p.network)), bold: true });
        slide.addText(p.caption.slice(0, 160), { x: x + 1.72, y: y + 0.42, w: cw - 1.84, h: 1.1, fontFace: FONT, fontSize: 9, color: c(THEME.ink), valign: "top", fit: "shrink" });
        const L = model.labels.table;
        slide.addText(
          [
            { text: `${L.reach}  `, options: { color: c(THEME.ink3) } },
            { text: p.display.reach, options: { bold: true, breakLine: true } },
            { text: `${L.interactions}  `, options: { color: c(THEME.ink3) } },
            { text: p.display.interactions, options: { bold: true, breakLine: true } },
            { text: `${L.engagementRate}  `, options: { color: c(THEME.ink3) } },
            { text: p.display.engagementRate, options: { bold: true } },
          ],
          { x: x + 1.72, y: y + 1.45, w: cw - 1.84, h: 0.75, fontFace: FONT, fontSize: 9, color: c(THEME.ink), valign: "bottom" },
        );
        if (p.permalink) {
          slide.addText(p.permalink.replace(/^https?:\/\/(www\.)?/, "").slice(0, 40), { x: x + 1.72, y: y + 2.2, w: cw - 1.84, h: 0.24, fontFace: FONT, fontSize: 7, color: c(THEME.orbit), hyperlink: { url: p.permalink } });
        }
      });
    } else if (sec === "insights") {
      card(slide, M, top, SW - 2 * M, 5.35);
      const runs = model.insights.flatMap((ins, i) => [
        { text: `${i + 1}.  `, options: { bold: true, color: c(model.brand.color) } },
        ...ins.segments.map((sg, k) => ({ text: sg.text, options: { bold: sg.bold, color: c(sg.bold ? THEME.ink : THEME.ink2), ...(k === ins.segments.length - 1 ? { breakLine: true } : {}) } })),
        ...(i < model.insights.length - 1 ? [{ text: " ", options: { fontSize: 6, breakLine: true } }] : []),
      ]);
      slide.addText(runs, { x: M + 0.3, y: top + 0.2, w: SW - 2 * M - 0.6, h: 4.95, fontFace: FONT, fontSize: 13, valign: "top", paraSpaceAfter: 4, fit: "shrink" });
    }
  }

  const out = await pptx.write({ outputType: "nodebuffer" });
  return Buffer.isBuffer(out) ? out : Buffer.from(out as ArrayBuffer);
}
