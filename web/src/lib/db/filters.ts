import "server-only";
import { parseFilters, todayISO, type Filters, type SearchParamsLike } from "@/lib/metrics";
import { getCampaigns } from "./queries";

/** Props d'une page Next.js 16 (params et searchParams sont des Promise). */
export type PageSearchParams = Promise<Record<string, string | string[] | undefined>>;

/**
 * Filtres globaux d'une page à partir de l'URL (période, réseaux, comparaison,
 * campagne de la marque si `brandId`).
 */
export async function getPageFilters(searchParams: PageSearchParams | SearchParamsLike, brandId?: string): Promise<Filters> {
  const sp = await searchParams;
  const campaigns = brandId ? await getCampaigns(brandId) : [];
  return parseFilters(sp, {
    today: todayISO(),
    campaigns: campaigns.map((c) => ({ id: c.id, starts_on: c.range.from, ends_on: c.range.to })),
  });
}
