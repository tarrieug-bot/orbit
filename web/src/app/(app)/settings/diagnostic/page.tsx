import { getLocale, getTranslations } from "next-intl/server";
import { CheckCircle2, XCircle } from "lucide-react";
import { PageHeader } from "@/components/views/page-header";
import { Avatar, Card, CardHeader, EmptyState, KpiTile, NetworkIcon, StatusBadge, type StatusKind } from "@/components/ui";
import { getConnectedAccounts, getSyncRuns } from "@/lib/db";
import type { AppLocale, SyncStatus } from "@/lib/db/types";
import { formatNumber, INTL_LOCALE } from "@/lib/metrics";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("settings.diagnostic.title") };
}

const RUN: Record<SyncStatus, StatusKind> = { success: "success", partial: "warning", error: "critical", running: "info" };

/** Diagnostic : journal de collecte (sync_runs) lisible, appel par appel. */
export default async function DiagnosticPage() {
  const [runs, accounts] = await Promise.all([getSyncRuns({ limit: 150 }), getConnectedAccounts()]);
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const byId = new Map(accounts.map((a) => [a.id, a]));
  const calls = runs.flatMap((r) => r.details?.calls ?? []);
  const okCalls = calls.filter((c) => c.ok).length;
  const errors = runs.filter((r) => r.status === "error").length;
  const dt = (iso: string) => new Date(iso).toLocaleString(INTL_LOCALE[locale], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Martinique" });
  const duration = (a: string, b: string | null) => (b ? Math.max(0, Math.round((new Date(b).getTime() - new Date(a).getTime()) / 1000)) : null);

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.diagnostic.title")} description={t("settings.diagnostic.subtitle")} />
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        <KpiTile label={t("settings.diagnostic.accounts")} value={formatNumber(accounts.length, locale)} />
        <KpiTile label={t("settings.diagnostic.runs")} value={formatNumber(runs.length, locale)} />
        <KpiTile label={t("settings.diagnostic.okCalls")} value={formatNumber(okCalls, locale)} note={calls.length ? t("settings.diagnostic.ofCalls", { total: formatNumber(calls.length, locale) }) : undefined} />
        <KpiTile label={t("settings.diagnostic.errors")} value={formatNumber(errors, locale)} />
      </div>

      {runs.length === 0 ? (
        <EmptyState illustration="chart" title={t("settings.diagnostic.empty")} description={t("settings.diagnostic.emptyHelp")} />
      ) : (
        <Card className="overflow-hidden">
          <CardHeader title={t("settings.diagnostic.journal")} description={t("settings.diagnostic.journalHelp")} />
          <ul className="divide-y divide-line/70 border-t border-line/70">
            {runs.map((r) => {
              const a = r.account_id ? byId.get(r.account_id) : null;
              const c = r.details?.calls ?? [];
              const ko = c.filter((x) => !x.ok);
              const secs = duration(r.started_at, r.finished_at);
              return (
                <li key={r.id}>
                  <details className="group">
                    <summary className="flex cursor-pointer list-none flex-wrap items-center gap-x-4 gap-y-2 px-5 py-3 transition-colors hover:bg-surface-2 focus-visible:bg-surface-2 focus-visible:outline-none [&::-webkit-details-marker]:hidden">
                      <span className="tabular w-28 shrink-0 text-xs text-ink-2">{dt(r.started_at)}</span>
                      <span className="flex min-w-0 flex-1 basis-48 items-center gap-2.5">
                        {a ? <Avatar src={a.avatarUrl} name={a.handle ?? a.name ?? ""} color={a.brand.color} size="sm" network={a.network} /> : <span className="h-7 w-7 rounded-full bg-surface-3" />}
                        <span className="min-w-0">
                          <span className="flex items-center gap-1.5 truncate text-[13px] font-semibold text-ink">
                            {a && <NetworkIcon network={a.network} size={12} />}
                            {a?.handle ?? a?.name ?? t("settings.diagnostic.global")}
                          </span>
                          <span className="block truncate text-xs text-ink-3">{a?.brand.name}</span>
                        </span>
                      </span>
                      <span className="text-xs text-ink-2">
                        {t(`settings.diagnostic.kind.${["daily", "posts", "audience", "backfill", "profile"].includes(r.kind) ? r.kind : "other"}`)} · {t(`settings.diagnostic.trigger.${["cron", "manual", "connect"].includes(r.trigger) ? r.trigger : "other"}`)}
                        {secs != null && <span className="text-ink-3"> · {secs} s</span>}
                      </span>
                      {c.length > 0 && (
                        <span className="tabular text-xs text-ink-2">
                          {t("settings.accounts.calls", { ok: c.length - ko.length, total: c.length })}
                        </span>
                      )}
                      <StatusBadge status={RUN[r.status]}>{t(`settings.diagnostic.status.${r.status}`)}</StatusBadge>
                    </summary>
                    <div className="space-y-2 bg-surface-2/60 px-5 py-3">
                      {r.error && <p className="text-xs font-medium text-negative">{r.error}</p>}
                      {r.range_from && <p className="text-xs text-ink-2">{t("settings.diagnostic.range", { from: r.range_from, to: r.range_to ?? r.range_from })}</p>}
                      {c.length > 0 ? (
                        <ul className="grid gap-1.5 sm:grid-cols-2 lg:grid-cols-3">
                          {c.map((x, i) => (
                            <li key={`${x.metric}-${i}`} className="flex items-start gap-2 rounded-lg bg-surface px-2.5 py-1.5 text-xs shadow-soft">
                              {x.ok ? <CheckCircle2 size={14} className="mt-px shrink-0 text-positive" aria-label="OK" /> : <XCircle size={14} className="mt-px shrink-0 text-negative" aria-label={t("settings.diagnostic.status.error")} />}
                              <span className="min-w-0">
                                <code className="font-mono text-[11.5px] text-ink">{x.metric}</code>
                                {x.values != null && <span className="text-ink-3"> · {t("settings.diagnostic.values", { count: x.values })}</span>}
                                {x.message && <span className="block break-words text-ink-2">{x.message}</span>}
                              </span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-xs text-ink-3">{t("settings.diagnostic.noCalls")}</p>
                      )}
                    </div>
                  </details>
                </li>
              );
            })}
          </ul>
        </Card>
      )}
    </div>
  );
}
