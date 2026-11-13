import { getRequestConfig } from "next-intl/server";
import { cookies } from "next/headers";
import { DEFAULT_LOCALE, isLocale, LOCALE_COOKIE } from "./config";
import { getSessionUser } from "@/lib/db";

/**
 * Pas de préfixe de langue dans les URL. Langue = cookie NEXT_LOCALE, sinon
 * langue du profil (clients FR/EN), sinon français. Les rapports choisissent
 * leur langue explicitement : getTranslations({ locale: "en", namespace: "report" }).
 */
export default getRequestConfig(async () => {
  const store = await cookies();
  let locale = store.get(LOCALE_COOKIE)?.value;
  if (!isLocale(locale)) {
    try {
      locale = (await getSessionUser())?.locale ?? DEFAULT_LOCALE;
    } catch {
      locale = DEFAULT_LOCALE;
    }
  }
  const lang = isLocale(locale) ? locale : DEFAULT_LOCALE;
  return {
    locale: lang,
    messages: (await import(`../../messages/${lang}.json`)).default,
    timeZone: "America/Martinique",
  };
});
