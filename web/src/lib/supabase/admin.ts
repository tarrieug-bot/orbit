import "server-only";
import { createClient } from "@supabase/supabase-js";
import { publicEnv } from "@/lib/env";
import { serverEnv } from "@/lib/env.server";
import type { Database } from "@/lib/db/types";

/**
 * Client service role : CONTOURNE la RLS. Réservé aux tâches serveur sans
 * utilisateur (cron de collecte, envoi de rapports, invitations, lecture des jetons).
 * Ne jamais l'utiliser pour servir une page à un utilisateur.
 */
export function createSupabaseAdminClient() {
  return createClient<Database>(publicEnv.supabaseUrl, serverEnv("SUPABASE_SERVICE_ROLE_KEY"), {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
