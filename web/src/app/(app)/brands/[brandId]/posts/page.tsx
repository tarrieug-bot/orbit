import { getLocale, getTranslations } from "next-intl/server";
import { ImageOff } from "lucide-react";
import { BrandHero } from "@/components/views/brand-hero";
import { filterQuery } from "@/components/views/page-header";
import { PeriodNote } from "@/components/views/period-note";
import { PostCard } from "@/components/views/post-card";
import { postQueryFrom } from "@/components/views/posts-query";
import { PostsToolbar } from "@/components/views/posts-toolbar";
import { buttonVariants, EmptyState } from "@/components/ui";
import { requireBrand } from "@/lib/auth/guards";
import { getCampaigns, getPageFilters, getPosts, type PageSearchParams } from "@/lib/db";
import type { AppLocale, PostFormat } from "@/lib/db/types";
import Link from "next/link";

const PAGE = 48;

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("nav.posts") };
}

/** Publications d'une marque : grille filtrable, triable, export CSV. */
export default async function BrandPostsPage({ params, searchParams }: { params: Promise<{ brandId: string }>; searchParams: PageSearchParams }) {
  const { brandId } = await params;
  const { brand } = await requireBrand(brandId, "posts");
  const sp = await searchParams;
  const filters = await getPageFilters(sp, brand.id);
  const query = postQueryFrom(sp, filters);
  const [posts, allPosts, campaigns] = await Promise.all([
    getPosts(brand.id, query),
    getPosts(brand.id, { range: filters.range, networks: filters.networks, limit: 1000 }),
    getCampaigns(brand.id),
  ]);
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const show = Math.max(PAGE, Math.min(posts.length, Number(Array.isArray(sp.show) ? sp.show[0] : sp.show) || PAGE));
  const shown = posts.slice(0, show);
  const ranked = query.sort !== "date";
  const campaignName = new Map(campaigns.map((c) => [c.id, c.name]));
  const formats = [...new Set(allPosts.map((p) => p.format))] as PostFormat[];
  const accounts = brand.accounts.filter((a) => filters.networks.includes(a.network));
  const keep = ["period", "from", "to", "nets", "compare", "campaign", "fmt", "net", "sort"];

  return (
    <div className="space-y-6">
      <BrandHero brand={brand} accounts={accounts} locale={locale} followersLabel={t("kpi.followers.label").toLowerCase()} />
      <PeriodNote range={filters.range} previous={null} />
      <PostsToolbar
        formats={formats}
        networks={[...new Set(accounts.map((a) => a.network))]}
        count={posts.length}
        shown={shown.length}
        csvHref={`/brands/${brand.id}/posts/csv${filterQuery(sp, undefined, keep)}`}
      />
      {shown.length === 0 ? (
        <EmptyState icon={<ImageOff size={22} />} title={t("posts.empty")} description={t("posts.emptyHelp")} />
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {shown.map((p, i) => (
            <PostCard
              key={p.id}
              post={p}
              locale={locale}
              brandColor={brand.color}
              rank={ranked ? i + 1 : undefined}
              labels={{
                format: t(`format.${p.format}`),
                reach: t("kpi.reach.label"),
                interactions: t("posts.short.interactions"),
                engagement: t("posts.short.engagement"),
                likes: t("kpi.likes.label"),
                comments: t("posts.short.comments"),
                third: p.network === "ig" ? t("posts.short.saves") : t("kpi.shares.label"),
                open: t("posts.open"),
                campaign: p.campaignId ? campaignName.get(p.campaignId) : null,
              }}
            />
          ))}
        </div>
      )}
      {shown.length < posts.length && (
        <div className="flex justify-center">
          <Link scroll={false} href={`/brands/${brand.id}/posts${filterQuery(sp, { show: String(show + PAGE) }, keep)}`} className={buttonVariants({ variant: "secondary" })}>
            {t("posts.more")}
          </Link>
        </div>
      )}
    </div>
  );
}
