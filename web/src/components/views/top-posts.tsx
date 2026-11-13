import { ImageOff } from "lucide-react";
import { NetworkIcon } from "@/components/ui";
import type { PostItem } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";
import { formatCompact, formatPercent } from "@/lib/metrics";
import { postDate } from "./post-card";

/** Liste compacte des meilleures publications, avec miniature réelle. */
export function TopPosts({
  posts,
  locale,
  labels,
  empty,
}: {
  posts: PostItem[];
  locale: AppLocale;
  labels: { reach: string; interactions: string; engagement: string; format: (p: PostItem) => string };
  empty: string;
}) {
  if (!posts.length) return <p className="px-5 pb-6 text-sm text-ink-2">{empty}</p>;
  return (
    <ol className="divide-y divide-line/70">
      {posts.map((p, i) => {
        const Wrapper = p.permalink ? "a" : "div";
        return (
          <li key={p.id}>
            <Wrapper
              {...(p.permalink ? { href: p.permalink, target: "_blank", rel: "noopener noreferrer" } : {})}
              className="group flex items-center gap-3 px-5 py-3 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none"
            >
              <span className="tabular w-5 shrink-0 text-center text-sm font-semibold text-ink-3">{i + 1}</span>
              <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-xl bg-surface-2 ring-1 ring-black/5">
                {p.thumbnailUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={p.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-105" />
                ) : (
                  <span className="flex h-full items-center justify-center text-ink-3"><ImageOff size={16} /></span>
                )}
                <span className="absolute right-0.5 bottom-0.5">
                  <NetworkIcon network={p.network} variant="badge" size={16} />
                </span>
              </span>
              <span className="min-w-0 flex-1">
                <span className="line-clamp-1 text-[13px] font-medium text-ink">{p.caption}</span>
                <span className="mt-0.5 block text-xs text-ink-3">
                  {labels.format(p)} · {postDate(p.publishedAt, locale, false)}
                </span>
              </span>
              <span className="tabular hidden shrink-0 text-right text-xs text-ink-2 sm:block">
                <b className="block text-[13px] font-semibold text-ink">{p.metrics.reach != null ? formatCompact(p.metrics.reach, locale) : "—"}</b>
                {labels.reach}
              </span>
              <span className="tabular hidden shrink-0 text-right text-xs text-ink-2 sm:block">
                <b className="block text-[13px] font-semibold text-ink">{formatCompact(p.metrics.interactions, locale)}</b>
                {labels.interactions}
              </span>
              <span className="tabular shrink-0 rounded-pill bg-orbit-50 px-2 py-1 text-xs font-semibold text-orbit-700" title={labels.engagement}>
                {p.metrics.engagementRate != null ? formatPercent(p.metrics.engagementRate, locale, 2) : "—"}
              </span>
            </Wrapper>
          </li>
        );
      })}
    </ol>
  );
}
