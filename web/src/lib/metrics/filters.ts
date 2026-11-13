import type { ISODate, Network } from "@/lib/db/types";
import { LIVE_NETWORKS, NETWORKS } from "@/lib/db/types";
import { isISODate } from "./dates";
import { PERIOD_PRESETS, previousRange, resolvePeriod, type CompareMode, type PeriodPreset } from "./periods";
import type { DateRange } from "./types";

/**
 * Filtres globaux (barre supérieure), portés par l'URL :
 *   ?period=30d|…|custom|campaign &from=YYYY-MM-DD &to=YYYY-MM-DD
 *   &campaign=<uuid> &nets=ig,fb &compare=0|1|yoy
 */
export interface Filters {
  preset: PeriodPreset;
  range: DateRange;
  /** null si la comparaison est désactivée */
  previous: DateRange | null;
  compare: boolean;
  compareMode: CompareMode;
  networks: Network[];
  campaignId: string | null;
}

export type SearchParamsLike = Record<string, string | string[] | undefined> | URLSearchParams;

function read(sp: SearchParamsLike, key: string): string | undefined {
  if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined;
  const v = sp[key];
  return Array.isArray(v) ? v[0] : v;
}

export const DEFAULT_PRESET: PeriodPreset = "30d";

export function parseFilters(
  sp: SearchParamsLike,
  ctx: { today: ISODate; campaigns?: { id: string; starts_on: ISODate; ends_on: ISODate }[] },
): Filters {
  const rawPreset = read(sp, "period");
  const campaignId = read(sp, "campaign") ?? null;
  const campaign = campaignId ? ctx.campaigns?.find((c) => c.id === campaignId) ?? null : null;
  let preset: PeriodPreset = (PERIOD_PRESETS as readonly string[]).includes(rawPreset ?? "") ? (rawPreset as PeriodPreset) : DEFAULT_PRESET;
  if (rawPreset === "campaign" && campaign) preset = "campaign";
  const from = read(sp, "from");
  const to = read(sp, "to");
  const range = resolvePeriod(preset, {
    today: ctx.today,
    campaign,
    custom: { from: isISODate(from) ? from : undefined, to: isISODate(to) ? to : undefined },
  });
  const rawCompare = read(sp, "compare");
  const compare = rawCompare !== "0";
  const compareMode: CompareMode = rawCompare === "yoy" ? "yearAgo" : "previous";
  const nets = (read(sp, "nets") ?? "")
    .split(",")
    .filter((n): n is Network => (NETWORKS as readonly string[]).includes(n));
  return {
    preset,
    range,
    previous: compare ? previousRange(range, compareMode) : null,
    compare,
    compareMode,
    networks: nets.length ? nets : [...LIVE_NETWORKS],
    campaignId: preset === "campaign" ? campaignId : null,
  };
}

/** Sérialise des filtres (partiels) en query string, en omettant les valeurs par défaut. */
export function serializeFilters(f: Partial<Pick<Filters, "preset" | "range" | "compare" | "compareMode" | "networks" | "campaignId">>): string {
  const sp = new URLSearchParams();
  if (f.preset && f.preset !== DEFAULT_PRESET) sp.set("period", f.preset);
  if (f.preset === "custom" && f.range) {
    sp.set("from", f.range.from);
    sp.set("to", f.range.to);
  }
  if (f.preset === "campaign" && f.campaignId) sp.set("campaign", f.campaignId);
  if (f.networks && f.networks.join(",") !== LIVE_NETWORKS.join(",")) sp.set("nets", f.networks.join(","));
  if (f.compare === false) sp.set("compare", "0");
  else if (f.compareMode === "yearAgo") sp.set("compare", "yoy");
  return sp.toString();
}
