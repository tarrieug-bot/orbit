"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { isDemoMode } from "@/lib/env";
import { appUrl } from "@/lib/env.server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { DEMO_USER_COOKIE } from "@/lib/db/demo";

export type LoginState = { status: "idle" | "sent" | "error"; message?: string; email?: string };

const emailSchema = z.string().trim().toLowerCase().email();

function safeNext(next: FormDataEntryValue | null): string {
  const v = typeof next === "string" ? next : "";
  return v.startsWith("/") && !v.startsWith("//") ? v : "/";
}

/** Envoie un lien magique. Pas de création de compte : les utilisateurs sont invités par l'agence. */
export async function sendMagicLink(_prev: LoginState, formData: FormData): Promise<LoginState> {
  const parsed = emailSchema.safeParse(formData.get("email"));
  if (!parsed.success) return { status: "error", message: "invalidEmail" };
  const next = safeNext(formData.get("next"));
  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithOtp({
    email: parsed.data,
    options: {
      shouldCreateUser: false,
      emailRedirectTo: `${appUrl()}/auth/callback?next=${encodeURIComponent(next)}`,
    },
  });
  // Réponse identique que l'adresse existe ou non (pas d'énumération des comptes).
  if (error && error.status !== 400 && error.status !== 422) return { status: "error", message: "sendFailed", email: parsed.data };
  return { status: "sent", email: parsed.data };
}

/** Mode démo : choisir l'utilisateur fictif (agence ou client) sans e-mail. */
export async function demoSignIn(formData: FormData): Promise<void> {
  if (!isDemoMode()) redirect("/login");
  const email = emailSchema.safeParse(formData.get("email"));
  const store = await cookies();
  if (email.success) store.set(DEMO_USER_COOKIE, email.data, { path: "/", httpOnly: true, sameSite: "lax" });
  redirect("/");
}
