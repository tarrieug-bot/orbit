import { ExternalLink, Film, Images, Image as ImageIcon, Link2, Type } from "lucide-react";
import { Avatar, NetworkIcon } from "@/components/ui";
import type { PostItem } from "@/lib/db";
import type { AppLocale, PostFormat } from "@/lib/db/types";
import { formatCompact, formatNumber, formatPercent, INTL_LOCALE } from "@/lib/metrics";
import { cn } from "@/lib/utils";

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

/** Carte publication : miniature réelle, format, réseau, légende et métriques. */
export function PostCard({ post, labels, locale, rank, brandColor }: { post: PostItem; labels: PostCardLabels; locale: AppLocale; rank?: number; brandColor: string }) {
  const m = post.metrics;
  const Icon = FORMAT_ICON[post.format];
  const third = post.network === "ig" ? m.saves : m.shares;
  const Thumb = post.permalink ? "a" : "div";
  return (
    <article className="group flex flex-col overflow-hidden rounded-card border border-line/70 bg-surface shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-pop starting:translate-y-1 starting:opacity-0">
      <Thumb
        {...(post.permalink ? { href: post.permalink, target: "_blank", rel: "noopener noreferrer", "aria-label": labels.open } : {})}
        className="relative block aspect-square overflow-hidden bg-surface-2"
      >
        {post.thumbnailUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={post.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.04]" />
        ) : (
          <div className="flex h-full items-center justify-center bg-[linear-gradient(150deg,var(--color-orbit-100),var(--color-orbit-300))] p-6 text-center text-sm font-medium text-orbit-900">
            <span className="line-clamp-5">{post.caption}</span>
          </div>
        )}
        <div className="absolute inset-x-0 top-0 flex items-start justify-between p-3">
          <span className="inline-flex items-center gap-1 rounded-pill bg-white/90 px-2 py-0.5 text-[11px] font-semibold text-ink shadow-soft backdrop-blur">
            <Icon size={12} aria-hidden />
            {labels.format}
          </span>
          <NetworkIcon network={post.network} variant="badge" size={24} />
        </div>
        {rank != null && (
          <span className="absolute bottom-3 left-3 rounded-pill bg-ink/80 px-2 py-0.5 text-[11px] font-semibold text-white backdrop-blur">#{rank}</span>
        )}
        {post.permalink && (
          <span className="absolute right-3 bottom-3 flex h-7 w-7 items-center justify-center rounded-full bg-white/90 text-ink opacity-0 shadow-soft transition-opacity group-hover:opacity-100">
            <ExternalLink size={13} aria-hidden />
          </span>
        )}
      </Thumb>
      <div className="flex flex-1 flex-col gap-3 p-4">
        <div className="flex items-center gap-2 text-xs text-ink-2">
          <Avatar src={post.account.avatarUrl} name={post.account.name ?? post.account.handle ?? ""} color={brandColor} size="xs" />
          <span className="truncate font-medium text-ink">{post.account.handle}</span>
          <span className="ml-auto shrink-0 text-ink-3">{postDate(post.publishedAt, locale)}</span>
        </div>
        {labels.campaign && <span className="w-fit rounded-pill bg-orbit-50 px-2 py-0.5 text-[11px] font-medium text-orbit-700">{labels.campaign}</span>}
        <p className="line-clamp-2 text-[13px] leading-snug text-ink">{post.caption}</p>
        <dl className="tabular mt-auto grid grid-cols-3 gap-x-2 gap-y-2.5 border-t border-line/70 pt-3 text-center">
          <Metric label={labels.reach} value={m.reach != null ? formatCompact(m.reach, locale) : "—"} strong />
          <Metric label={labels.interactions} value={formatCompact(m.interactions, locale)} strong />
          <Metric label={labels.engagement} value={m.engagementRate != null ? formatPercent(m.engagementRate, locale, 1) : "—"} strong accent />
          <Metric label={labels.likes} value={m.likes != null ? formatNumber(m.likes, locale) : "—"} />
          <Metric label={labels.comments} value={m.comments != null ? formatNumber(m.comments, locale) : "—"} />
          <Metric label={labels.third} value={third != null ? formatNumber(third, locale) : "—"} />
        </dl>
      </div>
    </article>
  );
}

function Metric({ label, value, strong, accent }: { label: string; value: string; strong?: boolean; accent?: boolean }) {
  return (
    <div className="flex min-w-0 flex-col-reverse">
      <dt className="truncate text-[11px] text-ink-3">{label}</dt>
      <dd className={cn("truncate", strong ? "text-[15px] font-semibold" : "text-[13px] font-medium", accent ? "text-orbit-700" : "text-ink")}>{value}</dd>
    </div>
  );
}
