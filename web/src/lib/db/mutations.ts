import "server-only";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { demoStore } from "./demo";
import { getSessionUser } from "./queries";
import type {
  AppLocale,
  BrandSection,
  ExportFormat,
  ISODate,
  Network,
  ReportFrequency,
  ReportKind,
} from "./types";

/**
 * Écritures d'Orbit (ajout du front, additif). Côté Supabase, la RLS fait foi
 * (can_manage_brand : agence uniquement) ; côté démo, la même règle est simulée
 * sur le store en mémoire. Toutes les fonctions renvoient un résultat, jamais
 * d'exception pour un refus.
 */

export type MutationResult<T = undefined> = { ok: true; data: T } | { ok: false; error: MutationError };
export type MutationError = "forbidden" | "not_found" | "invalid" | "failed" | "already_exists" | "invite_unavailable";

const ok = <T>(data: T): MutationResult<T> => ({ ok: true, data });
const fail = (error: MutationError): MutationResult<never> => ({ ok: false, error });

async function agencyUser() {
  const user = await getSessionUser();
  return user?.isAgency ? user : null;
}

function uuid(): string {
  return crypto.randomUUID();
}

// =============================================================================
// Campagnes
// =============================================================================

export interface CampaignInput {
  brandId: string;
  name: string;
  description: string | null;
  startsOn: ISODate;
  endsOn: ISODate;
  hashtags: string[];
  color: string | null;
}

export async function createCampaign(input: CampaignInput): Promise<MutationResult<{ id: string }>> {
  const user = await agencyUser();
  if (!user) return fail("forbidden");
  if (isDemoMode()) {
    const d = demoStore();
    if (!d.brands.some((b) => b.id === input.brandId)) return fail("not_found");
    const now = new Date().toISOString();
    const id = uuid();
    d.campaigns.push({
      id, brand_id: input.brandId, name: input.name, description: input.description, starts_on: input.startsOn, ends_on: input.endsOn,
      hashtags: input.hashtags, color: input.color, created_by: user.id, created_at: now, updated_at: now,
    });
    return ok({ id });
  }
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb
    .from("campaigns")
    .insert({
      brand_id: input.brandId, name: input.name, description: input.description, starts_on: input.startsOn, ends_on: input.endsOn,
      hashtags: input.hashtags, color: input.color, created_by: user.id,
    })
    .select("id")
    .single();
  if (error || !data) return fail(error?.code === "42501" ? "forbidden" : "failed");
  return ok({ id: data.id });
}

export async function updateCampaign(id: string, input: Omit<CampaignInput, "brandId">): Promise<MutationResult> {
  const user = await agencyUser();
  if (!user) return fail("forbidden");
  if (isDemoMode()) {
    const c = demoStore().campaigns.find((x) => x.id === id);
    if (!c) return fail("not_found");
    Object.assign(c, {
      name: input.name, description: input.description, starts_on: input.startsOn, ends_on: input.endsOn,
      hashtags: input.hashtags, color: input.color, updated_at: new Date().toISOString(),
    });
    return ok(undefined);
  }
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb
    .from("campaigns")
    .update({ name: input.name, description: input.description, starts_on: input.startsOn, ends_on: input.endsOn, hashtags: input.hashtags, color: input.color })
    .eq("id", id)
    .select("id");
  if (error) return fail("failed");
  return data?.length ? ok(undefined) : fail("not_found");
}

export async function deleteCampaign(id: string): Promise<MutationResult> {
  const user = await agencyUser();
  if (!user) return fail("forbidden");
  if (isDemoMode()) {
    const d = demoStore();
    const i = d.campaigns.findIndex((x) => x.id === id);
    if (i < 0) return fail("not_found");
    d.campaigns.splice(i, 1);
    d.posts.forEach((p) => p.campaign_id === id && (p.campaign_id = null));
    return ok(undefined);
  }
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb.from("campaigns").delete().eq("id", id).select("id");
  if (error) return fail("failed");
  return data?.length ? ok(undefined) : fail("not_found");
}

