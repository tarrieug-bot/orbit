import Link from "next/link";
import { buttonVariants } from "@/components/ui";
import { OrbitLogo } from "@/components/shell/orbit-logo";

export default function NotFound() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-6 p-6 text-center">
      <OrbitLogo size={40} />
      <div>
        <p className="text-5xl font-semibold tracking-tight text-ink">404</p>
        <p className="mt-2 text-ink-2">Cette page n&apos;existe pas ou ne vous est pas accessible.</p>
      </div>
      <Link href="/" className={buttonVariants({ variant: "primary" })}>Retour à l&apos;accueil</Link>
    </div>
  );
}
