import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ChevronRight } from "lucide-react";
import { OrbitLogo } from "@/components/shell/orbit-logo";
import { NetworkIcon } from "@/components/ui";
import { homePathFor } from "@/lib/auth/guards";
import { getSessionUser } from "@/lib/db";
import { DEMO_USERS } from "@/lib/db/demo";
import { isDemoMode } from "@/lib/env";
import { initials } from "@/lib/utils";
import { demoSignIn } from "./actions";
import { LoginForm } from "./login-form";

export const metadata = { title: "Connexion" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const sp = await searchParams;
  const demo = isDemoMode();
  if (!demo) {
    const user = await getSessionUser().catch(() => null);
    if (user) redirect(await homePathFor(user));
  }
  const t = await getTranslations();
  const next = sp.next && sp.next.startsWith("/") && !sp.next.startsWith("//") ? sp.next : "/";

  return (
    <div className="relative flex min-h-dvh items-center justify-center overflow-hidden bg-sidebar p-6">
      <div className="pointer-events-none absolute -top-40 -left-40 h-[520px] w-[520px] rounded-full bg-orbit-600/30 blur-3xl" />
      <div className="pointer-events-none absolute -right-32 -bottom-48 h-[480px] w-[480px] rounded-full bg-fuchsia-500/20 blur-3xl" />
      <div className="relative w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-4 text-white">
          <OrbitLogo size={44} withText={false} />
          <div className="text-center">
            <h1 className="text-2xl font-semibold tracking-tight">{demo ? t("login.demoTitle") : t("login.title")}</h1>
            <p className="mt-1 text-sm text-sidebar-mute">{demo ? t("login.demoSubtitle") : t("login.subtitle")}</p>
          </div>
          <div className="flex items-center gap-3 opacity-90">
            <NetworkIcon network="ig" variant="badge" size={26} />
            <NetworkIcon network="fb" variant="badge" size={26} />
          </div>
        </div>
        <div className="rounded-[20px] bg-surface p-6 shadow-pop">
          {demo ? (
            <ul className="space-y-2">
              {DEMO_USERS.map((u) => (
                <li key={u.email}>
                  <form action={demoSignIn}>
                    <input type="hidden" name="email" value={u.email} />
                    <button type="submit" className="flex w-full items-center gap-3 rounded-control border border-line px-3 py-2.5 text-left transition-all hover:border-orbit-300 hover:bg-orbit-50/50">
                      <span className="flex h-9 w-9 items-center justify-center rounded-full bg-orbit-gradient text-xs font-semibold text-white">{initials(u.fullName)}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-medium text-ink">{u.fullName}</span>
                        <span className="block truncate text-xs text-ink-2">{t(`login.role.${u.role}`)} · {u.email}</span>
                      </span>
                      <ChevronRight size={16} className="text-ink-3" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <LoginForm next={next} linkError={sp.error === "link"} />
          )}
        </div>
        <p className="mt-6 text-center text-xs text-sidebar-mute">{t("app.tagline")}</p>
      </div>
    </div>
  );
}
