"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BarChart3, FileText, Grid2x2, LayoutDashboard, Link2, LogOut, Megaphone, Search, Users, UserRoundCog } from "lucide-react";
import { Avatar, NetworkIcon } from "@/components/ui";
import { cn, initials } from "@/lib/utils";
import { OrbitLogo } from "./orbit-logo";
import type { ShellBrand, ShellUser } from "./types";

/** Paramètres de filtres conservés d'une page à l'autre. */
const FILTER_KEYS = ["period", "from", "to", "nets", "compare"];

function withFilters(href: string, sp: URLSearchParams, extra?: Record<string, string>) {
  const out = new URLSearchParams();
  FILTER_KEYS.forEach((k) => sp.get(k) && out.set(k, sp.get(k)!));
  Object.entries(extra ?? {}).forEach(([k, v]) => out.set(k, v));
  const q = out.toString();
  return q ? `${href}?${q}` : href;
}

export function Sidebar({ user, brands, demo }: { user: ShellUser; brands: ShellBrand[]; demo: boolean }) {
  const t = useTranslations();
  const pathname = usePathname();
  const sp = useSearchParams();
  const [query, setQuery] = useState("");
  const activeBrandId = pathname.match(/^\/brands\/([^/]+)/)?.[1] ?? sp.get("brand");
  const current = brands.find((b) => b.id === activeBrandId) ?? brands[0];

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? brands.filter((b) => b.name.toLowerCase().includes(q) || b.accounts.some((a) => a.handle?.toLowerCase().includes(q))) : brands;
  }, [brands, query]);

  const brandParam = current ? { brand: current.id } : undefined;
  const nav = user.isAgency
    ? [
        { href: "/", label: t("nav.overview"), icon: LayoutDashboard, active: pathname === "/" },
        { href: "/audience", label: t("nav.audience"), icon: Users, active: pathname.startsWith("/audience"), extra: brandParam },
        { href: "/campaigns", label: t("nav.campaigns"), icon: Megaphone, active: pathname.startsWith("/campaigns"), extra: brandParam },
        { href: "/reports", label: t("nav.reports"), icon: FileText, active: pathname.startsWith("/reports"), extra: brandParam },
      ]
    : current
      ? [
          current.sections.includes("analytics") && { href: `/brands/${current.id}`, label: t("nav.analytics"), icon: BarChart3, active: pathname === `/brands/${current.id}` },
          current.sections.includes("posts") && { href: `/brands/${current.id}/posts`, label: t("nav.posts"), icon: Grid2x2, active: pathname.endsWith("/posts") },
          current.sections.includes("audience") && { href: "/audience", label: t("nav.audience"), icon: Users, active: pathname.startsWith("/audience"), extra: brandParam },
          current.sections.includes("campaigns") && { href: "/campaigns", label: t("nav.campaigns"), icon: Megaphone, active: pathname.startsWith("/campaigns"), extra: brandParam },
          current.sections.includes("reports") && { href: "/reports", label: t("nav.reports"), icon: FileText, active: pathname.startsWith("/reports"), extra: brandParam },
        ].filter((x): x is Exclude<typeof x, false> => Boolean(x))
      : [];

  const settings = user.isAgency
    ? [
        { href: "/settings/accounts", label: t("nav.accounts"), icon: Link2, active: pathname.startsWith("/settings/accounts") },
        { href: "/settings/clients", label: t("nav.clients"), icon: UserRoundCog, active: pathname.startsWith("/settings/clients") },
      ]
    : [];

  return (
    <aside className="sticky top-0 flex h-dvh w-[264px] shrink-0 flex-col bg-sidebar text-sidebar-ink">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-[radial-gradient(ellipse_at_top_left,rgba(129,140,248,0.22),transparent_70%)]" />
      <div className="relative px-5 pt-5 pb-4">
        <Link href="/" className="text-white">
          <OrbitLogo />
        </Link>
      </div>

      <nav className="relative space-y-0.5 px-3">
        {nav.map((item) => (
          <NavLink key={item.href} href={withFilters(item.href, sp, item.extra)} active={item.active} icon={<item.icon size={17} />}>
            {item.label}
          </NavLink>
        ))}
      </nav>

      <div className="relative mt-5 flex min-h-0 flex-1 flex-col">
        <div className="flex items-center justify-between px-5 pb-2 text-[11px] font-semibold tracking-wider text-sidebar-mute uppercase">
          <span>{t("common.brands")}</span>
          <span className="tabular">{brands.length}</span>
        </div>
        {user.isAgency && (
          <div className="px-3 pb-2">
            <label className="flex h-8 items-center gap-2 rounded-control bg-sidebar-2 px-2.5 text-sidebar-mute ring-1 ring-white/5 focus-within:ring-orbit-400/60">
              <Search size={14} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.searchBrands")}
                className="w-full bg-transparent text-[13px] text-sidebar-ink placeholder:text-sidebar-mute focus:outline-none"
              />
            </label>
          </div>
        )}
        <ul className="min-h-0 flex-1 space-y-0.5 overflow-y-auto px-3 pb-3">
          {filtered.map((b) => {
            const active = b.id === activeBrandId && (pathname.startsWith("/brands/") || !user.isAgency);
            const target = b.sections.includes("analytics") ? `/brands/${b.id}` : `/brands/${b.id}/posts`;
            return (
              <li key={b.id}>
                <Link
                  href={withFilters(target, sp)}
                  className={cn(
                    "group flex items-center gap-3 rounded-control px-2 py-1.5 transition-colors",
                    active ? "bg-white/10 text-white" : "text-sidebar-ink/85 hover:bg-white/5 hover:text-white",
                  )}
                >
                  <Avatar src={b.avatarUrl} name={b.name} color={b.color} size="sm" shape="rounded" />
                  <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{b.name}</span>
                  <span className="flex items-center gap-1 opacity-80 group-hover:opacity-100">
                    {b.networks.map((n) => (
                      <NetworkIcon key={n} network={n} size={13} variant={active ? "brand" : "mono"} className={active ? "" : "text-sidebar-mute"} />
                    ))}
                  </span>
                </Link>
              </li>
            );
          })}
          {!filtered.length && <li className="px-2 py-2 text-[13px] text-sidebar-mute">{t("common.noBrand")}</li>}
        </ul>
      </div>

      {settings.length > 0 && (
        <nav className="relative space-y-0.5 border-t border-white/5 px-3 py-3">
          {settings.map((item) => (
            <NavLink key={item.href} href={item.href} active={item.active} icon={<item.icon size={17} />}>
              {item.label}
            </NavLink>
          ))}
        </nav>
      )}

      <div className="relative flex items-center gap-3 border-t border-white/5 px-4 py-3">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-orbit-gradient text-[11px] font-semibold text-white">{initials(user.fullName ?? user.email)}</span>
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] font-medium text-white">{user.fullName ?? user.email}</div>
          <div className="truncate text-[11px] text-sidebar-mute">{demo ? t("common.demoMode") : t(`login.role.${user.role}`)}</div>
        </div>
        <form action="/auth/signout" method="post">
          <button type="submit" title={t("common.signOut")} className="rounded-control p-1.5 text-sidebar-mute hover:bg-white/5 hover:text-white">
            <LogOut size={16} />
          </button>
        </form>
      </div>
    </aside>
  );
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      className={cn(
        "flex items-center gap-3 rounded-control px-2.5 py-2 text-[13.5px] font-medium transition-colors",
        active ? "bg-white/10 text-white shadow-[inset_2px_0_0_0_var(--color-orbit-400)]" : "text-sidebar-ink/75 hover:bg-white/5 hover:text-white",
      )}
    >
      <span className={active ? "text-orbit-300" : "text-sidebar-mute"}>{icon}</span>
      {children}
    </Link>
  );
}

