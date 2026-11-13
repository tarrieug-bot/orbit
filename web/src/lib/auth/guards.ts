import "server-only";
import { notFound, redirect } from "next/navigation";
import { getBrand, getSessionUser, listBrands, type BrandSummary, type SessionUser } from "@/lib/db";
import type { BrandSection } from "@/lib/db/types";

/**
 * Gardes d'accès des pages. Elles améliorent l'expérience (redirections) ; la
 * sécurité réelle reste la RLS Postgres (un client ne peut PAS lire une autre marque
 * même s'il contourne ces gardes).
 */

export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/login");
  return user;
}

/** Page d'accueil selon le rôle : agence → vue d'ensemble ; client → sa (première) marque. */
export async function homePathFor(user: SessionUser): Promise<string> {
  if (user.isAgency) return "/";
  const brands = await listBrands();
  const first = brands[0];
  if (!first) return "/no-access";
  const section = first.sections[0];
  return section === "posts" ? `/brands/${first.id}/posts` : `/brands/${first.id}`;
}

/** Réservé à l'équipe agence (admin / manager) : sinon renvoie le client chez lui. */
export async function requireAgency(): Promise<SessionUser> {
  const user = await requireUser();
  if (!user.isAgency) redirect(await homePathFor(user));
  return user;
}

export async function requireAdmin(): Promise<SessionUser> {
  const user = await requireAgency();
  if (user.role !== "admin") redirect("/");
  return user;
}

/** Marque accessible (+ rubrique visible pour un client), sinon 404. */
export async function requireBrand(brandId: string, section?: BrandSection): Promise<{ user: SessionUser; brand: BrandSummary }> {
  const user = await requireUser();
  const brand = await getBrand(brandId);
  if (!brand) notFound();
  if (section && !brand.sections.includes(section)) {
    if (!brand.sections.length) notFound();
    redirect(brand.sections[0] === "posts" ? `/brands/${brand.id}/posts` : `/brands/${brand.id}`);
  }
  return { user, brand };
}

/**
 * Marque « courante » des pages transverses (/audience, /campaigns, /reports) :
 * paramètre ?brand=…, sinon la première marque autorisée pour la rubrique.
 */
export async function resolveBrandParam(brandParam: string | string[] | undefined, section: BrandSection): Promise<BrandSummary | null> {
  await requireUser();
  const brands = (await listBrands()).filter((b) => b.sections.includes(section));
  const id = Array.isArray(brandParam) ? brandParam[0] : brandParam;
  return brands.find((b) => b.id === id) ?? brands[0] ?? null;
}
