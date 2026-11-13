"use client";

import { usePathname, useRouter } from "next/navigation";
import { useTransition } from "react";
import { useLocale, useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Avatar, Card, CardContent, CardHeader, NetworkIcon, Select } from "@/components/ui";
import type { AppLocale, Network } from "@/lib/db/types";
import { formatDate } from "@/lib/metrics";
import { CheckChip, Field, Input, Segmented, Switch } from "../form";
import { REPORT_SECTIONS, REPORT_TYPES, serializeReportConfig, type ReportConfig, type ReportSection, type ReportType } from "./config";

export interface BuilderBrand {
  id: string;
  name: string;
  color: string;
  avatarUrl: string | null;
  networks: Network[];
}

/** Constructeur de rapport : chaque modification met à jour l'URL (aperçu rendu côté serveur). */
export function ReportBuilder({
  config,
  brands,
  campaigns,
  months,
  years,
  maxDate,
}: {
  config: ReportConfig;
  brands: BuilderBrand[];
  campaigns: { id: string; name: string }[];
  months: string[];
  years: string[];
  maxDate: string;
}) {
  const t = useTranslations("reportBuilder");
  const tn = useTranslations("network");
  const uiLocale = useLocale() as AppLocale;
  const router = useRouter();
  const pathname = usePathname();
  const [pending, start] = useTransition();
  const brand = brands.find((b) => b.id === config.brandId) ?? brands[0];

  const update = (patch: Partial<ReportConfig>) => {
    const next = { ...config, ...patch };
    start(() => router.replace(`${pathname}?${serializeReportConfig(next)}`, { scroll: false }));
  };
  const toggleSection = (s: ReportSection, on: boolean) => update({ sections: REPORT_SECTIONS.filter((x) => (x === s ? on : config.sections.includes(x))) });
  const toggleNet = (n: Network, on: boolean) => {
    const nets = brand.networks.filter((x) => (x === n ? on : config.networks.includes(x)));
    if (nets.length) update({ networks: nets });
  };

  return (
    <Card>
      <CardHeader
        title={t("title")}
        description={t("subtitle")}
        action={pending ? <Loader2 size={16} className="animate-spin text-ink-3" aria-label={t("updating")} /> : null}
      />
      <CardContent className="space-y-5">
        <Field label={t("brand")} htmlFor="rb-brand">
          {brands.length > 1 ? (
            <Select id="rb-brand" value={config.brandId} onChange={(e) => update({ brandId: e.target.value, campaignId: null, networks: [] })} wrapperClassName="w-full" className="w-full">
              {brands.map((b) => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </Select>
          ) : (
            <div className="flex items-center gap-2.5 rounded-control border border-line bg-surface-2 px-3 py-2 text-sm font-medium text-ink">
              <Avatar src={brand.avatarUrl} name={brand.name} color={brand.color} size="xs" />
              {brand.name}
            </div>
          )}
        </Field>

        <Field label={t("language")}>
          <Segmented<AppLocale>
            name="lang"
            value={config.lang}
            onChange={(v) => update({ lang: v })}
            options={[
              { value: "fr", label: <><span aria-hidden>🇫🇷</span> Français</> },
              { value: "en", label: <><span aria-hidden>🇬🇧</span> English</> },
            ]}
          />
        </Field>

        <Field label={t("type")}>
          <Segmented<ReportType> name="kind" value={config.type} onChange={(v) => update({ type: v })} options={REPORT_TYPES.map((k) => ({ value: k, label: t(`types.${k}`) }))} />
        </Field>

        {config.type === "month" && (
          <Field label={t("month")} htmlFor="rb-month">
            <Select id="rb-month" value={config.month} onChange={(e) => update({ month: e.target.value })} wrapperClassName="w-full" className="w-full capitalize">
              {months.map((m) => (
                <option key={m} value={m}>{formatDate(`${m}-01`, uiLocale, { month: "long", year: "numeric" })}</option>
              ))}
            </Select>
          </Field>
        )}
        {config.type === "year" && (
          <Field label={t("year")} htmlFor="rb-year">
            <Select id="rb-year" value={config.year} onChange={(e) => update({ year: e.target.value })} wrapperClassName="w-full" className="w-full">
              {years.map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </Select>
          </Field>
        )}
        {config.type === "campaign" && (
          <Field label={t("campaign")} htmlFor="rb-camp" hint={campaigns.length ? undefined : t("noCampaign")}>
            {campaigns.length > 0 && (
              <Select id="rb-camp" value={config.campaignId ?? ""} onChange={(e) => update({ campaignId: e.target.value })} wrapperClassName="w-full" className="w-full">
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </Select>
            )}
          </Field>
        )}
        {config.type === "custom" && (
          <div className="grid grid-cols-2 gap-3">
            <Field label={t("from")} htmlFor="rb-from">
              <Input id="rb-from" type="date" max={maxDate} value={config.from} onChange={(e) => e.target.value && update({ from: e.target.value })} />
            </Field>
            <Field label={t("to")} htmlFor="rb-to">
              <Input id="rb-to" type="date" max={maxDate} value={config.to} onChange={(e) => e.target.value && update({ to: e.target.value })} />
            </Field>
          </div>
        )}

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink">{t("networks")}</legend>
          <div className="flex flex-wrap gap-2">
            {brand.networks.map((n) => (
              <CheckChip key={n} label={tn(n)} icon={<NetworkIcon network={n} size={14} />} checked={config.networks.includes(n)} onChange={(e) => toggleNet(n, e.target.checked)} />
            ))}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-1.5 text-[13px] font-medium text-ink">{t("sections")}</legend>
          <div className="flex flex-wrap gap-2">
            {REPORT_SECTIONS.map((s) => (
              <CheckChip key={s} label={t(`sectionNames.${s}`)} checked={config.sections.includes(s)} onChange={(e) => toggleSection(s, e.target.checked)} />
            ))}
          </div>
        </fieldset>

        <Switch label={t("compare")} checked={config.compare} onChange={(e) => update({ compare: e.target.checked })} />
      </CardContent>
    </Card>
  );
}
