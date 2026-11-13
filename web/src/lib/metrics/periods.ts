import type { ISODate } from "@/lib/db/types";
import { addDays, addMonths, diffDays, endOfMonth, isISODate, rangeLength, startOfMonth } from "./dates";
import type { DateRange } from "./types";

/** Préréglages du sélecteur de période (libellés : messages `period.presets.<clé>`). */
export const PERIOD_PRESETS = ["7d", "30d", "90d", "month", "lastmonth", "year", "lastyear", "custom"] as const;
export type PeriodPreset = (typeof PERIOD_PRESETS)[number] | "campaign";

export type CompareMode = "previous" | "yearAgo";

export interface ResolvePeriodOptions {
  /** aujourd'hui (fuseau agence) — les données s'arrêtent à la veille */
  today: ISODate;
  custom?: Partial<DateRange>;
  campaign?: { starts_on: ISODate; ends_on: ISODate } | null;
}

/**
 * Convertit un préréglage en période. Les métriques sont collectées pour J−1 :
 * les périodes glissantes se terminent donc hier.
 */
export function resolvePeriod(preset: PeriodPreset, opts: ResolvePeriodOptions): DateRange {
  const lastDay = addDays(opts.today, -1);
  const year = opts.today.slice(0, 4);
  const clampTo = (r: DateRange): DateRange => (r.to < r.from ? { from: r.from, to: r.from } : r);
  switch (preset) {
    case "7d":
      return { from: addDays(lastDay, -6), to: lastDay };
    case "30d":
      return { from: addDays(lastDay, -29), to: lastDay };
    case "90d":
      return { from: addDays(lastDay, -89), to: lastDay };
    case "month":
      return clampTo({ from: startOfMonth(opts.today), to: lastDay });
    case "lastmonth": {
      const from = startOfMonth(addMonths(startOfMonth(opts.today), -1));
      return { from, to: endOfMonth(from) };
    }
    case "year":
      return clampTo({ from: `${year}-01-01`, to: lastDay });
    case "lastyear": {
      const y = String(Number(year) - 1);
      return { from: `${y}-01-01`, to: `${y}-12-31` };
    }
    case "campaign":
      if (opts.campaign) return { from: opts.campaign.starts_on, to: opts.campaign.ends_on };
      return resolvePeriod("30d", opts);
    case "custom": {
      let from = isISODate(opts.custom?.from) ? opts.custom.from : addDays(lastDay, -29);
      let to = isISODate(opts.custom?.to) ? opts.custom.to : lastDay;
      if (to < from) [from, to] = [to, from];
      return { from, to };
    }
  }
}

/**
 * Période de comparaison (SPEC §5) : même durée immédiatement précédente,
 * ou même période un an plus tôt.
 */
export function previousRange(r: DateRange, mode: CompareMode = "previous"): DateRange {
  if (mode === "yearAgo") {
    return { from: addMonths(r.from, -12), to: addMonths(r.to, -12) };
  }
  const len = rangeLength(r);
  return { from: addDays(r.from, -len), to: addDays(r.from, -1) };
}

/** Période englobant la période courante et sa comparaison (pour une seule requête). */
export function spanWithPrevious(r: DateRange, prev: DateRange | null): DateRange {
  if (!prev) return r;
  return { from: prev.from < r.from ? prev.from : r.from, to: r.to > prev.to ? r.to : prev.to };
}

export function isSingleDay(r: DateRange): boolean {
  return diffDays(r.from, r.to) === 0;
}
