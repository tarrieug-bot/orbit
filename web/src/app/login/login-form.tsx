"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { CheckCircle2, Loader2, Mail } from "lucide-react";
import { Button } from "@/components/ui";
import { sendMagicLink, type LoginState } from "./actions";

export function LoginForm({ next, linkError }: { next: string; linkError: boolean }) {
  const t = useTranslations("login");
  const [state, action, pending] = useActionState<LoginState, FormData>(sendMagicLink, { status: "idle" });

  if (state.status === "sent") {
    return (
      <div className="flex items-start gap-3 rounded-control bg-positive-soft p-4 text-sm text-positive">
        <CheckCircle2 size={18} className="mt-0.5 shrink-0" />
        <p>{t("sent", { email: state.email ?? "" })}</p>
      </div>
    );
  }
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="next" value={next} />
      <label className="block">
        <span className="mb-1.5 block text-sm font-medium text-ink">{t("email")}</span>
        <span className="flex h-11 items-center gap-2 rounded-control border border-line bg-surface px-3 shadow-soft focus-within:border-orbit-400 focus-within:shadow-glow">
          <Mail size={16} className="text-ink-3" />
          <input name="email" type="email" required autoComplete="email" autoFocus defaultValue={state.email} placeholder="prenom@agence.fr" className="w-full bg-transparent text-sm focus:outline-none" />
        </span>
      </label>
      {(state.status === "error" || linkError) && (
        <p className="text-sm text-negative">{t(state.status === "error" ? (state.message as "invalidEmail" | "sendFailed") : "linkError")}</p>
      )}
      <Button type="submit" variant="primary" size="lg" className="w-full justify-center" disabled={pending}>
        {pending && <Loader2 size={16} className="animate-spin" />}
        {t("submit")}
      </Button>
    </form>
  );
}
