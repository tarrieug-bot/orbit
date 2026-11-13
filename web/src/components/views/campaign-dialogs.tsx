"use client";

import { useActionState, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui";
import type { ISODate } from "@/lib/db/types";
import { deleteCampaignAction, saveCampaignAction, type FormState } from "@/app/(app)/campaigns/actions";
import { Dialog } from "./dialog";
import { Field, Input, Textarea } from "./form";

export interface CampaignFormValue {
  id?: string;
  brandId: string;
  name: string;
  description: string;
  startsOn: ISODate;
  endsOn: ISODate;
  hashtags: string;
  color: string;
}

const COLORS = ["#6366F1", "#7C3AED", "#DB2777", "#E11D48", "#EA580C", "#CA8A04", "#16A34A", "#0891B2"];
const idle: FormState = { status: "idle" };

/** Bouton + modale de création / modification d'une campagne. */
export function CampaignFormButton({ value, mode }: { value: CampaignFormValue; mode: "create" | "edit" }) {
  const t = useTranslations("campaigns");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await saveCampaignAction(prev, fd);
    if (res.status === "ok") setOpen(false);
    return res;
  }, idle);
  const [color, setColor] = useState(value.color);

  return (
    <>
      {mode === "create" ? (
        <Button variant="primary" onClick={() => setOpen(true)}>
          <Plus size={15} aria-hidden />
          {t("new")}
        </Button>
      ) : (
        <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`${t("edit")} — ${value.name}`}>
          <Pencil size={14} aria-hidden />
          <span className="hidden sm:inline">{t("edit")}</span>
        </Button>
      )}
      <Dialog open={open} onClose={() => setOpen(false)} title={mode === "create" ? t("new") : t("editTitle")} description={t("formHelp")} closeLabel={tc("close")}>
        <form action={action} className="space-y-4">
          {value.id && <input type="hidden" name="id" value={value.id} />}
          <input type="hidden" name="brandId" value={value.brandId} />
          <input type="hidden" name="color" value={color} />
          <Field label={t("fields.name")} htmlFor="c-name">
            <Input id="c-name" name="name" required maxLength={120} defaultValue={value.name} placeholder={t("fields.namePlaceholder")} autoFocus />
          </Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label={t("fields.start")} htmlFor="c-start">
              <Input id="c-start" type="date" name="startsOn" required defaultValue={value.startsOn} />
            </Field>
            <Field label={t("fields.end")} htmlFor="c-end">
              <Input id="c-end" type="date" name="endsOn" required defaultValue={value.endsOn} />
            </Field>
          </div>
          <Field label={t("fields.hashtags")} htmlFor="c-tags" hint={t("fields.hashtagsHint")}>
            <Input id="c-tags" name="hashtags" defaultValue={value.hashtags} placeholder="#soldes #ete" />
          </Field>
          <Field label={t("fields.description")} htmlFor="c-desc">
            <Textarea id="c-desc" name="description" maxLength={500} defaultValue={value.description} />
          </Field>
          <fieldset>
            <legend className="mb-1.5 text-[13px] font-medium text-ink">{t("fields.color")}</legend>
            <div className="flex flex-wrap gap-2">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={c}
                  aria-pressed={color === c}
                  className="h-7 w-7 rounded-full ring-offset-2 transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-orbit-500 aria-pressed:ring-2 aria-pressed:ring-ink"
                  style={{ background: c }}
                />
              ))}
            </div>
          </fieldset>
          {state.status === "error" && <p role="alert" className="rounded-control bg-negative-soft px-3 py-2 text-sm text-negative">{t(`errors.${state.error === "forbidden" ? "forbidden" : state.error === "invalid" ? "invalid" : "failed"}`)}</p>}
          <div className="flex justify-end gap-2 pt-2">
            <Button onClick={() => setOpen(false)}>{tc("cancel")}</Button>
            <Button type="submit" variant="primary" disabled={pending}>
              {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
              {mode === "create" ? t("create") : tc("save")}
            </Button>
          </div>
        </form>
      </Dialog>
    </>
  );
}

/** Suppression d'une campagne, avec confirmation. */
export function CampaignDeleteButton({ id, name }: { id: string; name: string }) {
  const t = useTranslations("campaigns");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [state, action, pending] = useActionState(async (prev: FormState, fd: FormData) => {
    const res = await deleteCampaignAction(prev, fd);
    if (res.status === "ok") setOpen(false);
    return res;
  }, idle);
  return (
    <>
      <Button size="sm" variant="ghost" onClick={() => setOpen(true)} aria-label={`${t("delete")} — ${name}`} className="text-ink-3 hover:text-negative">
        <Trash2 size={14} aria-hidden />
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("deleteTitle")} description={t("deleteHelp", { name })} closeLabel={tc("close")}>
        <form action={action} className="flex justify-end gap-2">
          <input type="hidden" name="id" value={id} />
          {state.status === "error" && <p role="alert" className="mr-auto text-sm text-negative">{t("errors.failed")}</p>}
          <Button onClick={() => setOpen(false)}>{tc("cancel")}</Button>
          <Button type="submit" variant="danger" disabled={pending}>
            {pending && <Loader2 size={15} className="animate-spin" aria-hidden />}
            {t("delete")}
          </Button>
        </form>
      </Dialog>
    </>
  );
}
