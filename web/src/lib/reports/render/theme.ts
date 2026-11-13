import type { Network } from "@/lib/db/types";
import type { ReportModel } from "../model";

/**
 * Palette des rapports (miroir de web/src/styles/tokens.css, qui n'exporte pas de tokens TS).
 * Facebook #1877F2 ; Instagram dégradé #F58529 → #DD2A7B → #8134AF.
 */
export const THEME = {
  ink: "#0F172A",
  ink2: "#475569",
  ink3: "#94A3B8",
  line: "#E7E9F0",
  canvas: "#F5F6FA",
  surface: "#FFFFFF",
  surface2: "#F9FAFB",
  orbit: "#6366F1",
  orbitDark: "#1E1B4B",
  accent: "#8B5CF6",
  positive: "#16A34A",
  positiveSoft: "#DCFCE7",
  negative: "#DC2626",
  negativeSoft: "#FEE2E2",
  neutralSoft: "#EEF2F7",
  facebook: "#1877F2",
  instagram: "#DD2A7B",
  igGradient: ["#F58529", "#DD2A7B", "#8134AF"] as const,
  women: "#DD2A7B",
  men: "#1877F2",
  series: { likes: "#6366F1", comments: "#F58529", shares: "#0EA5E9", saves: "#8134AF" },
} as const;

export function networkColor(n: Network): string {
  return n === "fb" ? THEME.facebook : n === "ig" ? THEME.instagram : THEME.orbit;
}

/** Assombrit / éclaircit une couleur hexadécimale (amount ∈ [−1 ; 1]). */
export function shade(hex: string, amount: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  const ch = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) =>
    Math.round(amount < 0 ? c * (1 + amount) : c + (255 - c) * amount),
  );
  return `#${ch.map((c) => c.toString(16).padStart(2, "0")).join("")}`;
}

/** Libellé de pied de page commun. */
export function footerText(model: ReportModel): string {
  return `${model.brand.name} · ${model.period.title} · ${model.period.label}`;
}

/**
 * Caractères non couverts par la police embarquée (Inter latin) : émojis, idéogrammes…
 * remplacés pour éviter des carrés vides dans le PDF.
 */
export function pdfSafe(text: string): string {
  return Array.from(text)
    .filter((ch) => {
      const c = ch.codePointAt(0) ?? 0;
      return (
        c <= 0x024f || // latin + latin étendu
        (c >= 0x2000 && c <= 0x206f) || // ponctuation générale (espaces fines, guillemets, …)
        c === 0x20ac || c === 0x2122 || c === 0x2191 || c === 0x2193 || c === 0x2212 || c === 0x2215
      );
    })
    .join("")
    .replace(/[\u202f\u2009]/g, "\u00a0") // espaces fines (formats fr) → espace insécable
    .replace(/[ \t\r\n]{2,}/g, " ");
}

/** Valeur maximale « ronde » pour un axe. */
export function niceMax(v: number): number {
  if (v <= 0) return 1;
  const p = 10 ** Math.floor(Math.log10(v));
  const n = v / p;
  return (n <= 1 ? 1 : n <= 2 ? 2 : n <= 2.5 ? 2.5 : n <= 5 ? 5 : 10) * p;
}
