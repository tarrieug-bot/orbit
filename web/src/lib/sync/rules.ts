import type { AccountDailyMetricsRow, ISODate } from "@/lib/db/types";
import type { DailyColumn } from "@/lib/meta/metric-map";
import type { DailyValues } from "@/lib/meta/types";
import type { DateRange } from "@/lib/metrics/types";

/**
 * Règles PURES de la collecte (testées) : plages de dates, snapshots J+1/J+7/J+28,
 * reconstruction des abonnés, fusion des lignes quotidiennes.
 */

const DAY_MS = 86_400_000;
export const AGENCY_TZ = "America/Martinique";

export const RECENT_DAYS = 3; // Meta corrige les chiffres récents : on recharge les 3 derniers jours
export const POSTS_WINDOW_DAYS = 30;
export const FIRST_FILL_DAYS = 90;
export const BACKFILL_CHUNK_DAYS = 90;
export const BACKFILL_MAX_DAYS = 730; // ~2 ans
export const AUDIENCE_EVERY_DAYS = 7;

export function addDays(date: ISODate, n: number): ISODate {
  return new Date(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS).toISOString().slice(0, 10);
}

/** Date (fuseau agence) d'un horodatage. */
export function localDate(ts: string | Date, timeZone = AGENCY_TZ): ISODate {
  return new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(ts));
}

/** Plage de la collecte quotidienne : 3 derniers jours, ou 90 jours au premier passage. */
export function dailyRange(today: ISODate, firstPass: boolean): DateRange {
  return { from: addDays(today, firstPass ? -FIRST_FILL_DAYS : -RECENT_DAYS), to: addDays(today, -1) };
}

/** Tranche suivante du backfill (avant `cursor`), ou null si terminé (2 ans atteints). */
export function nextBackfillChunk(today: ISODate, cursor: ISODate | null): DateRange | null {
  const limit = addDays(today, -BACKFILL_MAX_DAYS);
  const start = cursor ?? today;
  if (start <= limit) return null;
  const to = addDays(start, -1);
  const from = addDays(start, -BACKFILL_CHUNK_DAYS);
  return { from: from < limit ? limit : from, to };
}

export type SnapshotDay = 1 | 7 | 28;
const SNAPSHOTS: SnapshotDay[] = [1, 7, 28];

/**
 * Snapshot à écrire pour une publication. Un snapshot k est « définitif » une fois capturé
 * à ≥ J+k ; avant, il est provisoire et réécrit à chaque synchro. On ne fabrique jamais un
 * snapshot dont la fenêtre est passée sans capture (publication découverte tardivement).
 */
export function chooseSnapshotDay(
  publishedAt: string,
  now: Date,
  existing: { snapshot_day: number; captured_at: string }[],
): SnapshotDay | null {
  const pub = Date.parse(publishedAt);
  const age = (now.getTime() - pub) / DAY_MS;
  for (let i = 0; i < SNAPSHOTS.length; i++) {
    const k = SNAPSHOTS[i];
    const next = SNAPSHOTS[i + 1] ?? Infinity;
    const ex = existing.find((e) => e.snapshot_day === k);
    if (ex && (Date.parse(ex.captured_at) - pub) / DAY_MS >= k) continue; // définitif
    if (!ex && age >= next) continue; // fenêtre manquée
    return k;
  }
  return null;
}

/**
 * Abonnés quotidiens à partir d'un total connu (`anchor` = abonnés en fin de `anchorDate`)
 * et des gains / pertes : abonnés(j) = abonnés(j+1) − (gagnés(j+1) − perdus(j+1)).
 * Ne remplace que les valeurs absentes. `rows` : un élément par date, dans n'importe quel ordre.
 */
export function reconstructFollowers(
  rows: { date: ISODate; followers?: number | null; gained?: number | null; lost?: number | null }[],
  anchor: { date: ISODate; followers: number; gained?: number | null; lost?: number | null } | null,
): Map<ISODate, number> {
  const out = new Map<ISODate, number>();
  const byDate = new Map(rows.map((r) => [r.date, r]));
  let cur: { date: ISODate; followers: number; gained: number; lost: number } | null = null;
  if (anchor) {
    const r = byDate.get(anchor.date);
    cur = { date: anchor.date, followers: r?.followers ?? anchor.followers, gained: r?.gained ?? anchor.gained ?? 0, lost: r?.lost ?? anchor.lost ?? 0 };
    if (r) out.set(anchor.date, cur.followers);
  }
  const sorted = [...rows].filter((r) => !anchor || r.date < anchor.date).sort((a, b) => (a.date < b.date ? 1 : -1));
  for (const r of sorted) {
    let f: number | null = r.followers ?? null;
    if (f == null && cur && addDays(r.date, 1) === cur.date) f = Math.max(0, cur.followers - (cur.gained - cur.lost));
    if (f == null) {
      cur = null;
      continue;
    }
    out.set(r.date, f);
    cur = { date: r.date, followers: f, gained: r.gained ?? 0, lost: r.lost ?? 0 };
  }
  return out;
}

export const METRIC_COLUMNS: DailyColumn[] = [
  "followers",
  "followers_gained",
  "followers_lost",
  "reach",
  "views",
  "interactions",
  "likes",
  "comments",
  "shares",
  "saves",
  "profile_visits",
  "link_clicks",
  "posts_count",
  "video_views",
];

export type DailyUpsert = Omit<AccountDailyMetricsRow, "raw" | "updated_at">;

/**
 * Fusionne les lignes existantes, les valeurs fraîches de Meta et les agrégats des publications.
 * Une valeur fraîche remplace l'existante ; une métrique absente aujourd'hui (erreur passagère)
 * ne remet PAS l'existant à NULL. Idempotent.
 */
export function mergeDailyRows(
  accountId: string,
  existing: AccountDailyMetricsRow[],
  fresh: DailyValues[],
  postAggregates: Map<ISODate, Partial<Record<DailyColumn, number>>> = new Map(),
): DailyUpsert[] {
  const byDate = new Map<ISODate, DailyUpsert>();
  const blank = (date: ISODate): DailyUpsert =>
    ({ account_id: accountId, date, ...Object.fromEntries(METRIC_COLUMNS.map((c) => [c, null])) }) as DailyUpsert;
  for (const e of existing) {
    const row = blank(e.date);
    for (const c of METRIC_COLUMNS) row[c] = e[c] == null ? null : Number(e[c]);
    byDate.set(e.date, row);
  }
  for (const f of fresh) {
    const row = byDate.get(f.date) ?? blank(f.date);
    for (const [c, v] of Object.entries(f.values) as [DailyColumn, number][]) if (v != null) row[c] = v;
    byDate.set(f.date, row);
  }
  // agrégats des publications (posts_count ; FB : j'aime / commentaires / partages, absents des insights de Page)
  for (const [date, agg] of postAggregates) {
    const row = byDate.get(date) ?? blank(date);
    for (const [c, v] of Object.entries(agg) as [DailyColumn, number][]) row[c] = v;
    byDate.set(date, row);
  }
  return [...byDate.values()].sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** true si la tranche contient au moins une valeur (sinon Meta n'a plus d'historique). */
export function hasAnyValue(values: DailyValues[]): boolean {
  return values.some((d) => Object.values(d.values).some((v) => v != null && v !== 0));
}

/** « Café Lumière » → « cafe-lumiere » (slugs de marque, noms de fichiers). */
export function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "marque"
  );
}
