/**
 * Thème Recharts partagé d'Orbit. Toutes les couleurs sont des variables CSS :
 * elles suivent le thème clair / sombre sans re-rendu. Pour un rendu hors
 * navigateur (PDF), utiliser les hex de @/styles/tokens (chartPalette, colors).
 */
import { CHART_VARS, NETWORK_SERIES_VARS, SEQ_VARS } from "@/styles/tokens";

export { CHART_VARS, NETWORK_SERIES_VARS, SEQ_VARS };

/** Couleur de la série n (0-based), ordre fixe — ne jamais cycler. */
export function chartColor(index: number): string {
  return CHART_VARS[Math.min(index, CHART_VARS.length - 1)];
}

export const chartFont = { fontSize: 11, fontFamily: "var(--font-sans)" } as const;

/** Props communes XAxis / YAxis : discrets, sans trait ni graduation. */
export const axisProps = {
  stroke: "var(--color-ink-3)",
  tick: { fill: "var(--color-ink-3)", ...chartFont },
  tickLine: false,
  axisLine: false,
} as const;

/** Axe X avec ligne de base fine. */
export const xAxisProps = {
  ...axisProps,
  axisLine: { stroke: "var(--color-chart-axis)" },
  tickMargin: 8,
} as const;

/** Grille : lignes horizontales seules, très claires. */
export const gridProps = {
  vertical: false,
  stroke: "var(--color-chart-grid)",
  strokeDasharray: "0",
} as const;

/** Curseur d'infobulle. */
export const cursorLine = { stroke: "var(--color-line-strong)", strokeWidth: 1, strokeDasharray: "3 3" } as const;
export const cursorBar = { fill: "var(--color-surface-3)", opacity: 0.7 } as const;

/** Point actif sur courbe : anneau de surface pour se détacher. */
export const activeDot = { r: 4.5, strokeWidth: 2, stroke: "var(--color-surface)" } as const;

/** Marges standard. */
export const chartMargin = { top: 8, right: 8, bottom: 0, left: 0 } as const;

/** Barres : coins arrondis côté données, largeur maximale. */
export const barProps = { radius: [4, 4, 0, 0] as [number, number, number, number], maxBarSize: 28 } as const;
