"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowDownWideNarrow, Download, Filter, Loader2, Share2 } from "lucide-react";
import { buttonVariants, Select } from "@/components/ui";
import type { Network, PostFormat } from "@/lib/db/types";

export const POST_SORTS = ["engagementRate", "reach", "interactions", "views", "date"] as const;
export type PostSortParam = (typeof POST_SORTS)[number];

/** Filtres de la grille des publications (format, réseau, tri), portés par l'URL. */
export function PostsToolbar({ formats, networks, count, shown, csvHref }: { formats: PostFormat[]; networks: Network[]; count: number; shown: number; csvHref: string }) {
  const t = useTranslations();
  const router = useRouter();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [pending, start] = useTransition();

  const set = (key: string, value: string) => {
    const next = new URLSearchParams(sp.toString());
    if (value === "all" || (key === "sort" && value === "date")) next.delete(key);
    else next.set(key, value);
    next.delete("show");
    start(() => router.replace(`${pathname}${next.toString() ? `?${next}` : ""}`, { scroll: false }));
  };

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-card border border-line/70 bg-surface p-3 shadow-card">
      <Select aria-label={t("posts.format")} icon={<Filter size={14} />} value={sp.get("fmt") ?? "all"} onChange={(e) => set("fmt", e.target.value)}>
        <option value="all">{t("posts.allFormats")}</option>
        {formats.map((f) => (
          <option key={f} value={f}>{t(`format.${f}`)}</option>
        ))}
      </Select>
      <Select aria-label={t("network.filter")} icon={<Share2 size={14} />} value={sp.get("net") ?? "all"} onChange={(e) => set("net", e.target.value)}>
        <option value="all">{t("posts.allNetworks")}</option>
        {networks.map((n) => (
          <option key={n} value={n}>{t(`network.${n}`)}</option>
        ))}
      </Select>
      <Select aria-label={t("posts.sort")} icon={<ArrowDownWideNarrow size={14} />} value={sp.get("sort") ?? "date"} onChange={(e) => set("sort", e.target.value)}>
        {POST_SORTS.map((s) => (
          <option key={s} value={s}>{t(`posts.sortBy.${s}`)}</option>
        ))}
      </Select>
      {pending && <Loader2 size={16} className="animate-spin text-ink-3" aria-label={t("common.loading")} />}
      <span className="ml-auto text-sm text-ink-2 tabular" aria-live="polite">
        {t("posts.count", { count })}
        {shown < count && <span className="text-ink-3"> · {t("posts.shown", { shown })}</span>}
      </span>
      <a href={csvHref} download className={buttonVariants({ size: "sm" })}>
        <Download size={14} aria-hidden />
        {t("posts.exportCsv")}
      </a>
    </div>
  );
}
