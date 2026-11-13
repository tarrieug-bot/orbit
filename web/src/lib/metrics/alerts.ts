import type { ISODate, Network } from "@/lib/db/types";
import { diffDays } from "./dates";
import type { MetricTotals } from "./types";

/** Points d'attention automatiques de la vue d'ensemble (SPEC §2). */
export type AlertKind = "followers_loss" | "engagement_drop" | "reach_spike" | "inactive";
export type AlertTone = "negative" | "positive" | "warning";

export interface Alert {
  kind: AlertKind;
  tone: AlertTone;
  brandId: string;
  accountId: string;
  network: Network;
  /** valeurs pour le message i18n `alerts.<kind>` */
  values: { net?: number; current?: number; previous?: number; ratio?: number; days?: number };
}

export const ALERT_THRESHOLDS = {
  /** baisse relative du taux d'engagement */
  engagementDrop: -0.15,
  /** hausse relative de la portée */
  reachSpike: 0.25,
  /** jours sans publication */
  inactiveDays: 7,
} as const;

export interface AlertInput {
  brandId: string;
  accountId: string;
  network: Network;
  current: MetricTotals;
  previous: MetricTotals | null;
  lastPostDate: ISODate | null;
  rangeEnd: ISODate;
}

export function detectAlerts(input: AlertInput): Alert[] {
  const { current: m, previous: p } = input;
  const base = { brandId: input.brandId, accountId: input.accountId, network: input.network };
  const out: Alert[] = [];
  if (m.available.followers && m.followersNet < 0) {
    out.push({ ...base, kind: "followers_loss", tone: "negative", values: { net: m.followersNet } });
  }
  if (p && p.engagementRate && (m.engagementRate - p.engagementRate) / p.engagementRate < ALERT_THRESHOLDS.engagementDrop) {
    out.push({ ...base, kind: "engagement_drop", tone: "negative", values: { current: m.engagementRate, previous: p.engagementRate } });
  }
  if (p && p.reach && (m.reach - p.reach) / p.reach > ALERT_THRESHOLDS.reachSpike) {
    out.push({ ...base, kind: "reach_spike", tone: "positive", values: { ratio: (m.reach - p.reach) / p.reach } });
  }
  if (input.lastPostDate) {
    const days = diffDays(input.lastPostDate, input.rangeEnd);
    if (days > ALERT_THRESHOLDS.inactiveDays) out.push({ ...base, kind: "inactive", tone: "warning", values: { days } });
  }
  return out;
}
