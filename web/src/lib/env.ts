/**
 * Variables d'environnement, validées par zod.
 * - publicEnv : utilisable partout (préfixe NEXT_PUBLIC_).
 * - serverEnv() : serveur uniquement (secrets) — import depuis "@/lib/env.server".
 */
export const publicEnv = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabaseAnonKey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "",
};

/**
 * Mode démo : aucune base, données servies par src/lib/db/demo/fixture.json,
 * utilisateur « admin » fictif. Actif si ORBIT_DATA_SOURCE=demo, ou si Supabase
 * n'est pas configuré (pratique pour le front et le design).
 */
export function isDemoMode(): boolean {
  if (process.env.ORBIT_DATA_SOURCE === "demo") return true;
  if (process.env.ORBIT_DATA_SOURCE === "supabase") return false;
  return !publicEnv.supabaseUrl || !publicEnv.supabaseAnonKey;
}
