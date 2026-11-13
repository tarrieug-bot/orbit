"use client";

import { useActionState, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { CalendarClock, Loader2, Mail, Plus, Trash2 } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader, NetworkIcon, Select } from "@/components/ui";
import type { AppLocale, Network, ReportFrequency } from "@/lib/db/types";
import { INTL_LOCALE } from "@/lib/metrics";
import { createScheduleAction, deleteScheduleAction, type ScheduleFormState } from "@/app/(app)/reports/actions";
import { Dialog } from "../dialog";
import { CheckChip, Field, Input, Switch } from "../form";
import { REPORT_SECTIONS, type ReportConfig } from "./config";

export interface ScheduleItem {
  id: string;
  brandId: string;
  name: string;
  frequency: ReportFrequency;
  recipients: string[];
  locale: AppLocale;
  format: string;
  nextRunAt: string | null;
}

const FREQS: ReportFrequency[] = ["monthly", "weekly", "quarterly", "yearly"];

/** Envois programmés (agence) : liste, création (langue, destinataires, fréquence), suppression. */
export function ReportSchedules({ items, brand, config }: { items: ScheduleItem[]; brand: { id: string; name: string; color: string; avatarUrl: string | null; networks: Network[] }; config: ReportConfig }) {
  const t = useTranslations("reportBuilder.schedules");
  const tb = useTranslations("reportBuilder");
  const tc = useTranslations("common");
  const tn = useTranslations("network");
  const locale = useLocale() as AppLocale;
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: ScheduleFormState, fd: FormData) => {
    const res = await createScheduleAction(prev, fd);
    if (res.status === "ok") setOpen(false);
    return res;
  }, { status: "idle" });
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "short", year: "numeric" }) : "—");

  return (
    <Card>
      <CardHeader
        title={t("title")}
        description={t("subtitle")}
        action={
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus size={14} aria-hidden />
            {t("new")}
          </Button>
        }
      />
      {items.length === 0 ? (
        <p className="px-5 pb-5 text-sm text-ink-2">{t("empty")}</p>
      ) : (
        <ul className="divide-y divide-line/70 border-t border-line/70">
          {items.map((s) => (
            <li key={s.id} className="flex items-start gap-3 px-5 py-3.5">
              <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orbit-50 text-orbit-700">
                <CalendarClock size={15} aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="truncate text-[13px] font-semibold text-ink">{s.name}</span>
                  <Badge tone="brand">{s.locale.toUpperCase()}</Badge>
                  <Badge tone="outline">{s.format.toUpperCase()}</Badge>
                </div>
                <p className="mt-0.5 text-xs text-ink-2">
                  {t(`freq.${s.frequency}`)} · {t("next", { date: date(s.nextRunAt) })}
                </p>
                <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-ink-3">
                  <Mail size={11} aria-hidden />
                  {s.recipients.join(", ")}
                </p>
              </div>
              <form action={deleteScheduleAction}>
                <input type="hidden" name="id" value={s.id} />
                <Button type="submit" size="icon" variant="ghost" aria-label={`${tc("delete")} — ${s.name}`} className="text-ink-3 hover:text-negative">
                  <Trash2 size={15} aria-hidden />
                </Button>
              </form>
            </li>
          ))}
        </ul>
      )}

      <Dialog open={open} onClose={() => setOpen(false)} title={t("new")} description={t("dialogHelp", { brand: brand.name })} closeLabel={tc("close")}>
        <form action={action} className="space-y-4">
          <input type="hidden" name="brandId" value={brand.id} />
          <div className="flex items-center gap-2.5 rounded-control border border-line bg-surface-2 px-3 py-2 text-sm font-medium">
            <Avatar src={brand.avatarUrl} name={brand.name} color={brand.color} size="xs" />
            {brand.name}
          </div>
          <Field label={t("name")} htmlFor="s-name">
            <Input id="s-name" name="name" required maxLength={120} defaultValue={t("defaultName", { brand: brand.name })} />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("frequency")} htmlFor="s-freq">
              <Select id="s-freq" name="frequency" defaultValue="monthly" wrapperClassName="w-full" className="w-full">
                {FREQS.map((f) => (
                  <option key={f} value={f}>{t(`freq.${f}`)}</option>
                ))}
              </Select>
            </Field>
            <Field label={t("kind")} htmlFor="s-kind">
              <Select id="s-kind" name="kind" defaultValue="month" wrapperClassName="w-full" className="w-full">
                <option value="month">{tb("types.month")}</option>
                <option value="year">{tb("types.year")}</option>
              </Select>
            </Field>
            <Field label={tb("language")} htmlFor="s-lang">
              <Select id="s-lang" name="locale" defaultValue={config.lang} wrapperClassName="w-full" className="w-full">
                <option value="fr">Français</option>
                <option value="en">English</option>
              </Select>
            </Field>
            <Field label={t("format")} htmlFor="s-format">
              <Select id="s-format" name="format" defaultValue="pdf" wrapperClassName="w-full" className="w-full">
                <option value="pdf">PDF</option>
                <option value="pptx">PowerPoint</option>
                <option value="csv">CSV</option>
              </Select>
            </Field>
          </div>
          <Field label={t("recipients")} htmlFor="s-to" hint={t("recipientsHint")} error={state.status === "error" && state.error === "recipients" ? t("errors.recipients") : null}>
            <Input id="s-to" name="recipients" required placeholder="client@exemple.fr, equipe@agence.fr" />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink">{tb("networks")}</legend>
            <div className="flex flex-wrap gap-2">
              {brand.networks.map((n) => (
                <CheckChip key={n} name="networks" value={n} defaultChecked={config.networks.includes(n)} label={tn(n)} icon={<NetworkIcon network={n} size={14} />} />
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink">{tb("sections")}</legend>
            <div className="flex flex-wrap gap-2">
              {REPORT_SECTIONS.map((s) => (
                <CheckChip key={s} name="sections" value={s} defaultChecked={config.sections.includes(s)} label={tb(`sectionNames.${s}`)} />
              ))}
            </div>
          </fieldset>
          <Switch name="compare" label={tb("compare")} defaultChecked={config.compare} />
          {state.status === "error" && state.error !== "recipients" && (
            <p role="alert" className="rounded-control bg-negative-soft px-3 py-2 text-sm text-negative">{t(`errors.${state.error === "forbidden" ? "forbidden" : "failed"}`)}</p>
          )}
          <div className="flex justify-end gap-2 pt-1">
            <Button onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {t("submit")}
            </Button>
          </div>
        </form>
      </Dialog>
    </Card>
  );
}
