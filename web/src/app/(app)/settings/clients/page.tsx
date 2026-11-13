import { getLocale, getTranslations } from "next-intl/server";
import { UserPlus } from "lucide-react";
import { Badge, Button, Card, CardHeader } from "@/components/ui";
import { requireAgency } from "@/lib/auth/guards";
import { getClientAccess } from "@/lib/db";
import type { AppLocale } from "@/lib/db/types";
import { INTL_LOCALE } from "@/lib/metrics";
import { initials } from "@/lib/utils";

/** Accès clients (lecture seule). Point de départ — propriété : front. */
export default async function ClientsSettingsPage() {
  await requireAgency();
  const rows = await getClientAccess();
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  return (
    <Card className="overflow-hidden">
      <CardHeader title={t("settings.clients.title")} action={<Button variant="primary" disabled><UserPlus size={15} />{t("settings.clients.invite")}</Button>} />
      <ul className="divide-y divide-line border-t border-line">
        {rows.map((r) => (
          <li key={`${r.userId}-${r.brandId}`} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-orbit-50 text-xs font-semibold text-orbit-700">{initials(r.fullName ?? r.email)}</span>
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-ink">{r.fullName ?? r.email}</div>
              <div className="text-xs text-ink-2">{r.email} · {r.brandName}</div>
            </div>
            <div className="flex flex-wrap gap-1">
              {r.sections.map((s) => <Badge key={s} tone="brand">{t(`nav.${s}`)}</Badge>)}
            </div>
            <Badge>{r.locale.toUpperCase()}</Badge>
            <span className="text-xs text-ink-3">
              {t("settings.clients.lastSeen")} : {r.lastSeenAt ? new Date(r.lastSeenAt).toLocaleDateString(INTL_LOCALE[locale]) : "—"}
            </span>
          </li>
        ))}
      </ul>
    </Card>
  );
}
