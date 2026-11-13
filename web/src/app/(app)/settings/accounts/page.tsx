import { getLocale, getTranslations } from "next-intl/server";
import { Plus } from "lucide-react";
import { Avatar, Badge, Button, Card, CardHeader } from "@/components/ui";
import { requireAgency } from "@/lib/auth/guards";
import { getConnectedAccounts } from "@/lib/db";
import type { AccountStatus, AppLocale } from "@/lib/db/types";
import { formatCompact, INTL_LOCALE } from "@/lib/metrics";

const TONE: Record<AccountStatus, "positive" | "warning" | "negative" | "neutral"> = {
  active: "positive", expiring: "warning", pending: "neutral", expired: "negative", error: "negative", disconnected: "neutral",
};

/** Comptes connectés + état de la collecte. Point de départ — propriété : front (+ back pour l'OAuth). */
export default async function AccountsSettingsPage() {
  await requireAgency();
  const accounts = await getConnectedAccounts();
  const t = await getTranslations();
  const locale = (await getLocale()) as AppLocale;
  const date = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString(INTL_LOCALE[locale], { day: "numeric", month: "short", year: "numeric" }) : "—");
  return (
    <Card className="overflow-hidden">
      <CardHeader title={t("settings.accounts.title")} action={<Button variant="primary" disabled><Plus size={15} />{t("settings.accounts.connect")}</Button>} />
      <ul className="divide-y divide-line border-t border-line">
        {accounts.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-4 px-5 py-3.5">
            <Avatar src={a.avatarUrl} name={a.name ?? a.handle ?? ""} color={a.brand.color} size="lg" network={a.network} />
            <div className="min-w-0 flex-1">
              <div className="font-semibold text-ink">{a.handle}</div>
              <div className="text-xs text-ink-2">{a.brand.name} · {formatCompact(a.followersCount ?? 0, locale)} {t("kpi.followers.label").toLowerCase()}</div>
            </div>
            <div className="text-right text-xs text-ink-2">
              <div>{t("common.lastSync", { date: date(a.lastSyncedAt) })}</div>
              <div className="text-ink-3">{t("settings.accounts.tokenExpires", { date: date(a.tokenExpiresAt) })}</div>
            </div>
            <Badge tone={TONE[a.status]} dot>{t(`settings.accounts.status.${a.status}`)}</Badge>
          </li>
        ))}
      </ul>
    </Card>
  );
}
