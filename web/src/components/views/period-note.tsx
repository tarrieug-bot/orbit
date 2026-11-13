import { getLocale, getTranslations } from "next-intl/server";
import type { AppLocale } from "@/lib/db/types";
import { formatRange, rangeLength, type DateRange } from "@/lib/metrics";

/** « Période : 14 oct. – 12 nov. 2026 (30 j) · comparée à … » */
export async function PeriodNote({ range, previous }: { range: DateRange; previous: DateRange | null }) {
  const t = await getTranslations("period");
  const locale = (await getLocale()) as AppLocale;
  return (
    <p className="text-[13px] text-ink-2">
      {t("summary", { range: formatRange(range, locale), days: rangeLength(range) })}
      {previous && <span className="text-ink-3"> · {t("comparedTo", { range: formatRange(previous, locale) })}</span>}
    </p>
  );
}
