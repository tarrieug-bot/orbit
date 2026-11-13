import type { AppLocale } from "@/lib/db/types";

export const LOCALES: readonly AppLocale[] = ["fr", "en"];
export const DEFAULT_LOCALE: AppLocale = "fr";
/** Cookie de préférence de langue (prioritaire sur le profil, ex. bascule rapide). */
export const LOCALE_COOKIE = "NEXT_LOCALE";

export function isLocale(v: unknown): v is AppLocale {
  return typeof v === "string" && (LOCALES as readonly string[]).includes(v);
}
