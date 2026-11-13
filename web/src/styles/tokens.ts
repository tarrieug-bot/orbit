/**
 * Orbit — tokens en TypeScript (miroir de tokens.css).
 * Pour Recharts côté client, préférer les variables CSS (CHART_VARS) qui suivent
 * le thème ; pour le rendu PDF / PPTX / e-mail (pas de CSS), utiliser les hex.
 * Propriétaire : agent design. Toute modification doit être reportée dans tokens.css.
 */
import type { Network } from "@/lib/db/types";

export type ThemeName = "light" | "dark";

export const fonts = {
  sans: '"Inter Variable", "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif',
  mono: 'ui-monospace, "SF Mono", "JetBrains Mono", monospace',
  /** chiffres tabulaires pour colonnes et axes */
  tabular: "tabular-nums",
} as const;

export const orbit = {
  50: "#f2f1fe",
  100: "#e6e3fd",
  200: "#cfc9fb",
  300: "#aea5f7",
  400: "#8a7ef1",
  500: "#6d5ce8",
  600: "#5944d9",
  700: "#4a36bb",
  800: "#3b2c94",
  900: "#221b58",
  accent: "#a24ee6",
} as const;

export const orbitGradient = { from: "#5944d9", via: "#7a47e3", to: "#a24ee6" } as const;

export interface ThemeColors {
  canvas: string;
  surface: string;
  surface2: string;
  surface3: string;
  line: string;
  lineStrong: string;
  ink: string;
  ink2: string;
  ink3: string;
  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  warning: string;
  warningSoft: string;
  info: string;
  infoSoft: string;
  chartGrid: string;
  chartAxis: string;
}

export const colors: Record<ThemeName, ThemeColors> = {
  light: {
    canvas: "#f6f5f2",
    surface: "#ffffff",
    surface2: "#faf9f7",
    surface3: "#f1efeb",
    line: "#e9e7e2",
    lineStrong: "#d8d5ce",
    ink: "#1a1917",
    ink2: "#5a5650",
    ink3: "#8c877f",
    positive: "#15803d",
    positiveSoft: "#e3f6e8",
    negative: "#c92a2a",
    negativeSoft: "#fde8e8",
    warning: "#a8560a",
    warningSoft: "#fdf1dc",
    info: "#2563eb",
    infoSoft: "#e3edfd",
    chartGrid: "#eceae5",
    chartAxis: "#c9c5bc",
  },
  dark: {
    canvas: "#0e0e0d",
    surface: "#171715",
    surface2: "#1c1c1a",
    surface3: "#242421",
    line: "#2a2926",
    lineStrong: "#3a3935",
    ink: "#f2f1ed",
    ink2: "#b5b2aa",
    ink3: "#85827a",
    positive: "#4ade80",
    positiveSoft: "#13301f",
    negative: "#f87171",
    negativeSoft: "#3a1616",
    warning: "#fbbf24",
    warningSoft: "#352710",
    info: "#60a5fa",
    infoSoft: "#14243f",
    chartGrid: "#262523",
    chartAxis: "#3a3935",
  },
};

export const sidebar = { bg: "#141311", bg2: "#1e1d1a", bg3: "#2a2925", ink: "#ebe9e4", mute: "#8f8b83" } as const;

/**
 * Palette catégorielle — validée daltonisme (protan/deutan/tritan, ΔE OKLab ≥ 8
 * entre voisins) dans les deux thèmes. Ordre FIXE : ne jamais cycler ni trier ;
 * au-delà de 8 séries, regrouper en « Autres ». Pour les nuages de points,
 * limiter à 3 séries. Jaune, aqua et magenta < 3:1 sur fond clair : étiquettes
 * visibles ou tableau requis.
 */
export const chartPalette: Record<ThemeName, readonly string[]> = {
  light: ["#2a78d6", "#eb6834", "#1baf7a", "#eda100", "#e87ba4", "#008300", "#6250d6", "#e34948"],
  dark: ["#3987e5", "#d95926", "#199e70", "#c98500", "#d55181", "#008300", "#9085e9", "#e66767"],
};

