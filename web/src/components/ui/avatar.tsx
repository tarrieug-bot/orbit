"use client";

import { Children, useEffect, useRef, useState } from "react";
import type { Network } from "@/lib/db/types";
import { cn, initials } from "@/lib/utils";
import { NetworkIcon } from "./network-icon";

const SIZES = {
  xs: { box: 20, text: "text-[8.5px]", badge: 10, ring: 1.5 },
  sm: { box: 28, text: "text-[10.5px]", badge: 13, ring: 2 },
  md: { box: 36, text: "text-xs", badge: 15, ring: 2 },
  lg: { box: 48, text: "text-sm", badge: 18, ring: 2.5 },
  xl: { box: 64, text: "text-lg", badge: 22, ring: 3 },
  "2xl": { box: 96, text: "text-2xl", badge: 30, ring: 3.5 },
} as const;

export type AvatarSize = keyof typeof SIZES;
/** Anneau décoratif : dégradé Instagram, bleu Facebook, couleur de marque ou neutre. */
export type AvatarRing = "instagram" | "facebook" | "brand" | "neutral";

export interface AvatarProps {
  /** photo de profil (Page FB, compte IG, marque) */
  src?: string | null;
  /** nom pour l'attribut alt et les initiales de repli */
  name: string;
  size?: AvatarSize;
  /** couleur de fond des initiales et de l'anneau « brand » (couleur de la marque) */
  color?: string;
  /** pastille du réseau en bas à droite */
  network?: Network;
  shape?: "circle" | "rounded";
  /** anneau autour de la photo ; `true` = déduit du réseau (IG → dégradé, FB → bleu) */
  ring?: AvatarRing | boolean;
  className?: string;
}

/**
 * Photo de profil avec repli sur les initiales (image absente ou URL Meta expirée),
 * anneau optionnel et pastille réseau.
 */
export function Avatar({ src, name, size = "md", color = "#5944d9", network, shape = "circle", ring, className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const imgRef = useRef<HTMLImageElement>(null);
  // image en échec avant l'hydratation (rendu serveur) : onError n'a pas été capté
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) setFailed(true);
  }, [src]);
  const s = SIZES[size];
  const radius = shape === "circle" ? "rounded-full" : "rounded-[28%]";
  const ringKind: AvatarRing | null = ring === true ? (network === "ig" ? "instagram" : network === "fb" ? "facebook" : "brand") : ring || null;
  const gap = ringKind ? s.ring : 0;
  const inner = s.box - (gap ? gap * 4 : 0);

  const face =
    src && !failed ? (
      // URL externes signées (CDN Meta) : <img> simple, sans optimisation Next.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        ref={imgRef}
        src={src}
        alt={name}
        width={inner}
        height={inner}
        loading="lazy"
        referrerPolicy="no-referrer"
        onError={() => setFailed(true)}
        className={cn("h-full w-full bg-surface-3 object-cover", radius, !ringKind && "ring-1 ring-black/5 ring-inset")}
      />
    ) : (
      <span
        aria-label={name}
        role="img"
        className={cn("flex h-full w-full items-center justify-center font-semibold tracking-tight text-white select-none", radius, s.text)}
        style={{ background: `linear-gradient(140deg, color-mix(in srgb, ${color} 82%, #fff), ${color} 45%, color-mix(in srgb, ${color} 62%, #000))` }}
      >
        {initials(name)}
      </span>
    );

  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: s.box, height: s.box }} data-avatar>
      {ringKind ? (
        <span
          className={cn("flex h-full w-full items-center justify-center", radius, ringKind === "instagram" && "bg-instagram-linear", ringKind === "facebook" && "bg-facebook", ringKind === "neutral" && "bg-line-strong")}
          style={{ padding: gap, background: ringKind === "brand" ? color : undefined }}
        >
          <span className={cn("flex h-full w-full items-center justify-center bg-surface", radius)} style={{ padding: gap }}>
            {face}
          </span>
        </span>
      ) : (
        face
      )}
      {network && (
        <span className="absolute -right-[3px] -bottom-[3px]" style={size === "2xl" ? { right: 2, bottom: 2 } : undefined}>
          <NetworkIcon network={network} variant="badge" size={s.badge} />
        </span>
      )}
    </span>
  );
}

export interface AvatarGroupProps {
  children: React.ReactNode;
  /** nombre maximum d'avatars affichés ; le reste est résumé « +N » */
  max?: number;
  /** taille de la pastille « +N » (aligner sur la taille des avatars) */
  size?: AvatarSize;
  className?: string;
}

/** Pile d'avatars empilés (ex. comptes d'une marque). */
export function AvatarGroup({ children, max, size = "sm", className }: AvatarGroupProps) {
  const items = Children.toArray(children);
  const shown = max ? items.slice(0, max) : items;
  const rest = items.length - shown.length;
  const s = SIZES[size];
  return (
    <span className={cn("flex items-center -space-x-2", className)}>
      {shown.map((child, i) => (
        <span key={i} className="relative inline-flex rounded-full ring-2 ring-surface" style={{ zIndex: shown.length - i }}>
          {child}
        </span>
      ))}
      {rest > 0 && (
        <span
          className={cn("relative inline-flex items-center justify-center rounded-full bg-surface-3 font-semibold text-ink-2 ring-2 ring-surface tabular", s.text)}
          style={{ width: s.box, height: s.box }}
        >
          +{rest}
        </span>
      )}
    </span>
  );
}
