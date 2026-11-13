import type { ReportModel } from "../model";

/**
 * Pré-chargement des images du rapport (photo de la marque, des comptes, miniatures) :
 * les URL CDN Meta sont signées et expirent — on les télécharge au moment du rendu,
 * avec délai court ; toute image en échec est simplement remplacée par un visuel de repli.
 */
export interface LoadedImage {
  /** data URI (image/png ou image/jpeg) */
  dataUri: string;
  format: "png" | "jpg";
  data: Buffer;
}

export type ImageMap = Map<string, LoadedImage>;

const MAX_BYTES = 3 * 1024 * 1024;

function sniff(buf: Buffer): "png" | "jpg" | null {
  if (buf.length > 8 && buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return "png";
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return "jpg";
  return null; // webp, gif… non pris en charge par le moteur PDF
}

export async function loadImage(url: string, opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<LoadedImage | null> {
  if (url.startsWith("data:")) {
    const m = /^data:image\/(png|jpe?g);base64,(.+)$/.exec(url);
    if (!m) return null;
    const data = Buffer.from(m[2], "base64");
    const format = m[1] === "png" ? "png" : "jpg";
    return { dataUri: url, format, data };
  }
  if (!/^https:\/\//.test(url)) return null;
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), opts.timeoutMs ?? 4000);
  try {
    const res = await (opts.fetchImpl ?? fetch)(url, { signal: ctrl.signal });
    if (!res.ok) return null;
    const data = Buffer.from(await res.arrayBuffer());
    if (data.length > MAX_BYTES) return null;
    const format = sniff(data);
    if (!format) return null;
    return { dataUri: `data:image/${format === "png" ? "png" : "jpeg"};base64,${data.toString("base64")}`, format, data };
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

/** Toutes les images utiles au rendu, en parallèle (8 à la fois). */
export async function loadReportImages(model: ReportModel, opts: { timeoutMs?: number; fetchImpl?: typeof fetch } = {}): Promise<ImageMap> {
  const urls = [
    model.brand.avatarUrl,
    model.agency.logoUrl,
    ...model.accounts.map((a) => a.avatarUrl),
    ...(model.sections.includes("top") ? model.topPosts.map((p) => p.thumbnailUrl) : []),
  ].filter((u): u is string => !!u);
  const unique = [...new Set(urls)];
  const out: ImageMap = new Map();
  for (let i = 0; i < unique.length; i += 8) {
    const chunk = unique.slice(i, i + 8);
    const res = await Promise.all(chunk.map((u) => loadImage(u, opts)));
    chunk.forEach((u, k) => {
      const r = res[k];
      if (r) out.set(u, r);
    });
  }
  return out;
}
