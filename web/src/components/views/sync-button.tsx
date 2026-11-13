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
  const [state, setState] = useState<"idle" | "busy" | "ok" | "unavailable" | "error" | "reauth" | "demo" | "partial">("idle");

  const run = async () => {
    setState("busy");
    try {
      const res = await fetch(`/api/accounts/${accountId}/sync`, { method: "POST" });
      const json: unknown = (res.headers.get("Content-Type") ?? "").includes("json") ? await res.json().catch(() => null) : null;
      const body = (json ?? {}) as { error?: string; ok?: boolean; result?: { status?: string; reauthRequired?: boolean } };
      if (res.status === 409) {
        setState(body.error === "demo" ? "demo" : body.result?.reauthRequired ? "reauth" : "error");
        return router.refresh();
      }
      if ((res.status === 404 && !json) || res.status === 405 || res.status === 501) return setState("unavailable");
      if (!res.ok || body.ok === false) return setState("error");
      setState(body.result?.status === "partial" ? "partial" : "ok");
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
        {state === "partial" && <span className="inline-flex items-center gap-1 text-warning"><TriangleAlert size={13} aria-hidden />{t("partial")}</span>}
        {state === "demo" && <span className="inline-flex items-center gap-1 text-ink-3"><TriangleAlert size={13} aria-hidden />{t("demo")}</span>}
        {state === "reauth" && <span className="inline-flex items-center gap-1 text-negative"><TriangleAlert size={13} aria-hidden />{t("reauth")}</span>}
        {state === "error" && <span className="inline-flex items-center gap-1 text-negative"><TriangleAlert size={13} aria-hidden />{t("error")}</span>}
      </span>
      <Button size="sm" onClick={run} disabled={state === "busy"} aria-label={`${t("action")} — ${label}`}>
        {state === "busy" ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />}
        <span className="hidden sm:inline">{state === "busy" ? t("running") : t("action")}</span>
      </Button>
    </span>
  );
}
