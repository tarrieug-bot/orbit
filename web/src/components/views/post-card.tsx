import { Film, Images, Image as ImageIcon, Link2, Type } from "lucide-react";
import { Badge, PostCard as UiPostCard } from "@/components/ui";
import type { PostItem } from "@/lib/db";
import type { AppLocale, PostFormat } from "@/lib/db/types";
import { formatCompact, formatNumber, formatPercent, INTL_LOCALE } from "@/lib/metrics";

export const FORMAT_ICON: Record<PostFormat, typeof ImageIcon> = {
  image: ImageIcon,
  carousel: Images,
  reel: Film,
  video: Film,
  story: Film,
  link: Link2,
  status: Type,
};

export interface PostCardLabels {
  format: string;
  reach: string;
  interactions: string;
  engagement: string;
  likes: string;
  comments: string;
  third: string;
  open: string;
  campaign?: string | null;
}

/** Date + heure locales (Martinique) d'une publication. */
export function postDate(iso: string, locale: AppLocale, withTime = true) {
  return new Date(iso).toLocaleString(INTL_LOCALE[locale], {
    timeZone: "America/Martinique",
    weekday: withTime ? "short" : undefined,
    day: "numeric",
    month: "short",
    year: withTime ? "numeric" : undefined,
    hour: withTime ? "2-digit" : undefined,
    minute: withTime ? "2-digit" : undefined,
  });
}

/** Carte publication (PostCard du design system) : miniature réelle, format, réseau, légende et métriques. */
export function PostCard({ post, labels, locale, rank }: { post: PostItem; labels: PostCardLabels; locale: AppLocale; rank?: number; brandColor?: string }) {
  const m = post.metrics;
  const third = post.network === "ig" ? m.saves : m.shares;
  const n = (v: number | null) => (v != null ? formatNumber(v, locale) : "—");
  return (
    <UiPostCard
      className="transition duration-300 starting:translate-y-1 starting:opacity-0"
      thumbnailUrl={post.thumbnailUrl}
      caption={post.caption}
      network={post.network}
      format={post.format}
      formatLabel={labels.format}
      dateLabel={postDate(post.publishedAt, locale)}
      rank={rank}
      href={post.permalink}
      openLabel={labels.open}
      account={{ name: post.account.name ?? post.account.handle ?? "", avatarUrl: post.account.avatarUrl, handle: post.account.handle }}
      highlight={{ label: labels.engagement, value: m.engagementRate != null ? formatPercent(m.engagementRate, locale, 1) : "—" }}
      badge={labels.campaign ? <Badge tone="brand" size="sm">{labels.campaign}</Badge> : undefined}
      metrics={[
        { label: labels.reach, value: m.reach != null ? formatCompact(m.reach, locale) : "—" },
        { label: labels.interactions, value: formatCompact(m.interactions, locale) },
        { label: labels.likes, value: n(m.likes) },
        { label: labels.third, value: n(third) },
      ]}
    />
  );
}
