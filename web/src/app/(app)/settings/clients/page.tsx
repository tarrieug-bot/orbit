import { getLocale, getTranslations } from "next-intl/server";
import { History, ShieldCheck } from "lucide-react";
import { ClientSectionsEditor, InviteClientButton } from "@/components/views/client-access";
import { PageHeader } from "@/components/views/page-header";
import { Avatar, Badge, Card, CardHeader, NetworkIcon } from "@/components/ui";
import { getAccessLogs, getClientAccess, listBrands } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";
import { isDemoMode } from "@/lib/env";
import { INTL_LOCALE } from "@/lib/metrics";
import { initials } from "@/lib/utils";

export async function generateMetadata() {
  const t = await getTranslations();
  return { title: t("nav.clients") };
}

/** Accès clients (lecture seule) : invitations, rubriques visibles, retrait, journal des connexions. */
export default async function ClientsSettingsPage() {
  const [rows, brands, logs] = await Promise.all([getClientAccess(), listBrands(), getAccessLogs(30)]);
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const demo = isDemoMode();
  const dt = (iso: string | null) => (iso ? new Date(iso).toLocaleString(INTL_LOCALE[locale], { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "America/Martinique" }) : t("settings.clients.never"));
  const users = new Map(rows.map((r) => [r.userId, r]));
  const brandById = new Map(brands.map((b) => [b.id, b]));

  return (
    <div className="space-y-6">
      <PageHeader title={t("settings.clients.title")} description={t("settings.clients.subtitle")} />
      <p className="flex items-start gap-2.5 rounded-card border border-line bg-surface px-4 py-3 text-[13px] text-ink-2 shadow-soft">
        <ShieldCheck size={17} className="mt-0.5 shrink-0 text-positive" aria-hidden />
        {t("settings.clients.readOnlyNote")}
      </p>

      <div className="grid gap-6 xl:grid-cols-2">
        {brands.map((b) => {
          const clients = rows.filter((r) => r.brandId === b.id);
          return (
            <Card key={b.id} className="overflow-hidden">
              <div className="flex flex-wrap items-center gap-3 border-b border-line/70 px-5 py-4">
                <Avatar src={b.avatarUrl} name={b.name} color={b.color} size="md" shape="rounded" />
                <div className="min-w-0 flex-1">
                  <h3 className="font-semibold text-ink">{b.name}</h3>
                  <p className="flex items-center gap-1.5 text-xs text-ink-2">
                    {b.networks.map((n) => <NetworkIcon key={n} network={n} size={12} />)}
                    {t("settings.clients.count", { count: clients.length })}
                  </p>
                </div>
                <InviteClientButton brandId={b.id} brandName={b.name} demo={demo} />
              </div>
              {clients.length === 0 ? (
                <p className="px-5 py-6 text-sm text-ink-2">{t("settings.clients.none")}</p>
              ) : (
                <ul className="divide-y divide-line/70">
                  {clients.map((c) => (
                    <li key={c.userId} className="space-y-2.5 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-orbit-50 text-xs font-semibold text-orbit-700">{initials(c.fullName ?? c.email)}</span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-semibold text-ink">{c.fullName ?? c.email}</p>
                          <p className="truncate text-xs text-ink-2">{c.email}</p>
                        </div>
                        <Badge tone="brand">{c.locale === "en" ? "🇬🇧 EN" : "🇫🇷 FR"}</Badge>
                      </div>
                      <p className="text-xs text-ink-3">{t("settings.clients.lastSeenAt", { date: dt(c.lastSeenAt) })}</p>
                      <ClientSectionsEditor userId={c.userId} brandId={b.id} sections={c.sections} label={c.fullName ?? c.email} />
                    </li>
                  ))}
                </ul>
              )}
            </Card>
          );
        })}
      </div>

      <Card>
        <CardHeader title={t("settings.clients.logTitle")} description={t("settings.clients.logHelp")} action={<History size={18} className="text-ink-3" aria-hidden />} />
        {logs.length === 0 ? (
          <p className="px-5 pb-5 text-sm text-ink-2">{t("settings.clients.logEmpty")}</p>
        ) : (
          <ul className="divide-y divide-line/70 border-t border-line/70">
            {logs.map((l) => {
              const u = users.get(l.user_id);
              const b = l.brand_id ? brandById.get(l.brand_id) : null;
              return (
                <li key={l.id} className="flex flex-wrap items-center gap-3 px-5 py-3 text-[13px]">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-3 text-[10px] font-semibold text-ink-2">{initials(u?.fullName ?? u?.email ?? "?")}</span>
                  <span className="min-w-0 flex-1 truncate text-ink">
                    <b className="font-semibold">{u?.fullName ?? u?.email ?? l.user_id.slice(0, 8)}</b> · {t(`settings.clients.events.${l.event === "login" ? "login" : "other"}`)}
                  </span>
                  {b && (
                    <span className="flex items-center gap-1.5 text-xs text-ink-2">
                      <Avatar src={b.avatarUrl} name={b.name} color={b.color} size="xs" />
                      {b.name}
                    </span>
                  )}
                  <span className="tabular text-xs text-ink-3">{dt(l.created_at)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}