/** Variables CSS équivalentes (suivent le thème automatiquement). */
export const CHART_VARS = [1, 2, 3, 4, 5, 6, 7, 8].map((i) => `var(--color-chart-${i})`) as readonly string[];

/** Échelle séquentielle (heatmaps) : index 0 = « rien », 7 = maximum. */
export const sequential: Record<ThemeName, readonly string[]> = {
  light: ["#f1efeb", "#cde2fb", "#9ec5f4", "#6da7ec", "#3987e5", "#256abf", "#184f95", "#0d366b"],
  dark: ["#22221f", "#0d366b", "#104281", "#184f95", "#256abf", "#3987e5", "#6da7ec", "#b7d3f6"],
};
export const SEQ_VARS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => `var(--color-seq-${i})`) as readonly string[];

/** Couleurs officielles des réseaux (logos, pastilles). */
export const networkBrand = {
  fb: { primary: "#1877F2" },
  ig: { primary: "#D62976", gradient: ["#FEDA75", "#FA7E1E", "#D62976", "#962FBF", "#4F5BD5"] },
  tt: { primary: "#000000", accents: ["#25F4EE", "#FE2C55"] },
  li: { primary: "#0A66C2" },
  yt: { primary: "#FF0000" },
} as const satisfies Record<Network, { readonly primary: string; readonly gradient?: readonly string[]; readonly accents?: readonly string[] }>;

/**
 * Couleur d'un réseau en tant que SÉRIE de graphique (lisible, validée daltonisme),
 * distincte de la couleur de logo : Facebook = slot 1 (bleu), Instagram = slot 2
 * (orange), etc. Garder la même couleur pour un réseau d'un graphique à l'autre.
 */
export const networkSeries: Record<ThemeName, Record<Network, string>> = {
  light: { fb: "#2a78d6", ig: "#eb6834", tt: "#1baf7a", li: "#6250d6", yt: "#e34948" },
  dark: { fb: "#3987e5", ig: "#d95926", tt: "#199e70", li: "#9085e9", yt: "#e66767" },
};
export const NETWORK_SERIES_VARS: Record<Network, string> = {
  fb: "var(--color-chart-1)",
  ig: "var(--color-chart-2)",
  tt: "var(--color-chart-3)",
  li: "var(--color-chart-7)",
  yt: "var(--color-chart-8)",
};

export const radius = { xs: 6, control: 10, card: 16, hero: 24, pill: 9999 } as const;

export const shadows = {
  soft: "0 1px 2px rgb(26 25 23 / 0.05)",
  card: "0 1px 2px rgb(26 25 23 / 0.04), 0 2px 8px -2px rgb(26 25 23 / 0.06)",
  raised: "0 1px 2px rgb(26 25 23 / 0.05), 0 8px 24px -8px rgb(26 25 23 / 0.12)",
  pop: "0 16px 40px -12px rgb(26 25 23 / 0.22), 0 2px 6px rgb(26 25 23 / 0.06)",
} as const;

/** Échelle d'espacement (px) — identique à Tailwind (×4). */
export const space = { 1: 4, 2: 8, 3: 12, 4: 16, 5: 20, 6: 24, 8: 32, 10: 40, 12: 48, 16: 64 } as const;

export const fontSizes = { "2xs": 11, xs: 12, sm: 14, base: 16, lg: 18, xl: 20, "2xl": 24, display: 32 } as const;

/** Thème complet pour un rendu sans CSS (PDF, PPTX, e-mail). */
export function themeTokens(theme: ThemeName = "light") {
  return {
    colors: colors[theme],
    chart: chartPalette[theme],
    sequential: sequential[theme],
    networkSeries: networkSeries[theme],
    networkBrand,
    orbit,
    fonts,
    radius,
  };
}

/** Couleur d'une série catégorielle (index 0-based, ordre fixe). */
export function seriesColor(index: number, theme: ThemeName = "light"): string {
  const p = chartPalette[theme];
  return p[Math.min(index, p.length - 1)];
}
