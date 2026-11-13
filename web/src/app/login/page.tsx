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
    <div className="relative grid min-h-dvh bg-canvas lg:grid-cols-[1.05fr_1fr]">
      {/* Panneau de marque */}
      <aside className="relative hidden overflow-hidden bg-sidebar p-10 text-white lg:flex lg:flex-col">
        <div className="pointer-events-none absolute -top-40 -left-32 h-[560px] w-[560px] rounded-full bg-[#5944d9]/35 blur-[120px]" />
        <div className="pointer-events-none absolute -right-40 bottom-[-180px] h-[520px] w-[520px] rounded-full bg-[#d62976]/20 blur-[120px]" />
        <svg aria-hidden className="pointer-events-none absolute top-1/2 left-1/2 h-[760px] w-[760px] -translate-x-1/2 -translate-y-1/2 opacity-[0.14]" viewBox="0 0 200 200" fill="none">
          <ellipse cx="100" cy="100" rx="96" ry="40" stroke="#fff" strokeWidth=".4" transform="rotate(-18 100 100)" />
          <ellipse cx="100" cy="100" rx="70" ry="28" stroke="#fff" strokeWidth=".4" transform="rotate(-18 100 100)" />
          <ellipse cx="100" cy="100" rx="44" ry="17" stroke="#fff" strokeWidth=".4" transform="rotate(-18 100 100)" />
        </svg>
        <div className="relative">
          <OrbitLogo size={34} />
        </div>
        <div className="relative my-auto max-w-md">
          <p className="text-[40px] leading-[1.08] font-semibold tracking-[-0.035em] text-balance">{t("app.tagline")}</p>
          <div className="mt-10 flex items-center gap-3">
            <NetworkIcon network="ig" variant="tile" size={40} />
            <NetworkIcon network="fb" variant="tile" size={40} />
            <span className="mx-1 h-6 w-px bg-white/15" />
            <NetworkIcon network="tt" variant="tile" size={32} muted />
            <NetworkIcon network="li" variant="tile" size={32} muted />
            <NetworkIcon network="yt" variant="tile" size={32} muted />
          </div>
          {/* aperçu décoratif */}
          <div aria-hidden className="mt-10 grid max-w-sm grid-cols-2 gap-3">
            {[
              { w: "w-16", bars: [40, 55, 48, 70, 62, 84, 78], c: "#8a7ef1" },
              { w: "w-12", bars: [30, 42, 38, 52, 68, 60, 76], c: "#fa7e1e" },
            ].map((card, i) => (
              <div key={i} className="rounded-2xl border border-white/10 bg-white/[0.04] p-4 backdrop-blur-sm">
                <div className={`h-2 ${card.w} rounded-full bg-white/25`} />
                <div className="mt-2.5 h-4 w-20 rounded-full bg-white/70" />
                <div className="mt-4 flex h-12 items-end gap-1">
                  {card.bars.map((h, j) => (
                    <span key={j} className="flex-1 rounded-t-[3px]" style={{ height: `${h}%`, background: card.c, opacity: 0.35 + j * 0.09 }} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
        <p className="relative text-xs text-sidebar-mute">© Orbit</p>
      </aside>

      {/* Formulaire */}
      <main className="relative flex items-center justify-center overflow-hidden p-6 sm:p-10">
        <div className="pointer-events-none absolute -top-48 right-[-120px] h-[420px] w-[420px] rounded-full bg-orbit-400/15 blur-[100px] lg:hidden" />
        <div className="relative w-full max-w-[400px]">
          <div className="mb-8 flex flex-col gap-5">
            <span className="lg:hidden">
              <OrbitLogo size={36} />
            </span>
            <div>
              <h1 className="text-[26px] leading-8 font-semibold tracking-[-0.025em] text-ink">{demo ? t("login.demoTitle") : t("login.title")}</h1>
              <p className="mt-1.5 text-sm text-ink-2">{demo ? t("login.demoSubtitle") : t("login.subtitle")}</p>
            </div>
          </div>
          {demo ? (
            <ul className="space-y-2">
              {DEMO_USERS.map((u) => (
                <li key={u.email}>
                  <form action={demoSignIn}>
                    <input type="hidden" name="email" value={u.email} />
                    <button
                      type="submit"
                      className="group flex w-full items-center gap-3 rounded-[14px] border border-line bg-surface px-3.5 py-3 text-left shadow-soft transition-all hover:-translate-y-px hover:border-orbit-300 hover:shadow-raised focus-visible:shadow-glow focus-visible:outline-none"
                    >
                      <span
                        className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-xs font-semibold text-white ${u.role === "client" ? "bg-[linear-gradient(140deg,#1baf7a,#0f766e)]" : "bg-orbit-gradient"}`}
                      >
                        {initials(u.fullName)}
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{u.fullName}</span>
                        <span className="block truncate text-xs text-ink-2">
                          {t(`login.role.${u.role}`)} · {u.email}
                        </span>
                      </span>
                      <ChevronRight size={16} className="text-ink-3 transition-transform group-hover:translate-x-0.5 group-hover:text-orbit-600" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          ) : (
            <div className="rounded-[20px] border border-line bg-surface p-6 shadow-raised">
              <LoginForm next={next} linkError={sp.error === "link"} />
            </div>
          )}
          <p className="mt-8 text-center text-xs text-ink-3 lg:hidden">{t("app.tagline")}</p>
        </div>
      </main>
    </div>
  );
}
