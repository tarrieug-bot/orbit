"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Fragment, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { Avatar, Delta, NetworkIcon, Sparkline } from "@/components/ui";
import type { AppLocale, Network } from "@/lib/db/types";
import { computeDelta, computeRateDelta, formatCompact, formatNumber, formatPercent, formatPoints, formatSignedNumber, formatSignedPercent } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { NETWORK_COLOR } from "./palette";

export interface OverviewMetrics {
  followers: number;
  followersNet: number;
  reach: number;
  interactions: number;
  engagementRate: number;
  posts: number;
}

export interface OverviewTableRow {
  id: string;
  href: string;
  name: string;
  sector: string | null;
  color: string;
  avatarUrl: string | null;
  current: OverviewMetrics;
  previous: OverviewMetrics | null;
  trend: number[];
  accounts: {
    id: string;
    href: string;
    network: Network;
    handle: string | null;
    name: string | null;
    avatarUrl: string | null;
    current: OverviewMetrics;
    previous: OverviewMetrics | null;
    trend: number[];
  }[];
}

type SortKey = keyof OverviewMetrics | "name";
const COLS: (keyof OverviewMetrics)[] = ["followers", "followersNet", "reach", "interactions", "engagementRate", "posts"];
const LABEL_KEY: Record<keyof OverviewMetrics, string> = {
  followers: "kpi.followers.label",
  followersNet: "kpi.followersNet.label",
  reach: "kpi.reach.label",
  interactions: "kpi.interactions.label",
  engagementRate: "kpi.engagementRate.label",
  posts: "kpi.posts.label",
};

/** Tableau marques × comptes triable de la vue d'ensemble (1 clic vers la marque). */
export function OverviewTable({ rows }: { rows: OverviewTableRow[] }) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
  const router = useRouter();
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "reach", dir: -1 });

  const sorted = useMemo(() => {
    const v = (r: OverviewTableRow) => (sort.key === "name" ? r.name : r.current[sort.key]);
    return [...rows].sort((a, b) => {
      const x = v(a), y = v(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, sort]);

  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "name" ? 1 : -1 }));

  const cell = (m: OverviewMetrics, p: OverviewMetrics | null, k: keyof OverviewMetrics, sub = false) => {
    switch (k) {
      case "followersNet":
        return <span className={cn("font-semibold", m.followersNet > 0 ? "text-positive" : m.followersNet < 0 ? "text-negative" : "text-ink-2")}>{formatSignedNumber(m.followersNet, locale)}</span>;
      case "engagementRate": {
        const d = p ? computeRateDelta(m.engagementRate, p.engagementRate) : null;
        return (
          <span className="inline-flex flex-col items-end gap-0.5">
            <span>{formatPercent(m.engagementRate, locale, 2)}</span>
            {d && d.previous != null && !sub && <span className={cn("text-[11px]", d.trend === "up" ? "text-positive" : d.trend === "down" ? "text-negative" : "text-ink-3")}>{formatPoints(d.diff ?? 0, locale)}</span>}
          </span>
        );
      }
      case "reach": {
        const d = p ? computeDelta(m.reach, p.reach) : null;
        return (
          <span className="inline-flex items-center justify-end gap-2">
            <span>{formatCompact(m.reach, locale)}</span>
            {d?.ratio != null && <Delta trend={d.trend} label={formatSignedPercent(d.ratio, locale, 0)} />}
          </span>
        );
      }
      case "posts":
        return formatNumber(m.posts, locale);
      default:
        return formatCompact(m[k], locale);
    }
  };

  const sortHead = (k: SortKey, label: string, align: "left" | "right" = "right") => {
    const active = sort.key === k;
    return (
      <th key={k} scope="col" aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"} className={cn("px-3 py-2.5 font-medium whitespace-nowrap", align === "right" ? "text-right" : "text-left", k === "name" && "pl-5")}>
        <button
          type="button"
          onClick={() => toggle(k)}
          className={cn("inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors hover:text-ink focus-visible:shadow-glow focus-visible:outline-none", active && "text-orbit-700")}
        >
          {label}
          {active ? sort.dir === 1 ? <ArrowUp size={12} /> : <ArrowDown size={12} /> : <ArrowDown size={12} className="opacity-0" />}
        </button>
      </th>
    );
  };

  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[920px] text-sm">
        <thead>
          <tr className="border-y border-line bg-surface-2 text-xs text-ink-2">
            {sortHead("name", t("overview.brandAccount"), "left")}
            {COLS.map((k) => sortHead(k, t(LABEL_KEY[k])))}
            <th scope="col" className="px-4 py-2.5 text-left font-medium whitespace-nowrap">{t("overview.reachTrend")}</th>
            <th aria-hidden className="w-8" />
          </tr>
        </thead>
        <tbody className="tabular">
          {sorted.map((row) => (
            <Fragment key={row.id}>
              <tr
                onClick={() => router.push(row.href)}
                className="group cursor-pointer border-b border-line/60 bg-surface transition-colors hover:bg-orbit-50/50"
              >
                <td className="px-5 py-3">
                  <Link href={row.href} onClick={(e) => e.stopPropagation()} className="flex items-center gap-3 rounded-lg font-semibold text-ink focus-visible:shadow-glow focus-visible:outline-none">
                    <Avatar src={row.avatarUrl} name={row.name} color={row.color} size="md" shape="rounded" />
                    <span className="min-w-0">
                      <span className="block truncate">{row.name}</span>
                      {row.sector && <span className="block truncate text-xs font-normal text-ink-3">{row.sector}</span>}
                    </span>
                  </Link>
                </td>
                {COLS.map((k) => (
                  <td key={k} className="px-3 py-3 text-right font-medium whitespace-nowrap text-ink">{cell(row.current, row.previous, k)}</td>
                ))}
                <td className="px-4 py-3">
                  <Sparkline values={row.trend} color={row.color} width={96} height={30} />
                </td>
                <td className="pr-4 text-ink-3 transition-transform group-hover:translate-x-0.5"><ChevronRight size={16} /></td>
              </tr>
              {row.accounts.map((a) => (
                <tr key={a.id} onClick={() => router.push(a.href)} className="group cursor-pointer border-b border-line/60 text-ink-2 transition-colors hover:bg-orbit-50/40">
                  <td className="py-2 pr-5 pl-10">
                    <Link href={a.href} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2.5 rounded-lg focus-visible:shadow-glow focus-visible:outline-none">
                      <Avatar src={a.avatarUrl} name={a.name ?? a.handle ?? row.name} color={row.color} size="sm" network={a.network} />
                      <NetworkIcon network={a.network} size={13} />
                      <span className="truncate text-[13px]">{a.handle ?? a.name}</span>
                    </Link>
                  </td>
                  {COLS.map((k) => (
                    <td key={k} className="px-3 py-2 text-right text-[13px] whitespace-nowrap">{cell(a.current, a.previous, k, true)}</td>
                  ))}
                  <td className="px-4 py-2">
                    <Sparkline values={a.trend} color={NETWORK_COLOR[a.network]} width={96} height={24} />
                  </td>
                  <td />
                </tr>
              ))}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
