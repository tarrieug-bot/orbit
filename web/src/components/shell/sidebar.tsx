"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import { BarChart3, FileText, Grid2x2, LayoutDashboard, Link2, LogOut, Megaphone, Search, Users, UserRoundCog, X } from "lucide-react";
import { Avatar, NetworkIcon, ThemeToggle } from "@/components/ui";
import { cn, initials } from "@/lib/utils";
import { OrbitLogo } from "./orbit-logo";
import type { ShellBrand, ShellUser } from "./types";

/** Paramètres de filtres conservés d'une page à l'autre. */
/** Événement d'ouverture / fermeture de la navigation mobile (émis par la barre supérieure). */
export const NAV_EVENT = "orbit:nav";

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

  const [navOpen, setNavOpen] = useState(false);
  const [lastPath, setLastPath] = useState(pathname);
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setNavOpen(false);
  }
  useEffect(() => {
    const onNav = (e: Event) => setNavOpen((o) => ((e as CustomEvent<string>).detail === "close" ? false : !o));
    window.addEventListener(NAV_EVENT, onNav);
    return () => window.removeEventListener(NAV_EVENT, onNav);
  }, []);
  useEffect(() => {
    if (!navOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  return (
    <>
      {navOpen && <div aria-hidden onClick={() => setNavOpen(false)} className="fixed inset-0 z-40 bg-black/50 backdrop-blur-[2px] animate-fade-in lg:hidden" />}
      <aside
        className={cn(
          "fixed inset-y-0 left-0 z-50 flex h-dvh w-[272px] shrink-0 flex-col bg-sidebar text-sidebar-ink transition-transform duration-300 ease-out-soft lg:sticky lg:top-0 lg:z-auto lg:w-sidebar lg:translate-x-0",
          navOpen ? "translate-x-0 shadow-pop" : "-translate-x-full",
        )}
      >
        <div className="pointer-events-none absolute inset-x-0 top-0 h-48 bg-[radial-gradient(ellipse_at_top_left,rgba(122,71,227,0.28),transparent_65%)]" />
        <div className="pointer-events-none absolute inset-y-0 right-0 w-px bg-white/[0.06]" />
        <div className="relative flex items-center justify-between px-5 pt-5 pb-5">
          <Link href="/" className="rounded-control text-white">
            <OrbitLogo />
          </Link>
          <button type="button" onClick={() => setNavOpen(false)} aria-label={t("shell.closeMenu")} className="rounded-control p-1.5 text-sidebar-mute hover:bg-white/5 hover:text-white lg:hidden">
            <X size={18} />
          </button>
        </div>

        {user.isAgency && (
          <div className="relative px-3 pb-3">
            <label className="flex h-9 items-center gap-2 rounded-control bg-white/[0.04] px-2.5 text-sidebar-mute ring-1 ring-white/[0.06] transition-[box-shadow,background-color] focus-within:bg-white/[0.07] focus-within:ring-orbit-400/60">
              <Search size={15} />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("common.searchBrands")}
                aria-label={t("common.searchBrands")}
                className="w-full bg-transparent text-[13px] text-sidebar-ink placeholder:text-sidebar-mute focus:outline-none"
              />
            </label>
          </div>
        )}

        <nav className="relative space-y-px px-3">
          {nav.map((item) => (
            <NavLink key={item.href} href={withFilters(item.href, sp, item.extra)} active={item.active} icon={<item.icon size={17} strokeWidth={1.9} />}>
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="relative mt-6 flex min-h-0 flex-1 flex-col">
          <div className="flex items-center justify-between px-5 pb-2 text-[10.5px] font-semibold tracking-[0.08em] text-sidebar-mute uppercase">
            <span>{t("common.brands")}</span>
            <span className="tabular rounded-pill bg-white/[0.06] px-1.5 py-px text-[10px]">{brands.length}</span>
          </div>
          <ul className="min-h-0 flex-1 space-y-px overflow-y-auto px-3 pb-3 [scrollbar-color:var(--color-sidebar-3)_transparent]">
            {filtered.map((b) => {
              const active = b.id === activeBrandId && (pathname.startsWith("/brands/") || !user.isAgency);
              const target = b.sections.includes("analytics") ? `/brands/${b.id}` : `/brands/${b.id}/posts`;
              return (
                <li key={b.id}>
                  <Link
                    href={withFilters(target, sp)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "group relative flex items-center gap-3 rounded-control px-2 py-1.5 transition-colors",
                      active ? "bg-white/[0.09] text-white" : "text-sidebar-ink/85 hover:bg-white/[0.05] hover:text-white",
                    )}
                  >
                    {active && <span aria-hidden className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full" style={{ background: b.color }} />}
                    <Avatar src={b.avatarUrl} name={b.name} color={b.color} size="sm" shape="rounded" />
                    <span className="min-w-0 flex-1 truncate text-[13.5px] font-medium">{b.name}</span>
                    <span className={cn("flex items-center gap-1 transition-opacity", active ? "opacity-100" : "opacity-60 group-hover:opacity-100")}>
                      {b.networks.map((n) => (
                        <NetworkIcon key={n} network={n} size={16} variant="badge" ring={false} className={active ? "" : "opacity-90 saturate-[.85]"} />
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
          <nav className="relative space-y-px border-t border-white/[0.06] px-3 py-3">
            {settings.map((item) => (
              <NavLink key={item.href} href={item.href} active={item.active} icon={<item.icon size={17} strokeWidth={1.9} />}>
                {item.label}
              </NavLink>
            ))}
          </nav>
        )}

        <div className="relative flex items-center gap-3 border-t border-white/[0.06] px-4 py-3">
          <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-orbit-gradient text-[11px] font-semibold text-white ring-2 ring-white/10">{initials(user.fullName ?? user.email)}</span>
          <div className="min-w-0 flex-1">
            <div className="truncate text-[13px] font-medium text-white">{user.fullName ?? user.email}</div>
            <div className="truncate text-[11px] text-sidebar-mute">{demo ? t("common.demoMode") : t(`login.role.${user.role}`)}</div>
          </div>
          <form action="/auth/signout" method="post">
            <button type="submit" title={t("common.signOut")} aria-label={t("common.signOut")} className="rounded-control p-1.5 text-sidebar-mute hover:bg-white/5 hover:text-white">
              <LogOut size={16} />
            </button>
          </form>
        </div>
        <div className="relative flex items-center justify-between px-4 pb-3 text-[11px] text-sidebar-mute">
          <span>{t("shell.theme.label")}</span>
          <ThemeToggle tone="sidebar" labels={{ light: t("shell.theme.light"), dark: t("shell.theme.dark"), system: t("shell.theme.system") }} />
        </div>
      </aside>
    </>
  );
}

function NavLink({ href, active, icon, children }: { href: string; active: boolean; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <Link
      href={href}
      aria-current={active ? "page" : undefined}
      className={cn(
        "relative flex items-center gap-3 rounded-control px-2.5 py-[7px] text-[13.5px] font-medium transition-colors",
        active ? "bg-white/[0.09] text-white" : "text-sidebar-ink/70 hover:bg-white/[0.05] hover:text-white",
      )}
    >
      {active && <span aria-hidden className="absolute top-2 bottom-2 -left-3 w-[3px] rounded-r-full bg-orbit-400" />}
      <span className={active ? "text-orbit-300" : "text-sidebar-mute"}>{icon}</span>
      {children}
    </Link>
  );
}
