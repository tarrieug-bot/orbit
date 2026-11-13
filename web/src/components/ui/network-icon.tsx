"use client";

import { FaFacebook, FaInstagram, FaLinkedin, FaTiktok, FaYoutube } from "react-icons/fa6";
import type { IconType } from "react-icons";
import type { Network } from "@/lib/db/types";
import { cn } from "@/lib/utils";

/** Libellés et couleurs officiels — source unique pour toute l'interface. */
export const NETWORK_META: Record<Network, { label: string; color: string; Icon: IconType; bgClass: string; textClass: string }> = {
  ig: { label: "Instagram", color: "#DD2A7B", Icon: FaInstagram, bgClass: "bg-instagram-gradient", textClass: "text-instagram" },
  fb: { label: "Facebook", color: "#1877F2", Icon: FaFacebook, bgClass: "bg-facebook", textClass: "text-facebook" },
  tt: { label: "TikTok", color: "#010101", Icon: FaTiktok, bgClass: "bg-tiktok", textClass: "text-tiktok" },
  li: { label: "LinkedIn", color: "#0A66C2", Icon: FaLinkedin, bgClass: "bg-linkedin", textClass: "text-linkedin" },
  yt: { label: "YouTube", color: "#FF0000", Icon: FaYoutube, bgClass: "bg-youtube", textClass: "text-youtube" },
};

export interface NetworkIconProps {
  network: Network;
  /** taille en px */
  size?: number;
  /**
   * brand  : logo dans sa couleur officielle (défaut)
   * badge  : pastille ronde pleine (logo blanc sur fond réseau / dégradé Instagram)
   * mono   : logo en currentColor
   */
  variant?: "brand" | "badge" | "mono";
  className?: string;
  title?: string;
}

/** Logo d'un réseau social (react-icons, jeu Font Awesome 6 brands). */
export function NetworkIcon({ network, size = 16, variant = "brand", className, title }: NetworkIconProps) {
  const meta = NETWORK_META[network];
  const { Icon } = meta;
  const label = title ?? meta.label;
  if (variant === "badge") {
    return (
      <span
        role="img"
        aria-label={label}
        title={label}
        className={cn("inline-flex shrink-0 items-center justify-center rounded-full text-white ring-2 ring-white", meta.bgClass, className)}
        style={{ width: size, height: size }}
      >
        <Icon aria-hidden size={Math.round(size * 0.6)} />
      </span>
    );
  }
  if (variant === "brand" && network === "ig") {
    // dégradé Instagram appliqué au glyphe
    return (
      <span role="img" aria-label={label} title={label} className={cn("inline-flex shrink-0", className)}>
        <svg width={0} height={0} className="absolute" aria-hidden>
          <linearGradient id="orbit-ig-gradient" x1="0%" y1="100%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#F58529" />
            <stop offset="50%" stopColor="#DD2A7B" />
            <stop offset="100%" stopColor="#8134AF" />
          </linearGradient>
        </svg>
        <Icon aria-hidden size={size} style={{ fill: "url(#orbit-ig-gradient)" }} />
      </span>
    );
  }
  return (
    <span role="img" aria-label={label} title={label} className={cn("inline-flex shrink-0", className)}>
      <Icon aria-hidden size={size} color={variant === "brand" ? meta.color : undefined} />
    </span>
  );
}
