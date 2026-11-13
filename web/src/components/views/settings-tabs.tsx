"use client";

import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { Activity, Link2, UserRoundCog } from "lucide-react";
import { Tabs } from "@/components/ui";

/** Sous-navigation des réglages (agence). */
export function SettingsTabs() {
  const t = useTranslations();
  const pathname = usePathname();
  const items = [
    { value: "accounts", href: "/settings/accounts", label: t("nav.accounts"), icon: <Link2 size={15} aria-hidden /> },
    { value: "clients", href: "/settings/clients", label: t("nav.clients"), icon: <UserRoundCog size={15} aria-hidden /> },
    { value: "diagnostic", href: "/settings/diagnostic", label: t("settings.diagnostic.title"), icon: <Activity size={15} aria-hidden /> },
  ];
  const value = items.find((i) => pathname.startsWith(i.href))?.value ?? "accounts";
  return <Tabs items={items} value={value} aria-label={t("nav.settings")} />;
}
