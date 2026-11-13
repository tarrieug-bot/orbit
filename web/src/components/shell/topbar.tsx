"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useTranslations } from "next-intl";
import { CalendarDays, Loader2 } from "lucide-react";
import { Avatar, NetworkIcon, Select } from "@/components/ui";
import { LIVE_NETWORKS, NETWORKS, type ISODate, type Network } from "@/lib/db/types";
import { PERIOD_PRESETS, parseFilters, serializeFilters, type Filters } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import type { ShellBrand, ShellCampaign } from "./types";

/** Pages sans filtres de période / réseaux. */
const NO_FILTERS = ["/settings", "/reports", "/campaigns", "/audience", "/no-access"];

export function Topbar({ brands, campaigns, today }: { brands: ShellBrand[]; campaigns: ShellCampaign[]; today: ISODate }) {
  const t = useTranslations();
  const pathname = usePathname();
  const sp = useSearchParams();
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  const brandId = pathname.match(/^\/brands\/([^/]+)/)?.[1] ?? sp.get("brand");
  const brand = brands.find((b) => b.id === brandId);
  const brandCampaigns = campaigns.filter((c) => c.brandId === brand?.id);
  const filters = parseFilters(sp, { today, campaigns: brandCampaigns.map((c) => ({ id: c.id, starts_on: c.from, ends_on: c.to })) });
  const showFilters = !NO_FILTERS.some((p) => pathname.startsWith(p));

  const update = (patch: Partial<Filters>) => {
    const next = { ...filters, ...patch };
    const extra = new URLSearchParams(serializeFilters(next));
    const b = sp.get("brand");
    if (b) extra.set("brand", b);
    const q = extra.toString();
    startTransition(() => router.replace(q ? `${pathname}?${q}` : pathname, { scroll: false }));
  };

  const toggleNetwork = (n: Network) => {
    const has = filters.networks.includes(n);
    const nets = has ? filters.networks.filter((x) => x !== n) : [...filters.networks, n];
    if (nets.length) update({ networks: NETWORKS.filter((x) => nets.includes(x)) });
  };

  const section = pathname.endsWith("/posts") ? t("nav.posts") : t("nav.analytics");
  const title = pathname === "/" ? t("nav.overview") : pathname.startsWith("/settings/accounts") ? t("nav.accounts") : pathname.startsWith("/settings/clients") ? t("nav.clients") : null;
  const sectionTitle = (["audience", "campaigns", "reports"] as const).find((s) => pathname.startsWith(`/${s}`));

  return (
    <header className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-line/70 bg-canvas/80 px-6 py-3 backdrop-blur-xl lg:px-8">
      <div className="mr-auto flex min-w-0 items-center gap-3">
        {brand && pathname.startsWith("/brands/") ? (
          <>
            <Avatar src={brand.avatarUrl} name={brand.name} color={brand.color} size="md" shape="rounded" />
            <div className="min-w-0">
              <h1 className="truncate text-lg font-semibold tracking-tight">{brand.name}</h1>
              <p className="text-xs text-ink-2">{section}</p>
            </div>
          </>
        ) : sectionTitle ? (
          <div className="min-w-0">
            <h1 className="text-lg font-semibold tracking-tight">{t(`nav.${sectionTitle}`)}</h1>
            {brand && <p className="text-xs text-ink-2">{brand.name}</p>}
          </div>
        ) : (
          <h1 className="text-lg font-semibold tracking-tight">{title}</h1>
        )}
        {pending && <Loader2 size={16} className="animate-spin text-ink-3" />}
      </div>

      {showFilters && (
        <div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label={t("network.filter")} className="inline-flex items-center gap-0.5 rounded-control border border-line bg-surface p-0.5 shadow-soft">
            {NETWORKS.map((n) => {
              const live = LIVE_NETWORKS.includes(n);
              const on = filters.networks.includes(n);
              return (
                <button
                  key={n}
                  type="button"
                  disabled={!live}
                  aria-pressed={on}
                  onClick={() => toggleNetwork(n)}
                  title={live ? t(`network.${n}`) : `${t(`network.${n}`)} — ${t("common.comingSoon")}`}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-[8px] transition-all",
                    on ? "bg-orbit-50 shadow-soft ring-1 ring-orbit-200" : "opacity-45 grayscale hover:opacity-80 hover:grayscale-0",
                    !live && "cursor-not-allowed opacity-25 hover:opacity-25 hover:grayscale",
                  )}
                >
                  <NetworkIcon network={n} size={16} />
                </button>
              );
            })}
          </div>

          <Select
            aria-label={t("period.label")}
            icon={<CalendarDays size={15} />}
            value={filters.preset === "campaign" && filters.campaignId ? `campaign:${filters.campaignId}` : filters.preset}
            onChange={(e) => {
              const v = e.target.value;
              if (v.startsWith("campaign:")) update({ preset: "campaign", campaignId: v.slice(9) });
              else update({ preset: v as Filters["preset"], campaignId: null });
            }}
          >
            {PERIOD_PRESETS.map((p) => (
              <option key={p} value={p}>
                {t(`period.presets.${p}`)}
              </option>
            ))}
            {brandCampaigns.length > 0 && (
              <optgroup label={t("period.campaigns")}>
                {brandCampaigns.map((c) => (
                  <option key={c.id} value={`campaign:${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
            )}
          </Select>

          {filters.preset === "custom" && (
            <div className="flex items-center gap-1.5 text-sm text-ink-2">
              <input type="date" max={today} value={filters.range.from} onChange={(e) => e.target.value && update({ range: { ...filters.range, from: e.target.value } })} className="h-9 rounded-control border border-line bg-surface px-2 text-sm shadow-soft" />
              <span>→</span>
              <input type="date" max={today} value={filters.range.to} onChange={(e) => e.target.value && update({ range: { ...filters.range, to: e.target.value } })} className="h-9 rounded-control border border-line bg-surface px-2 text-sm shadow-soft" />
            </div>
          )}

          <label className="flex h-9 cursor-pointer items-center gap-2 rounded-control border border-line bg-surface px-3 text-sm font-medium text-ink-2 shadow-soft select-none">
            <span className={cn("relative h-4.5 w-8 rounded-full transition-colors", filters.compare ? "bg-orbit-600" : "bg-line-strong")}>
              <span className={cn("absolute top-0.5 h-3.5 w-3.5 rounded-full bg-white shadow transition-all", filters.compare ? "left-4" : "left-0.5")} />
            </span>
            <input type="checkbox" className="sr-only" checked={filters.compare} onChange={(e) => update({ compare: e.target.checked })} />
            {t("common.compare")}
          </label>
        </div>
      )}
    </header>
  );
}