// =============================================================================
// Envois programmés
// =============================================================================

export interface ReportScheduleInput {
  brandId: string;
  name: string;
  kind: ReportKind;
  frequency: ReportFrequency;
  recipients: string[];
  locale: AppLocale;
  format: ExportFormat;
  networks: Network[];
  sections: string[];
  compare: boolean;
}

/** Prochain envoi (06:00 heure de Martinique = 10:00 UTC) selon la fréquence. */
export function nextRunAt(frequency: ReportFrequency, now: Date = new Date()): string {
  const y = now.getUTCFullYear();
  const m = now.getUTCMonth();
  let d: Date;
  switch (frequency) {
    case "weekly": {
      d = new Date(Date.UTC(y, m, now.getUTCDate()));
      const dow = (d.getUTCDay() + 6) % 7; // lundi = 0
      d.setUTCDate(d.getUTCDate() + (7 - dow));
      break;
    }
    case "monthly":
      d = new Date(Date.UTC(y, m + 1, 1));
      break;
    case "quarterly":
      d = new Date(Date.UTC(y, Math.floor(m / 3) * 3 + 3, 1));
      break;
    case "yearly":
      d = new Date(Date.UTC(y + 1, 0, 1));
      break;
  }
  d.setUTCHours(10, 0, 0, 0);
  return d.toISOString();
}

export async function createReportSchedule(input: ReportScheduleInput): Promise<MutationResult<{ id: string }>> {
  const user = await agencyUser();
  if (!user) return fail("forbidden");
  const row = {
    brand_id: input.brandId, name: input.name, kind: input.kind, frequency: input.frequency, recipients: input.recipients,
    locale: input.locale, format: input.format, networks: input.networks, sections: input.sections, compare: input.compare,
    active: true, next_run_at: nextRunAt(input.frequency), created_by: user.id,
  };
  if (isDemoMode()) {
    const d = demoStore();
    if (!d.brands.some((b) => b.id === input.brandId)) return fail("not_found");
    const now = new Date().toISOString();
    const id = uuid();
    d.schedules.push({ ...row, id, template_id: null, last_run_at: null, created_at: now, updated_at: now });
    return ok({ id });
  }
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb.from("report_schedules").insert(row).select("id").single();
  if (error || !data) return fail(error?.code === "42501" ? "forbidden" : "failed");
  return ok({ id: data.id });
}

export async function deleteReportSchedule(id: string): Promise<MutationResult> {
  const user = await agencyUser();
  if (!user) return fail("forbidden");
  if (isDemoMode()) {
    const d = demoStore();
    const i = d.schedules.findIndex((x) => x.id === id);
    if (i < 0) return fail("not_found");
    d.schedules.splice(i, 1);
    return ok(undefined);
  }
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb.from("report_schedules").delete().eq("id", id).select("id");
  if (error) return fail("failed");
  return data?.length ? ok(undefined) : fail("not_found");
}

// =============================================================================
// Accès clients
// =============================================================================

export interface ClientInviteInput {
  brandId: string;
  email: string;
  fullName: string | null;
  locale: AppLocale;
  sections: BrandSection[];
  /** URL de retour du lien magique (…/auth/callback) */
  redirectTo: string;
}

/**
 * Invite un client par e-mail (lien magique Supabase, `inviteUserByEmail` via le
 * service role — tâche serveur autorisée par lib/supabase/admin.ts) puis lui
 * ouvre la marque. Démo : invitation simulée (aucun e-mail).
 */
