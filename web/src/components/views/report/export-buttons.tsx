"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FileDown, FileSpreadsheet, Loader2, Presentation } from "lucide-react";
import { Button, Callout } from "@/components/ui";
import type { ExportFormat } from "@/lib/db/types";
import type { ReportExportBody } from "./config";

const ICONS = { pdf: FileDown, pptx: Presentation, csv: FileSpreadsheet } as const;

function filenameFrom(res: Response, fallback: string): string {
  const cd = res.headers.get("Content-Disposition") ?? "";
  const star = /filename\*=UTF-8''([^;]+)/i.exec(cd);
  if (star) return decodeURIComponent(star[1]);
  const plain = /filename="?([^";]+)"?/i.exec(cd);
  return plain?.[1] ?? fallback;
}

/**
 * Export PDF / PowerPoint / CSV : POST /api/reports/export (route de l'agent back)
 * → fichier téléchargé. Gère le chargement, l'absence de la route et les erreurs.
 */
export function ExportButtons({ bodies, filename, disabled }: { bodies: Record<ExportFormat, ReportExportBody>; filename: string; disabled?: boolean }) {
  const t = useTranslations("reportBuilder.export");
  const [busy, setBusy] = useState<ExportFormat | null>(null);
  const [error, setError] = useState<"unavailable" | "failed" | "forbidden" | null>(null);

  const run = async (format: ExportFormat) => {
    setBusy(format);
    setError(null);
    try {
      const res = await fetch("/api/reports/export", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(bodies[format]) });
      const isJson = (res.headers.get("Content-Type") ?? "").includes("json");
      if ((res.status === 404 && !isJson) || res.status === 405 || res.status === 501) return setError("unavailable");
      if (res.status === 401 || res.status === 403) return setError("forbidden");
      if (!res.ok) return setError("failed");
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filenameFrom(res, `${filename}.${format}`);
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    } catch {
      setError("failed");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="space-y-3">
      <div className="flex flex-wrap gap-2">
        {(["pdf", "pptx", "csv"] as const).map((f) => {
          const Icon = ICONS[f];
          return (
            <Button key={f} variant={f === "pdf" ? "primary" : "secondary"} size="sm" disabled={disabled || busy !== null} onClick={() => run(f)} aria-busy={busy === f}>
              {busy === f ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Icon size={14} aria-hidden />}
              {busy === f ? t("working") : t(f)}
            </Button>
          );
        })}
      </div>
      <div aria-live="polite">{error && <Callout status={error === "unavailable" ? "info" : "critical"}>{t(`errors.${error}`)}</Callout>}</div>
    </div>
  );
}
