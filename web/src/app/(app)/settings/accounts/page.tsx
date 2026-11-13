import Link from "next/link";
import { getLocale, getTranslations } from "next-intl/server";
import { Clock, KeyRound, Plus } from "lucide-react";
import { SyncButton } from "@/components/views/sync-button";
import { PageHeader } from "@/components/views/page-header";
import { Avatar, Badge, buttonVariants, Card, EmptyState, NetworkIcon, StatusBadge, type StatusKind } from "@/components/ui";
import { getConnectedAccounts, listBrands } from "@/lib/db";
import type { AccountStatus, AppLocale, Network, SyncStatus } from "@/lib/db/types";
import { formatCompact, INTL_LOCALE } from "@/lib/metrics";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("nav.accounts") };
}

const STATUS: Record<AccountStatus, StatusKind> = { active: "success", expiring: "warning", pending: "info", expired: "critical", error: "critical", disconnected: "info" };
const RUN: Record<SyncStatus, StatusKind> = { success: "success", partial: "warning", error: "critical", running: "info" };
const SOON: Network[] = ["tt", "li", "yt"];

/** Comptes connectés : statut, dernière synchro, connexion Meta, synchro manuelle. */
export default async function AccountsSettingsPage() {
  const [accounts, brands] = await Promise.all([getConnectedAccounts(), listBrands()]);
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(INTL_LOCALE[locale], { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: "America/Martinique" }) : "—");
  const d = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "short", year: "numeric" }) : "—");
  const daysLeft = (iso: string | null) => (iso ? Math.round((new Date(iso).getTime() - Date.now()) / 86_400_000) : null);

  return (
    <div className="space-y-6">
      <PageHeader
        title={t("settings.accounts.title")}
        description={t("settings.accounts.subtitle")}
        actions={
          <a href="/api/meta/connect" className={buttonVariants({ variant: "primary" })}>
            <Plus size={15} aria-hidden />
            <NetworkIcon network="fb" variant="mono" size={14} />
            <NetworkIcon network="ig" variant="mono" size={14} />
            {t("settings.accounts.connect")}
          </a>
        }
      />

      {brands.length === 0 && <EmptyState illustration="accounts" title={t("settings.accounts.empty")} description={t("settings.accounts.emptyHelp")} />}

      {brands.map((b) => {
        const accs = accounts.filter((a) => a.brand.id === b.id);
        return (
          <Card key={b.id} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-3 border-b border-line/70 bg-surface-2/60 px-5 py-3.5">
              <Avatar src={b.avatarUrl} name={b.name} color={b.color} size="md" shape="rounded" />
              <div className="min-w-0 flex-1">
                <Link href={`/brands/${b.id}`} className="font-semibold text-ink hover:underline">{b.name}</Link>
                {b.sector && <p className="text-xs text-ink-2">{b.sector}</p>}
              </div>
              <Link href="/settings/clients" className={buttonVariants({ size: "sm", variant: "ghost" })}>{t("settings.accounts.clientAccess")}</Link>
            </div>
            <ul className="divide-y divide-line/70">
              {accs.map((a) => {
                const left = daysLeft(a.tokenExpiresAt);
                const calls = a.lastRun?.details?.calls ?? [];
                const failed = calls.filter((c) => !c.ok).length;
                return (
                  <li key={a.id} className="flex flex-wrap items-center gap-x-5 gap-y-3 px-5 py-4">
                    <div className="flex min-w-0 flex-1 basis-60 items-center gap-3">
                      <Avatar src={a.avatarUrl} name={a.name ?? a.handle ?? b.name} color={b.color} size="lg" network={a.network} />
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-semibold text-ink">
                          <NetworkIcon network={a.network} size={14} />
                          <span className="truncate">{a.handle ?? a.name}</span>
                        </div>
                        <p className="tabular text-xs text-ink-2">
                          {t(`network.${a.network}`)} · <b className="font-semibold text-ink">{formatCompact(a.followersCount ?? 0, locale)}</b> {t("kpi.followers.label").toLowerCase()}
                        </p>
                      </div>
                    </div>
                    <StatusBadge status={STATUS[a.status]}>{t(`settings.accounts.status.${a.status}`)}</StatusBadge>
                    <div className="min-w-44 text-xs text-ink-2">
                      <p className="flex items-center gap-1.5">
                        <Clock size={12} aria-hidden className="text-ink-3" />
                        {t("settings.accounts.lastSync", { date: dt(a.lastSyncedAt) })}
                      </p>
                      {a.lastRun && (
                        <p className="mt-1 flex items-center gap-1.5">
                          <StatusBadge status={RUN[a.lastRun.status]} size="sm">{t(`settings.diagnostic.status.${a.lastRun.status}`)}</StatusBadge>
                          {calls.length > 0 && <span className="text-ink-3">{t("settings.accounts.calls", { ok: calls.length - failed, total: calls.length })}</span>}
                        </p>
                      )}
                    </div>
                    <div className="min-w-40 text-xs text-ink-2">
                      <p className="flex items-center gap-1.5">
                        <KeyRound size={12} aria-hidden className="text-ink-3" />
                        {t("settings.accounts.tokenExpires", { date: d(a.tokenExpiresAt) })}
                      </p>
                      {left != null && <p className={left < 10 ? "mt-1 font-medium text-warning" : "mt-1 text-ink-3"}>{t("settings.accounts.daysLeft", { days: left })}</p>}
                      {a.statusMessage && <p className="mt-1 text-negative">{a.statusMessage}</p>}
                    </div>
                    <SyncButton accountId={a.id} label={a.handle ?? a.name ?? ""} />
                  </li>
                );
              })}
              <li className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px] text-ink-3">
                {SOON.map((n) => (
                  <span key={n} className="inline-flex items-center gap-1.5 rounded-pill border border-dashed border-line-strong px-2.5 py-1">
                    <span className="opacity-60 grayscale"><NetworkIcon network={n} size={14} /></span>
                    {t(`network.${n}`)}
                  </span>
                ))}
                <Badge tone="outline">{t("common.comingSoon")}</Badge>
              </li>
            </ul>
          </Card>
        );
      })}
    </div>
  );
}
