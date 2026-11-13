"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { appUrl } from "@/lib/env.server";
import { getSessionUser, inviteClient, removeClientAccess, updateClientSections } from "@/lib/db";
import { BRAND_SECTIONS, type BrandSection } from "@/lib/db/types";

export type ClientFormState = { status: "idle" | "ok" | "error"; error?: string; emailed?: boolean; email?: string };

const sectionsSchema = z.array(z.enum(BRAND_SECTIONS as unknown as [BrandSection, ...BrandSection[]])).min(1);

const inviteSchema = z.object({
  brandId: z.string().uuid(),
  email: z.string().trim().toLowerCase().email(),
  fullName: z.string().trim().max(120).optional(),
  locale: z.enum(["fr", "en"]),
  sections: sectionsSchema,
});

/** Inviter un client par e-mail sur une marque (agence uniquement). */
export async function inviteClientAction(_prev: ClientFormState, fd: FormData): Promise<ClientFormState> {
  const user = await getSessionUser();
  if (!user?.isAgency) return { status: "error", error: "forbidden" };
  const parsed = inviteSchema.safeParse({
    brandId: fd.get("brandId"),
    email: fd.get("email"),
    fullName: fd.get("fullName") || undefined,
    locale: fd.get("locale"),
    sections: fd.getAll("sections"),
  });
  if (!parsed.success) return { status: "error", error: parsed.error.issues.some((i) => i.path[0] === "email") ? "email" : parsed.error.issues.some((i) => i.path[0] === "sections") ? "sections" : "invalid" };
  const d = parsed.data;
  const res = await inviteClient({ ...d, fullName: d.fullName ?? null, redirectTo: `${appUrl()}/auth/callback?next=/` });
  if (!res.ok) return { status: "error", error: res.error };
  revalidatePath("/settings/clients");
  return { status: "ok", emailed: res.data.emailed, email: d.email };
}

/** Rubriques visibles d'un client sur une marque. */
export async function updateSectionsAction(fd: FormData): Promise<{ ok: boolean }> {
  const user = await getSessionUser();
  if (!user?.isAgency) return { ok: false };
  const ids = z.object({ userId: z.string().uuid(), brandId: z.string().uuid() }).safeParse({ userId: fd.get("userId"), brandId: fd.get("brandId") });
  const sections = sectionsSchema.safeParse(fd.getAll("sections"));
  if (!ids.success || !sections.success) return { ok: false };
  const res = await updateClientSections(ids.data.userId, ids.data.brandId, sections.data);
  revalidatePath("/settings/clients");
  return { ok: res.ok };
}

/** Retirer l'accès d'un client à une marque. */
export async function removeClientAction(fd: FormData): Promise<void> {
  const user = await getSessionUser();
  if (!user?.isAgency) return;
  const ids = z.object({ userId: z.string().uuid(), brandId: z.string().uuid() }).safeParse({ userId: fd.get("userId"), brandId: fd.get("brandId") });
  if (!ids.success) return;
  await removeClientAccess(ids.data.userId, ids.data.brandId);
  revalidatePath("/settings/clients");
}
