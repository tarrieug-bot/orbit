import { useId } from "react";

/**
 * Logo Orbit (original) : tuile arrondie au dégradé Orbit, une orbite inclinée
 * et un satellite — lecture « suivre ce qui gravite autour de la marque ».
 */
export function OrbitLogo({ size = 28, withText = true, className }: { size?: number; withText?: boolean; className?: string }) {
  const id = useId().replace(/:/g, "");
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <OrbitMark size={size} id={id} />
      {withText && <span className="text-[17px] font-semibold tracking-[-0.02em]">Orbit</span>}
    </span>
  );
}

export function OrbitMark({ size = 28, id = "om" }: { size?: number; id?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 32 32" aria-hidden className="shrink-0">
      <defs>
        <linearGradient id={`${id}-bg`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#6d5ce8" />
          <stop offset="0.6" stopColor="#7a47e3" />
          <stop offset="1" stopColor="#b25ae8" />
        </linearGradient>
        <linearGradient id={`${id}-hl`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity=".28" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="9" fill={`url(#${id}-bg)`} />
      <rect width="32" height="16" rx="9" fill={`url(#${id}-hl)`} />
      {/* orbite (arc arrière plus discret) */}
      <path d="M6.2 19.6C4.6 16.9 9 12.4 16 10.2s12.3-1.6 13.1 1.3" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="1.6" strokeLinecap="round" />
      <circle cx="16" cy="16" r="5.6" fill="#fff" />
      <path d="M29.1 11.5c.8 2.9-3.7 7.4-10.7 9.6S6.9 22.4 6.2 19.6" fill="none" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="25.2" cy="18.6" r="2.1" fill="#fde68a" stroke="#7a47e3" strokeWidth="1" />
    </svg>
  );
}
