import Link from "next/link";
import { Avatar, NetworkIcon } from "@/components/ui";
import type { BrandSummary } from "@/lib/db";
import { cn } from "@/lib/utils";

/** Choix de la marque des pages transverses (?brand=…), avec photo et réseaux. */
export function BrandSwitcher({ brands, currentId, hrefFor, label }: { brands: BrandSummary[]; currentId: string; hrefFor: (id: string) => string; label: string }) {
  if (brands.length < 2) return null;
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1 pb-1">
      <ul className="flex gap-2">
        {brands.map((b) => {
          const active = b.id === currentId;
          return (
            <li key={b.id}>
              <Link
                href={hrefFor(b.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex items-center gap-2.5 rounded-pill border py-1 pr-3.5 pl-1 text-[13px] font-medium whitespace-nowrap shadow-soft transition-all focus-visible:shadow-glow focus-visible:outline-none",
                  active ? "border-orbit-300 bg-orbit-50 text-orbit-900" : "border-line bg-surface text-ink-2 hover:border-line-strong hover:text-ink",
                )}
              >
                <Avatar src={b.avatarUrl} name={b.name} color={b.color} size="sm" />
                {b.name}
                <span className="flex gap-1">
                  {b.networks.map((n) => (
                    <NetworkIcon key={n} network={n} size={12} />
                  ))}
                </span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
