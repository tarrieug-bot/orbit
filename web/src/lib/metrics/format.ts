import type { AppLocale, ISODate } from "@/lib/db/types";
import { toUTCDate } from "./dates";

/** Locales Intl utilisées pour l'interface et les rapports. */
export const INTL_LOCALE: Record<AppLocale, string> = { fr: "fr-FR", en: "en-GB" };

export function formatNumber(n: number, locale: AppLocale = "fr", digits = 0): string {
  return n.toLocaleString(INTL_LOCALE[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

/** 12 345 → « 12,3 k » (fr) / « 12.3k » (en) ; < 10 000 affiché en entier. */
export function formatCompact(n: number, locale: AppLocale = "fr"): string {
  const a = Math.abs(n);
  const sp = locale === "fr" ? " " : "";
  const opts = { maximumFractionDigits: 1 };
  if (a >= 1e6) return (n / 1e6).toLocaleString(INTL_LOCALE[locale], opts) + sp + "M";
  if (a >= 1e4) return (n / 1e3).toLocaleString(INTL_LOCALE[locale], opts) + sp + "k";
  return formatNumber(n, locale);
}

/** 0.0345 → « 3,45 % » (fr) / « 3.45% » (en) */
export function formatPercent(ratio: number, locale: AppLocale = "fr", digits = 1): string {
  const v = (ratio * 100).toLocaleString(INTL_LOCALE[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits });
  return locale === "fr" ? `${v} %` : `${v}%`;
}

/** Variation signée : +12,3 % / −4,0 % */
export function formatSignedPercent(ratio: number, locale: AppLocale = "fr", digits = 1): string {
  const sign = ratio > 0 ? "+" : ratio < 0 ? "−" : "";
  return sign + formatPercent(Math.abs(ratio), locale, digits);
}

/** Différence de taux en points : 0.004 → « +0,40 pt » */
export function formatPoints(diff: number, locale: AppLocale = "fr", digits = 2): string {
  const v = Math.abs(diff * 100).toLocaleString(INTL_LOCALE[locale], { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  return `${sign}${v}${locale === "fr" ? " pt" : " pt"}`;
}

export function formatSignedNumber(n: number, locale: AppLocale = "fr"): string {
  const sign = n > 0 ? "+" : n < 0 ? "−" : "";
  return sign + formatNumber(Math.abs(n), locale);
}

export function formatDate(iso: ISODate, locale: AppLocale = "fr", opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  return toUTCDate(iso).toLocaleDateString(INTL_LOCALE[locale], { ...opts, timeZone: "UTC" });
}

/** « 1 – 30 nov. 2026 » / « 12 oct. – 10 nov. 2026 » */
export function formatRange(r: { from: ISODate; to: ISODate }, locale: AppLocale = "fr"): string {
  if (r.from === r.to) return formatDate(r.from, locale);
  const sameYear = r.from.slice(0, 4) === r.to.slice(0, 4);
  const left = formatDate(r.from, locale, sameYear ? { day: "numeric", month: "short" } : undefined);
  return `${left} – ${formatDate(r.to, locale)}`;
}

/** Libellé d'axe selon la granularité */
export function formatBucketLabel(iso: ISODate, granularity: "day" | "week" | "month", locale: AppLocale = "fr"): string {
  if (granularity === "month") return formatDate(iso, locale, { month: "short", year: "2-digit" });
  return formatDate(iso, locale, { day: "numeric", month: "short" });
}
