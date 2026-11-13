import { getLocale, getTranslations } from "next-intl/server";
import { csvResponse, pct2, toCsv } from "@/components/views/csv";
import { getOverview, getPageFilters, getSessionUser } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";

/** Export CSV du tableau de la vue d'ensemble (agence). */
export async function GET(request: Request) {
  const user = await getSessionUser();
  if (!user?.isAgency) return new Response("Forbidden", { status: 403 });
  const filters = await getPageFilters(new URL(request.url).searchParams);
  const data = await getOverview(filters);
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const head = [
    t("csv.brand"), t("csv.network"), t("csv.account"), t("kpi.followers.label"), t("kpi.followersNet.label"), t("kpi.followersGained.label"),
    t("kpi.reach.label"), t("kpi.views.label"), t("kpi.interactions.label"), `${t("kpi.engagementRate.label")} (%)`, t("kpi.posts.label"),
    t("kpi.profileVisits.label"), t("kpi.linkClicks.label"),
  ];
  const rows = data.brands.flatMap((b) =>
    b.accounts.map((a) => {
      const m = a.totals;
      return [b.brand.name, t(`network.${a.account.network}`), a.account.handle, m.followers, m.followersNet, m.followersGained, m.reach, m.views, m.interactions, pct2(m.engagementRate), m.posts, m.profileVisits, m.linkClicks];
    }),
  );
  return csvResponse(toCsv([head, ...rows], locale), `orbit-${filters.range.from}-${filters.range.to}.csv`);
}
