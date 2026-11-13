"use client";

import { useState } from "react";
import { Clapperboard, ExternalLink, GalleryHorizontalEnd, Image as ImageIcon, Link2, PlayCircle, Sparkles, Type } from "lucide-react";
import type { Network, PostFormat } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import { NetworkIcon } from "./network-icon";

export const POST_FORMAT_ICON: Record<PostFormat, typeof ImageIcon> = {
  image: ImageIcon,
  carousel: GalleryHorizontalEnd,
  reel: Clapperboard,
  video: PlayCircle,
  story: Sparkles,
  link: Link2,
  status: Type,
};

export interface PostCardMetric {
  label: string;
  /** valeur formatée */
  value: string;
  icon?: React.ReactNode;
}

export interface PostCardProps {
  thumbnailUrl?: string | null;
  /** légende dans sa langue d'origine */
  caption?: string | null;
  network: Network;
  format: PostFormat;
  /** libellé traduit du format (« Reel », « Carrousel »…) */
  formatLabel: string;
  /** date formatée (« 12 nov. · 18:30 ») */
  dateLabel: string;
  /** 3 à 4 métriques formatées (portée, interactions…) */
  metrics: PostCardMetric[];
  /** métrique mise en avant sur la miniature (ex. taux d'engagement) */
  highlight?: { label: string; value: string };
  /** compte auteur (affiché si plusieurs comptes) */
  account?: { name: string; avatarUrl?: string | null; handle?: string | null };
  /** rang dans un top (1, 2, 3…) */
  rank?: number;
  /** lien vers la publication d'origine */
  href?: string | null;
  /** libellé accessible du lien externe */
  openLabel?: string;
  /** badge additionnel (campagne…) */
  badge?: React.ReactNode;
  onClick?: () => void;
  layout?: "vertical" | "horizontal";
  className?: string;
}

/** Carte de publication : miniature, réseau, format, date, légende et métriques. */
export function PostCard({ thumbnailUrl, caption, network, format, formatLabel, dateLabel, metrics, highlight, account, rank, href, openLabel, badge, onClick, layout = "vertical", className }: PostCardProps) {
  const [failed, setFailed] = useState(false);
  const FormatIcon = POST_FORMAT_ICON[format];
  const horizontal = layout === "horizontal";
  const Wrapper = onClick ? "button" : "div";
  return (
    <Wrapper
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group relative flex overflow-hidden rounded-card border border-line bg-surface text-left shadow-card transition-[box-shadow,border-color,transform] duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-raised",
        horizontal ? "flex-row" : "flex-col",
        className,
      )}
    >
      <div className={cn("relative shrink-0 overflow-hidden bg-surface-3", horizontal ? "w-32" : "aspect-[4/5] w-full")}>
        {thumbnailUrl && !failed ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setFailed(true)} className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-[1.03]" />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-ink-3">
            <FormatIcon size={28} strokeWidth={1.5} aria-hidden />
          </div>
        )}
        <div className="pointer-events-none absolute inset-x-0 top-0 h-16 bg-gradient-to-b from-black/35 to-transparent" />
        <div className="absolute top-2.5 left-2.5 flex items-center gap-1.5">
          <NetworkIcon network={network} variant="badge" size={22} ring={false} className="shadow-[0_1px_3px_rgb(0_0_0/0.3)]" />
          <span className="inline-flex h-[22px] items-center gap-1 rounded-pill bg-black/45 px-2 text-[11px] font-medium text-white backdrop-blur-md">
            <FormatIcon size={12} aria-hidden />
            {formatLabel}
          </span>
        </div>
        {rank != null && (
          <span className="absolute top-2.5 right-2.5 flex h-[22px] min-w-[22px] items-center justify-center rounded-pill bg-white/90 px-1.5 text-[11px] font-bold text-[#1a1917] tabular shadow-soft">#{rank}</span>
        )}
        {highlight && !horizontal && (
          <div className="absolute right-2.5 bottom-2.5 left-2.5 flex items-center justify-between rounded-[10px] bg-black/50 px-2.5 py-1.5 text-white backdrop-blur-md">
            <span className="text-[11px] text-white/80">{highlight.label}</span>
            <span className="text-sm font-semibold tabular">{highlight.value}</span>
          </div>
        )}
      </div>
      <div className="flex min-w-0 flex-1 flex-col p-3.5">
        <div className="flex items-center gap-2 text-[11.5px] text-ink-3">
          {account && <Avatar src={account.avatarUrl} name={account.name} size="xs" />}
          <span className="min-w-0 truncate">{account?.handle ? `${account.handle} · ` : ""}{dateLabel}</span>
          {href && !onClick && (
            <a href={href} target="_blank" rel="noreferrer noopener" aria-label={openLabel} title={openLabel} onClick={(e) => e.stopPropagation()} className="ml-auto rounded-[6px] p-0.5 text-ink-3 hover:bg-surface-3 hover:text-ink">
              <ExternalLink size={13} aria-hidden />
            </a>
          )}
        </div>
        {caption && <p className={cn("mt-1.5 text-[13px] leading-snug text-ink", horizontal ? "line-clamp-2" : "line-clamp-2 min-h-[2.4em]")}>{caption}</p>}
        {badge && <div className="mt-2">{badge}</div>}
        <dl className={cn("mt-auto grid gap-2 pt-3", metrics.length >= 4 ? "grid-cols-4" : "grid-cols-3")}>
          {metrics.map((m) => (
            <div key={m.label} className="min-w-0">
              <dt className="flex items-center gap-1 truncate text-[10.5px] font-medium tracking-wide text-ink-3 uppercase">
                {m.icon}
                {m.label}
              </dt>
              <dd className="mt-0.5 truncate text-sm font-semibold text-ink tabular">{m.value}</dd>
            </div>
          ))}
        </dl>
      </div>
    </Wrapper>
  );
}
