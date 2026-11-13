import "server-only";
import { z } from "zod";

const schema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.string().url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  META_APP_ID: z.string().min(1),
  META_APP_SECRET: z.string().min(1),
  META_CONFIG_ID: z.string().min(1),
  META_API_VERSION: z.string().regex(/^v\d+\.\d+$/).default("v25.0"),
  /** 32 octets encodés en base64 (openssl rand -base64 32) */
  TOKEN_ENCRYPTION_KEY: z.string().min(1),
  CRON_SECRET: z.string().min(16),
  RESEND_API_KEY: z.string().optional(),
  APP_URL: z.string().url().default("http://localhost:3000"),
});

export type ServerEnv = z.infer<typeof schema>;

/**
 * Lit et valide une variable serveur à la demande (pas au chargement du module,
 * pour que `next build` passe sans secrets).
 */
export function serverEnv<K extends keyof ServerEnv>(key: K): ServerEnv[K] {
  const parsed = schema.shape[key].safeParse(process.env[key]);
  if (!parsed.success) {
    throw new Error(`Variable d'environnement ${String(key)} manquante ou invalide (voir web/.env.example).`);
  }
  return parsed.data as ServerEnv[K];
}

export function appUrl(): string {
  return (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
}
