import type { ISODate } from "@/lib/db/types";
import type { DateRange } from "./types";

/** Fuseau de référence de l'agence (Martinique, UTC−4, sans heure d'été). */
export const DEFAULT_TIMEZONE = "America/Martinique";
const DAY_MS = 86_400_000;

/** Toutes les dates sont manipulées comme des jours calendaires UTC « YYYY-MM-DD ». */
export function toUTCDate(iso: ISODate): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function fromUTCDate(d: Date): ISODate {
  return d.toISOString().slice(0, 10);
}

export function isISODate(v: unknown): v is ISODate {
  return typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(toUTCDate(v).getTime());
}

/** Date du jour dans le fuseau donné. */
export function todayISO(timeZone: string = DEFAULT_TIMEZONE, now: Date = new Date()): ISODate {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  return parts; // en-CA → YYYY-MM-DD
}

export function addDays(iso: ISODate, n: number): ISODate {
  return fromUTCDate(new Date(toUTCDate(iso).getTime() + n * DAY_MS));
}

/** Nombre de jours de a à b (b − a). */
export function diffDays(a: ISODate, b: ISODate): number {
  return Math.round((toUTCDate(b).getTime() - toUTCDate(a).getTime()) / DAY_MS);
}

/** Nombre de jours inclus dans la période. */
export function rangeLength(r: DateRange): number {
  return diffDays(r.from, r.to) + 1;
}

export function eachDay(r: DateRange): ISODate[] {
  const out: ISODate[] = [];
  for (let d = r.from; d <= r.to; d = addDays(d, 1)) out.push(d);
  return out;
}

export function inRange(d: ISODate, r: DateRange): boolean {
  return d >= r.from && d <= r.to;
}

export function startOfMonth(iso: ISODate): ISODate {
  return `${iso.slice(0, 7)}-01`;
}

export function endOfMonth(iso: ISODate): ISODate {
  const d = toUTCDate(startOfMonth(iso));
  return fromUTCDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
}

export function addMonths(iso: ISODate, n: number): ISODate {
  const d = toUTCDate(iso);
  const target = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + n, 1));
  const last = new Date(Date.UTC(target.getUTCFullYear(), target.getUTCMonth() + 1, 0)).getUTCDate();
  target.setUTCDate(Math.min(d.getUTCDate(), last));
  return fromUTCDate(target);
}

/** Lundi = 0 … dimanche = 6 */
export function weekdayIndex(iso: ISODate): number {
  return (toUTCDate(iso).getUTCDay() + 6) % 7;
}
