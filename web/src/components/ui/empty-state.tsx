import { cn } from "@/lib/utils";

export type EmptyIllustration = "chart" | "posts" | "search" | "accounts" | "audience" | "reports" | "campaigns" | "error" | "lock";

export interface EmptyStateProps {
  icon?: React.ReactNode;
  /** illustration SVG originale (prioritaire sur icon) */
  illustration?: EmptyIllustration;
  title: string;
  description?: string;
  action?: React.ReactNode;
  /** compact : sans bordure, moins d'espace (dans une carte) */
  compact?: boolean;
  className?: string;
}

export function EmptyState({ icon, illustration, title, description, action, compact, className }: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center",
        compact ? "px-4 py-8" : "rounded-card border border-dashed border-line-strong bg-surface/60 px-6 py-14",
        className,
      )}
    >
      {illustration ? (
        <EmptyArt kind={illustration} className="mb-5" />
      ) : (
        icon && <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-orbit-50 text-orbit-600 ring-1 ring-orbit-100">{icon}</div>
      )}
      <h3 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-sm text-balance text-ink-2">{description}</p>}
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

/** Illustrations originales simples (traits fins, accent Orbit), adaptées au thème. */
export function EmptyArt({ kind, size = 120, className }: { kind: EmptyIllustration; size?: number; className?: string }) {
  const s = "var(--color-line-strong)";
  const f = "var(--color-surface)";
  const a = "var(--color-orbit-500)";
  const a2 = "var(--color-orbit-200)";
  const m = "var(--color-surface-3)";
  return (
    <svg width={size} height={size * 0.75} viewBox="0 0 160 120" fill="none" aria-hidden className={className}>
      {/* orbite décorative */}
      <ellipse cx="80" cy="62" rx="70" ry="44" stroke={m} strokeWidth="1.5" strokeDasharray="3 5" />
      <circle cx="148" cy="52" r="4" fill={a2} />
      <circle cx="14" cy="76" r="3" fill={a2} />
      {kind === "chart" && (
        <g>
          <rect x="38" y="26" width="84" height="64" rx="10" fill={f} stroke={s} strokeWidth="1.5" />
          <path d="M50 76 66 60l12 8 18-22 14 10" stroke={a} strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
          <circle cx="96" cy="46" r="4" fill={f} stroke={a} strokeWidth="2.5" />
          <path d="M50 82h60" stroke={m} strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {kind === "posts" && (
        <g>
          <rect x="34" y="34" width="40" height="50" rx="8" fill={f} stroke={s} strokeWidth="1.5" transform="rotate(-8 54 59)" />
          <rect x="86" y="34" width="40" height="50" rx="8" fill={f} stroke={s} strokeWidth="1.5" transform="rotate(8 106 59)" />
          <rect x="58" y="26" width="44" height="56" rx="9" fill={f} stroke={s} strokeWidth="1.5" />
          <rect x="64" y="32" width="32" height="28" rx="5" fill={a2} />
          <path d="m66 56 10-10 8 7 6-5 6 8" stroke={a} strokeWidth="2" strokeLinejoin="round" />
          <path d="M64 68h24M64 74h16" stroke={m} strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
      {kind === "search" && (
        <g>
          <circle cx="74" cy="56" r="24" fill={f} stroke={s} strokeWidth="1.5" />
          <circle cx="74" cy="56" r="15" stroke={a} strokeWidth="2.5" />
          <path d="m92 74 16 16" stroke={a} strokeWidth="5" strokeLinecap="round" />
          <path d="M68 52h12M68 59h8" stroke={a2} strokeWidth="2.5" strokeLinecap="round" />
        </g>
      )}
      {kind === "accounts" && (
        <g>
          <circle cx="58" cy="60" r="20" fill={f} stroke={s} strokeWidth="1.5" />
          <circle cx="58" cy="54" r="6" fill={a2} />
          <path d="M47 71a12 12 0 0 1 22 0" stroke={a2} strokeWidth="3" strokeLinecap="round" />
          <circle cx="104" cy="60" r="20" fill={f} stroke={s} strokeWidth="1.5" strokeDasharray="4 4" />
          <path d="M104 52v16M96 60h16" stroke={a} strokeWidth="2.5" strokeLinecap="round" />
          <path d="M79 60h4" stroke={s} strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {kind === "audience" && (
        <g>
          <rect x="40" y="28" width="80" height="62" rx="10" fill={f} stroke={s} strokeWidth="1.5" />
          {[0, 1, 2, 3, 4].map((i) => (
            <rect key={i} x={52 + i * 12} y={76 - [16, 28, 36, 22, 12][i]} width="8" height={[16, 28, 36, 22, 12][i]} rx="3" fill={i === 2 ? a : a2} />
          ))}
          <path d="M50 80h60" stroke={m} strokeWidth="2" strokeLinecap="round" />
        </g>
      )}
      {kind === "reports" && (
        <g>
          <rect x="52" y="22" width="56" height="72" rx="8" fill={f} stroke={s} strokeWidth="1.5" />
          <path d="M62 36h28M62 44h20" stroke={m} strokeWidth="3" strokeLinecap="round" />
          <rect x="62" y="54" width="8" height="22" rx="2.5" fill={a2} />
          <rect x="74" y="60" width="8" height="16" rx="2.5" fill={a2} />
          <rect x="86" y="48" width="8" height="28" rx="2.5" fill={a} />
          <circle cx="108" cy="88" r="11" fill={a} />
          <path d="m103 88 4 4 6-7" stroke="#fff" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      )}
      {kind === "campaigns" && (
        <g>
          <path d="M50 52v18l12 2 34 14V36L62 50z" fill={f} stroke={s} strokeWidth="1.5" strokeLinejoin="round" />
          <path d="M62 50v22" stroke={s} strokeWidth="1.5" />
          <path d="M104 50h10M102 40l8-5M102 62l8 5" stroke={a} strokeWidth="2.5" strokeLinecap="round" />
          <path d="m56 72 4 14h8l-3-13" fill={a2} />
        </g>
      )}
      {kind === "error" && (
        <g>
          <circle cx="80" cy="58" r="28" fill={f} stroke={s} strokeWidth="1.5" />
          <path d="M80 44v18" stroke="var(--color-negative)" strokeWidth="4" strokeLinecap="round" />
          <circle cx="80" cy="72" r="2.8" fill="var(--color-negative)" />
        </g>
      )}
      {kind === "lock" && (
        <g>
          <rect x="58" y="52" width="44" height="36" rx="8" fill={f} stroke={s} strokeWidth="1.5" />
          <path d="M66 52v-8a14 14 0 0 1 28 0v8" stroke={a} strokeWidth="3" />
          <circle cx="80" cy="68" r="4" fill={a} />
          <path d="M80 72v6" stroke={a} strokeWidth="3" strokeLinecap="round" />
        </g>
      )}
    </svg>
  );
}
