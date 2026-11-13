"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createCampaign, deleteCampaign, getSessionUser, updateCampaign } from "@/lib/db";

export type FormState = { status: "idle" | "ok" | "error"; error?: string; at?: number };

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const schema = z.object({
  id: z.string().uuid().optional(),
  brandId: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
  description: z.string().trim().max(500).optional(),
  startsOn: isoDate,
  endsOn: isoDate,
  hashtags: z.string().max(500).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/).optional(),
});

function parseHashtags(raw: string | undefined): string[] {
  return [...new Set((raw ?? "").split(/[\s,;]+/).map((h) => h.trim()).filter(Boolean).map((h) => (h.startsWith("#") ? h : `#${h}`)))].slice(0, 20);
}

/** Création ou modification d'une campagne (agence uniquement ; RLS can_manage_brand). */
export async function saveCampaignAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user?.isAgency) return { status: "error", error: "forbidden" };
  const parsed = schema.safeParse(Object.fromEntries([...formData.entries()].filter(([, v]) => v !== "")));
  if (!parsed.success) return { status: "error", error: "invalid" };
  const d = parsed.data;
  const [startsOn, endsOn] = d.startsOn <= d.endsOn ? [d.startsOn, d.endsOn] : [d.endsOn, d.startsOn];
  const input = { name: d.name, description: d.description ?? null, startsOn, endsOn, hashtags: parseHashtags(d.hashtags), color: d.color ?? null };
  const res = d.id ? await updateCampaign(d.id, input) : await createCampaign({ ...input, brandId: d.brandId });
  if (!res.ok) return { status: "error", error: res.error };
  revalidatePath("/", "layout");
  return { status: "ok", at: Date.now() };
}

export async function deleteCampaignAction(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await getSessionUser();
  if (!user?.isAgency) return { status: "error", error: "forbidden" };
  const id = z.string().uuid().safeParse(formData.get("id"));
  if (!id.success) return { status: "error", error: "invalid" };
  const res = await deleteCampaign(id.data);
  if (!res.ok) return { status: "error", error: res.error };
  revalidatePath("/", "layout");
  return { status: "ok", at: Date.now() };
}
