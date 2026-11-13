"use client";

import { useId } from "react";
import { FaFacebook, FaFacebookF, FaInstagram, FaLinkedin, FaLinkedinIn, FaTiktok, FaYoutube } from "react-icons/fa6";
import type { IconType } from "react-icons";
import type { Network } from "@/lib/db/types";
import { cn } from "@/lib/utils";

/** Libellés et couleurs officiels — source unique pour toute l'interface. */
export const NETWORK_META: Record<Network, { label: string; color: string; Icon: IconType; Glyph: IconType; bgClass: string; textClass: string }> = {
  ig: { label: "Instagram", color: "#D62976", Icon: FaInstagram, Glyph: FaInstagram, bgClass: "bg-instagram-gradient", textClass: "text-instagram" },
  fb: { label: "Facebook", color: "#1877F2", Icon: FaFacebook, Glyph: FaFacebookF, bgClass: "bg-facebook", textClass: "text-facebook" },
  tt: { label: "TikTok", color: "#000000", Icon: FaTiktok, Glyph: FaTiktok, bgClass: "bg-[#000]", textClass: "text-tiktok" },
  li: { label: "LinkedIn", color: "#0A66C2", Icon: FaLinkedin, Glyph: FaLinkedinIn, bgClass: "bg-linkedin", textClass: "text-linkedin" },
  yt: { label: "YouTube", color: "#FF0000", Icon: FaYoutube, Glyph: FaYoutube, bgClass: "bg-youtube", textClass: "text-youtube" },
};

export type NetworkIconVariant = "brand" | "badge" | "tile" | "mono";

export interface NetworkIconProps {
  network: Network;
  /** taille en px (côté de la pastille pour badge / tile) */
  size?: number;
  /**
   * brand : logo officiel en couleur (défaut)
   * badge : pastille ronde pleine (glyphe blanc sur fond réseau / dégradé Instagram)
   * tile  : pastille carrée arrondie (type icône d'app)
   * mono  : glyphe en currentColor
   */
  variant?: NetworkIconVariant;
  /** anneau de séparation autour d'une pastille (badge/tile), couleur = surface. Défaut : true pour badge. */
  ring?: boolean;
  /** présentation désactivée (réseau « bientôt ») */
  muted?: boolean;
  className?: string;
  title?: string;
}

/** Logo d'un réseau social (react-icons, jeu Font Awesome 6 brands). */
export function NetworkIcon({ network, size = 16, variant = "brand", ring, muted, className, title }: NetworkIconProps) {
  const meta = NETWORK_META[network];
  const label = title ?? meta.label;
  const gid = `ig-${useId().replace(/:/g, "")}`;
  const common = { role: "img" as const, "aria-label": label, title: label };

  if (variant === "badge" || variant === "tile") {
    const { Glyph } = meta;
    const withRing = ring ?? variant === "badge";
    const glyph = network === "yt" ? 0.62 : network === "fb" ? 0.56 : network === "tt" ? 0.52 : 0.58;
    return (
      <span
        {...common}
        className={cn(
          "relative inline-flex shrink-0 items-center justify-center overflow-hidden text-white",
          variant === "badge" ? "rounded-full" : "rounded-[28%]",
          meta.bgClass,
          withRing && "ring-2 ring-surface",
          muted && "opacity-40 grayscale",
          className,
        )}
        style={{ width: size, height: size }}
      >
        {network === "tt" ? (
          <TikTokGlyph size={Math.round(size * glyph)} />
        ) : (
          <Glyph aria-hidden size={Math.round(size * glyph)} className={network === "fb" ? "translate-y-[6%]" : undefined} />
        )}
      </span>
    );
  }

  if (variant === "mono") {
    const { Icon } = meta;
    return (
      <span {...common} className={cn("inline-flex shrink-0", muted && "opacity-40", className)}>
        <Icon aria-hidden size={size} />
      </span>
    );
  }

  // brand
  if (network === "ig") {
    return (
      <span {...common} className={cn("inline-flex shrink-0", muted && "opacity-40 grayscale", className)}>
        <svg width={0} height={0} className="absolute" aria-hidden focusable="false">
          <radialGradient id={gid} cx="0.3" cy="1.07" r="1.1">
            <stop offset="0" stopColor="#FEDA75" />
            <stop offset="0.28" stopColor="#FA7E1E" />
            <stop offset="0.52" stopColor="#D62976" />
            <stop offset="0.78" stopColor="#962FBF" />
            <stop offset="1" stopColor="#4F5BD5" />
          </radialGradient>
        </svg>
        <FaInstagram aria-hidden size={size} style={{ fill: `url(#${gid})` }} />
      </span>
    );
  }
  if (network === "tt") {
    return (
      <span {...common} className={cn("inline-flex shrink-0 text-tiktok", muted && "opacity-40", className)}>
        <TikTokGlyph size={size} />
      </span>
    );
  }
  const { Icon } = meta;
  // fb / li / yt : la découpe du logo laisse voir un fond blanc (comme le logo officiel)
  return (
    <span {...common} className={cn("relative inline-flex shrink-0", muted && "opacity-40 grayscale", className)} style={{ width: size, height: size }}>
      <span aria-hidden className={cn("absolute bg-white", network === "fb" ? "inset-[18%] rounded-full" : network === "yt" ? "inset-x-[30%] inset-y-[32%]" : "inset-[14%]")} />
      <Icon aria-hidden size={size} color={meta.color} className="relative" />
    </span>
  );
}

/** Glyphe TikTok avec ses deux « ombres » cyan / rouge. */
function TikTokGlyph({ size }: { size: number }) {
  const o = Math.max(1, size * 0.05);
  return (
    <span aria-hidden className="relative inline-flex" style={{ width: size, height: size }}>
      <FaTiktok size={size} color="#25F4EE" className="absolute" style={{ transform: `translate(${-o}px, ${-o}px)` }} />
      <FaTiktok size={size} color="#FE2C55" className="absolute" style={{ transform: `translate(${o}px, ${o}px)` }} />
      <FaTiktok size={size} className="relative" />
    </span>
  );
}

/** Rangée de logos (ex. réseaux connectés d'une marque). */
export function NetworkIconStack({ networks, size = 18, variant = "badge", className }: { networks: Network[]; size?: number; variant?: NetworkIconVariant; className?: string }) {
  return (
    <span className={cn("inline-flex items-center", variant === "badge" ? "-space-x-1.5" : "gap-1", className)}>
      {networks.map((n) => (
        <NetworkIcon key={n} network={n} size={size} variant={variant} />
      ))}
    </span>
  );
}
