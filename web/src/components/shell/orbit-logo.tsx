/** Logo Orbit : planète + anneau orbital. */
export function OrbitLogo({ size = 28, withText = true, className }: { size?: number; withText?: boolean; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden>
        <defs>
          <linearGradient id="orbit-logo-g" x1="0" y1="0" x2="1" y2="1">
            <stop offset="0" stopColor="#818CF8" />
            <stop offset="1" stopColor="#A855F7" />
          </linearGradient>
        </defs>
        <circle cx="16" cy="16" r="8" fill="url(#orbit-logo-g)" />
        <ellipse cx="16" cy="16" rx="14" ry="5.5" fill="none" stroke="url(#orbit-logo-g)" strokeWidth="1.8" transform="rotate(-28 16 16)" opacity=".9" />
        <circle cx="27.5" cy="10.2" r="2.2" fill="#F0ABFC" />
      </svg>
      {withText && <span className="text-[17px] font-semibold tracking-tight">Orbit</span>}
    </span>
  );
}
