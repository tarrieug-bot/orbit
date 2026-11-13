import type { Network } from "@/lib/db/types";
import { CHART_VARS, NETWORK_SERIES_VARS } from "@/styles/tokens";

/**
 * Couleurs des graphiques : variables CSS du design system (suivent le thème
 * clair / sombre, palette validée daltonisme). Ne pas mettre d'hex en dur.
 */
export const NETWORK_COLOR: Record<Network, string> = NETWORK_SERIES_VARS;

/** Types d'interactions, ordre fixe (hors couleurs réseaux 1–2). */
export const INTERACTION_COLORS = {
  likes: CHART_VARS[6],
  comments: CHART_VARS[2],
  shares: CHART_VARS[4],
  saves: CHART_VARS[3],
} as const;

/** Polarité gagnés / perdus. */
export const GAIN_COLOR = CHART_VARS[2];
export const LOSS_COLOR = CHART_VARS[7];

/** Genre (démographie). */
export const GENDER_COLOR = { female: CHART_VARS[4], male: CHART_VARS[6] } as const;

/** Couleur principale Orbit (séries uniques). */
export const ORBIT_COLOR = "var(--color-orbit-500)";
