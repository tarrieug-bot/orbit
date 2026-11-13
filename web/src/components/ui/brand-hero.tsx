import type { AccountStatus, Network } from "@/lib/db/types";
import { cn } from "@/lib/utils";
import { Avatar } from "./avatar";
import { NetworkIcon } from "./network-icon";

export interface BrandHeroAccount {
  id: string;
  network: Network;
  handle: string | null;
  name?: string | null;
  avatarUrl?: string | null;
  /** abonnés formatés (« 12,8 k ») */
  followers?: string | null;
  /** libellé traduit (« abonnés ») */
  followersLabel?: string;
  status?: AccountStatus;
  /** libellé traduit du statut, affiché si ≠ active */
  statusLabel?: string;
  /** lien (profil public ou page interne) */
  href?: string | null;
}

export interface BrandHeroStat {
  label: string;
  value: string;
  /** élément à droite de la valeur (<Delta/>) */
  delta?: React.ReactNode;
}

export interface BrandHeroProps {
  name: string;
  avatarUrl?: string | null;
  /** couleur de la marque (hex) — dérive le dégradé de fond */
  color: string;
  sector?: string | null;
  /** petite ligne au-dessus du nom (ex. « Analytics · 30 derniers jours ») */
  eyebrow?: React.ReactNode;
  accounts: BrandHeroAccount[];
  /** 2 à 4 chiffres clés affichés à droite */
  stats?: BrandHeroStat[];
  /** boutons (rapport, export…) */
  actions?: React.ReactNode;
  /** contenu additionnel sous les comptes (onglets…) */
  children?: React.ReactNode;
  size?: "md" | "lg";
  className?: string;
}

/**
 * Bandeau de tête d'une marque : grande photo, nom, secteur, une puce par compte
 * (avatar + logo + handle + abonnés) ; fond dégradé dérivé de la couleur de la marque.
 */
export function BrandHero({ name, avatarUrl, color, sector, eyebrow, accounts, stats, actions, children, size = "lg", className }: BrandHeroProps) {
  const bg = `radial-gradient(120% 160% at 0% 0%, color-mix(in srgb, ${color} 30%, transparent) 0%, transparent 55%), radial-gradient(90% 140% at 100% 0%, color-mix(in srgb, ${color} 14%, transparent) 0%, transparent 60%), linear-gradient(180deg, color-mix(in srgb, ${color} 6%, var(--color-surface)), var(--color-surface))`;
  return (
    <section className={cn("relative overflow-hidden rounded-hero border border-line shadow-card", className)} style={{ background: bg }}>
      {/* motif orbital discret */}
      <svg aria-hidden className="pointer-events-none absolute -top-24 -right-24 h-80 w-80 opacity-[0.5]" viewBox="0 0 200 200" fill="none">
        <circle cx="100" cy="100" r="98" stroke={`color-mix(in srgb, ${color} 25%, transparent)`} />
        <circle cx="100" cy="100" r="70" stroke={`color-mix(in srgb, ${color} 20%, transparent)`} />
        <circle cx="100" cy="100" r="42" stroke={`color-mix(in srgb, ${color} 15%, transparent)`} />
        <circle cx="30" cy="170" r="4" fill={`color-mix(in srgb, ${color} 45%, transparent)`} />
      </svg>
      <div className={cn("relative flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between", size === "lg" ? "p-6 sm:p-8" : "p-5 sm:p-6")}>
        <div className="flex min-w-0 flex-col gap-5 sm:flex-row sm:items-center">
          <span className="relative inline-flex shrink-0 rounded-[30%] shadow-raised">
            <Avatar src={avatarUrl} name={name} color={color} size={size === "lg" ? "2xl" : "xl"} shape="rounded" />
          </span>
          <div className="min-w-0">
            {eyebrow && <div className="mb-1 text-xs font-medium text-ink-2">{eyebrow}</div>}
            <h1 className={cn("truncate font-semibold tracking-[-0.025em] text-ink", size === "lg" ? "text-[28px] leading-9 sm:text-[32px] sm:leading-10" : "text-2xl")}>{name}</h1>
            {sector && (
              <p className="mt-1 flex items-center gap-2 text-sm text-ink-2">
                <span aria-hidden className="h-2 w-2 rounded-full" style={{ background: color }} />
                {sector}
              </p>
            )}
            {accounts.length > 0 && (
              <ul className="mt-4 flex flex-wrap gap-2">
                {accounts.map((a) => (
                  <li key={a.id}>
                    <AccountChip account={a} brandName={name} />
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
        {(stats?.length || actions) && (
          <div className="flex shrink-0 flex-col gap-4 lg:items-end">
            {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
            {stats && stats.length > 0 && (
              <dl className="flex flex-wrap gap-x-8 gap-y-3">
                {stats.map((s) => (
                  <div key={s.label}>
                    <dt className="text-xs font-medium text-ink-2">{s.label}</dt>
                    <dd className="mt-0.5 flex items-baseline gap-2">
                      <span className="text-xl font-semibold tracking-tight text-ink tabular">{s.value}</span>
                      {s.delta}
                    </dd>
                  </div>
                ))}
              </dl>
            )}
          </div>
        )}
      </div>
      {children && <div className="relative border-t border-line/70 bg-surface/60 px-4 backdrop-blur-sm sm:px-6">{children}</div>}
    </section>
  );
}

function AccountChip({ account: a, brandName }: { account: BrandHeroAccount; brandName: string }) {
  const warn = a.status && a.status !== "active";
  const body = (
    <>
      <Avatar src={a.avatarUrl} name={a.name ?? a.handle ?? brandName} size="sm" network={a.network} ring />
      <span className="min-w-0 leading-tight">
        <span className="flex items-center gap-1.5 text-[13px] font-semibold text-ink">
          <span className="truncate">{a.handle ?? a.name}</span>
          <NetworkIcon network={a.network} size={12} />
        </span>
        {(a.followers || (warn && a.statusLabel)) && (
          <span className="block text-[11.5px] text-ink-2">
            {a.followers && (
              <>
                <span className="font-semibold text-ink tabular">{a.followers}</span> {a.followersLabel}
              </>
            )}
            {warn && a.statusLabel && <span className={cn("ml-1.5 font-medium", a.status === "expiring" ? "text-warning" : "text-negative")}>· {a.statusLabel}</span>}
          </span>
        )}
      </span>
    </>
  );
  const cls = "flex items-center gap-2.5 rounded-pill border border-line bg-surface/85 py-1 pr-3.5 pl-1 shadow-soft backdrop-blur-md transition-colors";
  return a.href ? (
    <a href={a.href} target={a.href.startsWith("http") ? "_blank" : undefined} rel="noreferrer noopener" className={cn(cls, "hover:border-line-strong hover:bg-surface")}>
      {body}
    </a>
  ) : (
    <span className={cls}>{body}</span>
  );
}
