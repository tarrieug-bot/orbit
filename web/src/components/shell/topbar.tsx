"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2, Menu } from "lucide-react";
import { Avatar, DateRangePicker, NetworkIcon, Toggle, Tooltip, type DateRangePreset } from "@/components/ui";
import { LIVE_NETWORKS, NETWORKS, type AppLocale, type ISODate, type Network } from "@/lib/db/types";
import { PERIOD_PRESETS, formatRange, parseFilters, serializeFilters, type Filters } from "@/lib/metrics";
import { cn } from "@/lib/utils";
import { NAV_EVENT } from "./sidebar";
import type { ShellBrand, ShellCampaign } from "./types";

/** Pages sans filtres de période / réseaux. */
const NO_FILTERS = ["/settings", "/reports", "/campaigns", "/audience", "/no-access"];

export function Topbar({ brands, campaigns, today }: { brands: ShellBrand[]; campaigns: ShellCampaign[]; today: ISODate }) {
  const t = useTranslations();
  const locale = useLocale() as AppLocale;
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

  const presets: DateRangePreset[] = [
    ...PERIOD_PRESETS.filter((p) => p !== "custom").map((p) => ({ value: p, label: t(`period.presets.${p}`) })),
    ...brandCampaigns.map((c) => ({ value: `campaign:${c.id}`, label: c.name, group: t("period.campaigns") })),
  ];
  const presetValue = filters.preset === "campaign" && filters.campaignId ? `campaign:${filters.campaignId}` : filters.preset;
  const presetLabel = presets.find((p) => p.value === presetValue)?.label ?? t(`period.presets.${filters.preset}`);

  return (
    <header className="sticky top-0 z-30 border-b border-line/80 bg-canvas/80 backdrop-blur-xl backdrop-saturate-150">
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2.5 px-4 py-3 sm:px-6 lg:px-8">
        <button
          type="button"
          onClick={() => window.dispatchEvent(new CustomEvent(NAV_EVENT, { detail: "toggle" }))}
          aria-label={t("shell.openMenu")}
          className="-ml-1 rounded-control p-2 text-ink-2 hover:bg-surface-3 hover:text-ink lg:hidden"
        >
          <Menu size={19} />
        </button>
        <div className="mr-auto flex min-w-0 items-center gap-3">
          {brand && pathname.startsWith("/brands/") ? (
            <>
              <Avatar src={brand.avatarUrl} name={brand.name} color={brand.color} size="md" shape="rounded" />
              <div className="min-w-0">
                <h1 className="truncate text-[17px] leading-6 font-semibold tracking-[-0.015em]">{brand.name}</h1>
                <p className="flex items-center gap-1.5 text-xs text-ink-2">
                  {section}
                  <span className="text-ink-3">·</span>
                  {brand.networks.map((n) => (
                    <NetworkIcon key={n} network={n} size={12} />
                  ))}
                </p>
              </div>
            </>
          ) : sectionTitle ? (
            <div className="min-w-0">
              <h1 className="text-[17px] leading-6 font-semibold tracking-[-0.015em]">{t(`nav.${sectionTitle}`)}</h1>
              {brand && (
                <p className="flex items-center gap-1.5 text-xs text-ink-2">
                  <Avatar src={brand.avatarUrl} name={brand.name} color={brand.color} size="xs" shape="rounded" />
                  {brand.name}
                </p>
              )}
            </div>
          ) : (
            <h1 className="text-[17px] leading-6 font-semibold tracking-[-0.015em]">{title}</h1>
          )}
          {pending && <Loader2 size={16} className="animate-spin text-ink-3" />}
        </div>

        {showFilters && (
          <div className="flex w-full flex-wrap items-center gap-2 sm:w-auto">
            <div role="group" aria-label={t("network.filter")} className="inline-flex items-center gap-0.5 rounded-control border border-line bg-surface p-[3px] shadow-soft">
              {NETWORKS.map((n) => {
                const live = LIVE_NETWORKS.includes(n);
                const on = filters.networks.includes(n);
                const name = t(`network.${n}`);
                return (
                  <Tooltip key={n} content={live ? name : `${name} — ${t("common.comingSoon")}`} side="bottom">
                    <button
                      type="button"
                      disabled={!live}
                      aria-pressed={on}
                      aria-label={name}
                      onClick={() => toggleNetwork(n)}
                      className={cn(
                        "flex h-[30px] items-center gap-1.5 rounded-[7px] px-2 text-[13px] font-medium transition-all",
                        on ? "bg-surface-3 text-ink shadow-[inset_0_0_0_1px_var(--color-line)]" : "text-ink-3 hover:bg-surface-2 hover:text-ink-2",
                        !live && "cursor-not-allowed px-1.5",
                      )}
                    >
                      <NetworkIcon network={n} size={16} muted={!live || !on} />
                      {live && <span className="hidden md:inline">{name}</span>}
                    </button>
                  </Tooltip>
                );
              })}
            </div>

            <DateRangePicker
              presets={presets}
              value={presetValue}
              range={filters.range}
              label={presetLabel}
              detail={formatRange(filters.range, locale)}
              max={today}
              onPresetChange={(v) => {
                if (v.startsWith("campaign:")) update({ preset: "campaign", campaignId: v.slice(9) });
                else update({ preset: v as Filters["preset"], campaignId: null });
              }}
              onRangeChange={(range) => update({ preset: "custom", campaignId: null, range })}
              labels={{ custom: t("shell.customRange"), from: t("period.from"), to: t("period.to"), apply: t("shell.apply") }}
            />

            <Toggle framed size="sm" checked={filters.compare} onCheckedChange={(v) => update({ compare: v })} label={t("common.compare")} />
          </div>
        )}
      </div>
    </header>
  );
}
