import type { Network } from "@/lib/db/types";

/**
 * Couleurs des graphiques (validées daltonisme, voir skill dataviz).
 * Copie serveur-compatible des couleurs réseaux (NETWORK_META est exporté par un
 * module client et n'est pas lisible depuis un composant serveur).
 */
export const NETWORK_COLOR: Record<Network, string> = {
  ig: "#DD2A7B",
  fb: "#1877F2",
  tt: "#010101",
  li: "#0A66C2",
  yt: "#FF0000",
};

/** Types d'interactions, ordre fixe. */
export const INTERACTION_COLORS = {
  likes: "#4F46E5",
  comments: "#0EA5E9",
  shares: "#EC4899",
  saves: "#F59E0B",
} as const;

/** Polarité gagnés / perdus. */
export const GAIN_COLOR = "#10B981";
export const LOSS_COLOR = "#F43F5E";

/** Couleur principale Orbit (séries uniques). */
export const ORBIT_COLOR = "#6366F1";

/** Rampe séquentielle (heatmaps) : indigo clair → foncé. */
export const HEAT_STEPS = ["#EEF2FF", "#E0E7FF", "#C7D2FE", "#A5B4FC", "#818CF8", "#6366F1", "#4F46E5", "#3730A3"];

export function heatColor(v: number): string {
  return HEAT_STEPS[Math.min(HEAT_STEPS.length - 1, Math.max(0, Math.floor(v * HEAT_STEPS.length)))];
}