export async function inviteClient(input: ClientInviteInput): Promise<MutationResult<{ userId: string; emailed: boolean }>> {
  const user = await agencyUser();
  if (!user || !user.organizationId) return fail("forbidden");
  const email = input.email.trim().toLowerCase();

  if (isDemoMode()) {
    const d = demoStore();
    if (!d.brands.some((b) => b.id === input.brandId)) return fail("not_found");
    let profile = d.profiles.find((p) => p.email === email);
    if (profile && profile.role !== "client") return fail("invalid");
    const now = new Date().toISOString();
    if (!profile) {
      profile = {
        id: uuid(), organization_id: user.organizationId, email, full_name: input.fullName, role: "client", locale: input.locale,
        avatar_url: null, last_seen_at: null, created_at: now, updated_at: now,
      };
      d.profiles.push(profile);
    }
    if (d.access.some((a) => a.user_id === profile.id && a.brand_id === input.brandId)) return fail("already_exists");
    d.access.push({ user_id: profile.id, brand_id: input.brandId, visible_sections: input.sections, invited_by: user.id, created_at: now });
    return ok({ userId: profile.id, emailed: false });
  }

  // Le contrôle « peut gérer la marque » est fait AVANT d'utiliser le service role.
  const sb = await createSupabaseServerClient();
  const { data: canManage } = await sb.rpc("can_manage_brand", { p_brand_id: input.brandId });
  if (!canManage) return fail("forbidden");

  let admin;
  try {
    const { createSupabaseAdminClient } = await import("@/lib/supabase/admin");
    admin = createSupabaseAdminClient();
  } catch {
    return fail("invite_unavailable");
  }

  let userId: string | null = null;
  let emailed = false;
  const { data: existing } = await admin.from("profiles").select("id, role, organization_id").eq("email", email).maybeSingle();
  if (existing) {
    if (existing.role !== "client" || (existing.organization_id && existing.organization_id !== user.organizationId)) return fail("invalid");
    userId = existing.id;
  } else {
    const { data, error } = await admin.auth.admin.inviteUserByEmail(email, {
      data: { full_name: input.fullName ?? "", locale: input.locale },
      redirectTo: input.redirectTo,
    });
    if (error || !data.user) return fail("failed");
    userId = data.user.id;
    emailed = true;
    await admin.auth.admin.updateUserById(userId, { app_metadata: { organization_id: user.organizationId, role: "client" } });
  }
  // Rattache le profil à l'organisation (le trigger a pu le créer sans organisation)
  await admin.from("profiles").update({ organization_id: user.organizationId, role: "client", locale: input.locale, ...(input.fullName ? { full_name: input.fullName } : {}) }).eq("id", userId);

  const { error } = await sb.from("brand_access").insert({ user_id: userId, brand_id: input.brandId, visible_sections: input.sections, invited_by: user.id });
  if (error) return fail(error.code === "23505" ? "already_exists" : "failed");
  return ok({ userId, emailed });
}

export async function updateClientSections(userId: string, brandId: string, sections: BrandSection[]): Promise<MutationResult> {
  const user = await agencyUser();
  if (!user) return fail("forbidden");
  if (!sections.length) return fail("invalid");
  if (isDemoMode()) {
    const a = demoStore().access.find((x) => x.user_id === userId && x.brand_id === brandId);
    if (!a) return fail("not_found");
    a.visible_sections = sections;
    return ok(undefined);
  }
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb.from("brand_access").update({ visible_sections: sections }).eq("user_id", userId).eq("brand_id", brandId).select("user_id");
  if (error) return fail("failed");
  return data?.length ? ok(undefined) : fail("not_found");
}

export async function removeClientAccess(userId: string, brandId: string): Promise<MutationResult> {
  const user = await agencyUser();
  if (!user) return fail("forbidden");
  if (isDemoMode()) {
    const d = demoStore();
    const i = d.access.findIndex((x) => x.user_id === userId && x.brand_id === brandId);
    if (i < 0) return fail("not_found");
    d.access.splice(i, 1);
    return ok(undefined);
  }
  const sb = await createSupabaseServerClient();
  const { data, error } = await sb.from("brand_access").delete().eq("user_id", userId).eq("brand_id", brandId).select("user_id");
  if (error) return fail("failed");
  return data?.length ? ok(undefined) : fail("not_found");
}
