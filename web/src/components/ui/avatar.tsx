"use client";

import { useState } from "react";
import type { Network } from "@/lib/db/types";
import { cn, initials } from "@/lib/utils";
import { NetworkIcon } from "./network-icon";

const SIZES = {
  xs: { box: 20, text: "text-[9px]", badge: 10 },
  sm: { box: 28, text: "text-[11px]", badge: 13 },
  md: { box: 36, text: "text-xs", badge: 15 },
  lg: { box: 48, text: "text-sm", badge: 18 },
  xl: { box: 64, text: "text-lg", badge: 22 },
} as const;

export interface AvatarProps {
  /** photo de profil (Page FB, compte IG, marque) */
  src?: string | null;
  /** nom pour l'attribut alt et les initiales de repli */
  name: string;
  size?: keyof typeof SIZES;
  /** couleur de fond des initiales (couleur de la marque) */
  color?: string;
  /** pastille du réseau en bas à droite */
  network?: Network;
  shape?: "circle" | "rounded";
  className?: string;
}

/**
 * Photo de profil avec repli sur les initiales (image absente ou URL Meta expirée)
 * et pastille réseau optionnelle.
 */
export function Avatar({ src, name, size = "md", color = "#6366F1", network, shape = "circle", className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const s = SIZES[size];
  const radius = shape === "circle" ? "rounded-full" : "rounded-[28%]";
  return (
    <span className={cn("relative inline-flex shrink-0", className)} style={{ width: s.box, height: s.box }}>
      {src && !failed ? (
        // URL externes signées (CDN Meta) : <img> simple, sans optimisation Next.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={src}
          alt={name}
          width={s.box}
          height={s.box}
          loading="lazy"
          referrerPolicy="no-referrer"
          onError={() => setFailed(true)}
          className={cn("h-full w-full object-cover ring-1 ring-black/5", radius)}
        />
      ) : (
        <span
          aria-label={name}
          role="img"
          className={cn("flex h-full w-full items-center justify-center font-semibold text-white ring-1 ring-black/5", radius, s.text)}
          style={{ background: `linear-gradient(135deg, ${color}, color-mix(in srgb, ${color} 65%, #000))` }}
        >
          {initials(name)}
        </span>
      )}
      {network && (
        <span className="absolute -right-1 -bottom-1">
          <NetworkIcon network={network} variant="badge" size={s.badge} />
        </span>
      )}
    </span>
  );
}

/** Pile d'avatars (ex. comptes d'une marque). */
export function AvatarGroup({ children, className }: { children: React.ReactNode; className?: string }) {
  return <span className={cn("flex -space-x-2 [&>*]:ring-2 [&>*]:ring-white [&>*]:rounded-full", className)}>{children}</span>;
}
