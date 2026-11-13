"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, RefreshCw, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui";

/** Synchronisation manuelle d'un compte : POST /api/accounts/[id]/sync (route de l'agent back). */
export function SyncButton({ accountId, label }: { accountId: string; label: string }) {
  const t = useTranslations("settings.accounts.sync");
  const router = useRouter();
  const [state, setState] = useState<"idle" | "busy" | "ok" | "unavailable" | "error">("idle");

  const run = async () => {
    setState("busy");
    try {
      const res = await fetch(`/api/accounts/${accountId}/sync`, { method: "POST" });
      if (res.status === 404 || res.status === 405 || res.status === 501) return setState("unavailable");
      if (!res.ok) return setState("error");
      setState("ok");
      router.refresh();
    } catch {
      setState("error");
    }
  };

  return (
    <span className="inline-flex items-center gap-2">
      <span aria-live="polite" className="text-xs">
        {state === "ok" && <span className="inline-flex items-center gap-1 text-positive"><Check size={13} aria-hidden />{t("done")}</span>}
        {state === "unavailable" && <span className="inline-flex items-center gap-1 text-ink-3"><TriangleAlert size={13} aria-hidden />{t("unavailable")}</span>}
        {state === "error" && <span className="inline-flex items-center gap-1 text-negative"><TriangleAlert size={13} aria-hidden />{t("error")}</span>}
      </span>
      <Button size="sm" onClick={run} disabled={state === "busy"} aria-label={`${t("action")} — ${label}`}>
        {state === "busy" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />}
        <span className="hidden sm:inline">{state === "busy" ? t("running") : t("action")}</span>
      </Button>
    </span>
  );
}
