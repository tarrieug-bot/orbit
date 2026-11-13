"use client";

import { useActionState, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, MailCheck, Trash2, UserPlus } from "lucide-react";
import { Button, Callout } from "@/components/ui";
import { BRAND_SECTIONS, type BrandSection } from "@/lib/db/types";
import { inviteClientAction, removeClientAction, updateSectionsAction, type ClientFormState } from "@/app/(app)/settings/clients/actions";
import { Dialog } from "./dialog";
import { CheckChip, Field, Input } from "./form";
import { Select } from "@/components/ui";

/** Inviter un client (e-mail, nom, langue, rubriques). */
export function InviteClientButton({ brandId, brandName, demo }: { brandId: string; brandName: string; demo: boolean }) {
  const t = useTranslations("settings.clients");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const [open, setOpen] = useState(false);
  const [n, setN] = useState(0);
  return (
    <>
      <Button size="sm" variant="primary" onClick={() => { setN((x) => x + 1); setOpen(true); }}>
        <UserPlus size={14} aria-hidden />
        {t("invite")}
      </Button>
      <Dialog open={open} onClose={() => setOpen(false)} title={t("inviteTitle", { brand: brandName })} description={t("inviteHelp")} closeLabel={tc("close")}>
        <InviteForm key={n} brandId={brandId} demo={demo} onDone={() => setOpen(false)} />
      </Dialog>
    </>
  );
}

function InviteForm({ brandId, demo, onDone }: { brandId: string; demo: boolean; onDone: () => void }) {
  const t = useTranslations("settings.clients");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const [state, action, pending] = useActionState(inviteClientAction, { status: "idle" } as ClientFormState);
  const setOpen = (_v: boolean) => onDone();
  return (
    <>
        {state.status === "ok" ? (
          <div className="space-y-4">
            <Callout status="success" title={t("invited", { email: state.email ?? "" })}>
              {state.emailed ? t("invitedEmailed") : demo ? t("invitedDemo") : t("invitedExisting")}
            </Callout>
            <div className="flex justify-end">
              <Button variant="primary" onClick={() => setOpen(false)}>
                <Check size={15} aria-hidden />
                {tc("close")}
              </Button>
            </div>
          </div>
        ) : (
          <form action={action} className="space-y-4">
            <input type="hidden" name="brandId" value={brandId} />
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("name")} htmlFor="i-name">
                <Input id="i-name" name="fullName" placeholder={t("namePlaceholder")} maxLength={120} />
              </Field>
              <Field label={t("email")} htmlFor="i-email" error={state.status === "error" && state.error === "email" ? t("errors.email") : null}>
                <Input id="i-email" name="email" type="email" required placeholder="client@exemple.fr" autoComplete="off" />
              </Field>
            </div>
            <Field label={t("language")} htmlFor="i-lang" hint={t("languageHint")}>
              <Select id="i-lang" name="locale" defaultValue="fr" wrapperClassName="w-full" className="w-full">
                <option value="fr">Français</option>
                <option value="en">English</option>
              </Select>
            </Field>
            <fieldset>
              <legend className="mb-1.5 text-[13px] font-medium text-ink">{t("sections")}</legend>
              <div className="flex flex-wrap gap-2">
                {BRAND_SECTIONS.map((s) => (
                  <CheckChip key={s} name="sections" value={s} defaultChecked={s !== "campaigns"} label={tn(s)} />
                ))}
              </div>
            </fieldset>
            <p className="text-xs text-ink-3">{t("readOnlyNote")}</p>
            {state.status === "error" && state.error !== "email" && (
              <p role="alert" className="rounded-control bg-negative-soft px-3 py-2 text-sm text-negative">{t(`errors.${["forbidden", "sections", "already_exists", "invalid", "invite_unavailable"].includes(state.error ?? "") ? state.error : "failed"}`)}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button onClick={() => setOpen(false)}>{tc("cancel")}</Button>
              <Button type="submit" variant="primary" disabled={pending}>
                {pending ? <Loader2 size={15} className="animate-spin" aria-hidden /> : <MailCheck size={15} aria-hidden />}
                {t("send")}
              </Button>
            </div>
          </form>
        )}
    </>
  );
}

/** Rubriques visibles (enregistrées à chaque changement) + retrait de l'accès. */
export function ClientSectionsEditor({ userId, brandId, sections, label }: { userId: string; brandId: string; sections: BrandSection[]; label: string }) {
  const t = useTranslations("settings.clients");
  const tn = useTranslations("nav");
  const tc = useTranslations("common");
  const [current, setCurrent] = useState(sections);
  const [pending, start] = useTransition();
  const [saved, setSaved] = useState<boolean | null>(null);
  const [confirm, setConfirm] = useState(false);

  const toggle = (s: BrandSection, on: boolean) => {
    const next = BRAND_SECTIONS.filter((x) => (x === s ? on : current.includes(x)));
    if (!next.length) return;
    setCurrent(next);
    const fd = new FormData();
    fd.set("userId", userId);
    fd.set("brandId", brandId);
    next.forEach((x) => fd.append("sections", x));
    start(async () => setSaved((await updateSectionsAction(fd)).ok));
  };

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="sr-only">{t("sections")}</span>
      {BRAND_SECTIONS.map((s) => (
        <CheckChip key={s} label={tn(s)} checked={current.includes(s)} onChange={(e) => toggle(s, e.target.checked)} disabled={current.length === 1 && current.includes(s)} className="px-2.5 py-1 text-xs" />
      ))}
      <span aria-live="polite" className="ml-1 inline-flex w-4 text-xs">
        {pending ? <Loader2 size={13} className="animate-spin text-ink-3" aria-label={tc("loading")} /> : saved === true ? <Check size={13} className="text-positive" aria-label={t("saved")} /> : null}
      </span>
      <Button size="icon" variant="ghost" onClick={() => setConfirm(true)} aria-label={`${t("remove")} — ${label}`} className="text-ink-3 hover:text-negative">
        <Trash2 size={15} aria-hidden />
      </Button>
      <Dialog open={confirm} onClose={() => setConfirm(false)} title={t("removeTitle")} description={t("removeHelp", { name: label })} closeLabel={tc("close")} size="sm">
        <form action={removeClientAction} onSubmit={() => setConfirm(false)} className="flex justify-end gap-2">
          <input type="hidden" name="userId" value={userId} />
          <input type="hidden" name="brandId" value={brandId} />
          <Button onClick={() => setConfirm(false)}>{tc("cancel")}</Button>
          <Button type="submit" variant="danger">{t("remove")}</Button>
        </form>
      </Dialog>
    </div>
  );
}
