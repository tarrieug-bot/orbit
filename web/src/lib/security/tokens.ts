import "server-only";
import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";
import { serverEnv } from "@/lib/env.server";

/**
 * Chiffrement des jetons d'accès (Meta, puis TikTok/LinkedIn/YouTube) en AES-256-GCM.
 * Format stocké : "v1:<iv base64>:<tag base64>:<données base64>".
 * Clé : TOKEN_ENCRYPTION_KEY = 32 octets en base64 (`openssl rand -base64 32`).
 * Rotation : introduire "v2" avec une nouvelle clé et re-chiffrer à la synchro.
 */
const VERSION = "v1";

function key(): Buffer {
  const k = Buffer.from(serverEnv("TOKEN_ENCRYPTION_KEY"), "base64");
  if (k.length !== 32) throw new Error("TOKEN_ENCRYPTION_KEY doit faire 32 octets (base64).");
  return k;
}

export function encryptToken(plain: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key(), iv);
  const data = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64"), tag.toString("base64"), data.toString("base64")].join(":");
}

export function decryptToken(stored: string): string {
  const [version, iv, tag, data] = stored.split(":");
  if (version !== VERSION || !iv || !tag || !data) throw new Error("Jeton chiffré illisible (format inconnu).");
  const decipher = createDecipheriv("aes-256-gcm", key(), Buffer.from(iv, "base64"));
  decipher.setAuthTag(Buffer.from(tag, "base64"));
  return Buffer.concat([decipher.update(Buffer.from(data, "base64")), decipher.final()]).toString("utf8");
}
