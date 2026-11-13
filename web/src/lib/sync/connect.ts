import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { encryptToken } from "@/lib/security/tokens";
import { META_METRIC_MAP } from "@/lib/meta/metric-map";
import type { DiscoveredAccount } from "@/lib/meta/types";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

const BRAND_COLORS = ["#2A78D6", "#C2410C", "#0F766E", "#1D4ED8", "#7C3AED", "#B45309", "#0E7490", "#BE123C", "#15803D", "#4338CA"];

export function slugify(name: string): string {
  return (
    name
      .normalize("NFD")
      .replace(/[̀-ͯ]/g, "")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "")
      .slice(0, 48) || "marque"
  );
}

function colorFor(id: string): string {
  let h = 0;
  for (const c of id) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return BRAND_COLORS[h % BRAND_COLORS.length];
}

export interface PersistResult {
  accountIds: string[];
  createdBrands: number;
  skipped: { externalId: string; reason: string }[];
}

/**
 * Enregistre les comptes découverts après Facebook Login for Business :
 *  - une marque par Page (créée seulement si ni la Page ni son compte IG ne sont déjà rattachés :
 *    jamais de doublon, le regroupement choisi par l'agence est conservé) ;
 *  - upsert social_accounts sur (network, external_id), photo de profil comprise ;
 *  - jetons de Page chiffrés (AES-256-GCM) dans social_account_tokens (service role).
 */
export async function persistDiscoveredAccounts(opts: {
  organizationId: string;
  userId: string;
  accounts: DiscoveredAccount[];
  /** expiration effective des jetons (data_access_expires_at), si connue */
  tokenExpiresAt: (account: DiscoveredAccount) => Promise<string | null>;
  client?: Admin;
}): Promise<PersistResult> {
  const db = opts.client ?? createSupabaseAdminClient();
  const result: PersistResult = { accountIds: [], createdBrands: 0, skipped: [] };
  const pages = opts.accounts.filter((a) => a.network === "fb");

  const { data: existing, error } = await db
    .from("social_accounts")
    .select("id,network,external_id,brand_id")
    .in("external_id", opts.accounts.map((a) => a.externalId));
  if (error) throw new Error(`[connect] comptes existants : ${error.message}`);
  const { data: orgBrands, error: e2 } = await db.from("brands").select("id,slug").eq("organization_id", opts.organizationId);
  if (e2) throw new Error(`[connect] marques : ${e2.message}`);
  const orgBrandIds = new Set((orgBrands ?? []).map((b) => b.id));
  const slugs = new Set((orgBrands ?? []).map((b) => b.slug));
  const find = (network: "fb" | "ig", ext: string) => (existing ?? []).find((a) => a.network === network && a.external_id === ext);

  for (const page of pages) {
    const ig = opts.accounts.find((a) => a.network === "ig" && a.parentPageId === page.externalId);
    const known = find("fb", page.externalId) ?? (ig ? find("ig", ig.externalId) : undefined);
    if (known && !orgBrandIds.has(known.brand_id)) {
      result.skipped.push({ externalId: page.externalId, reason: "compte rattaché à une autre organisation" });
      continue;
    }
    let brandId = known?.brand_id ?? null;
    if (!brandId) {
      let slug = slugify(page.name ?? page.externalId);
      for (let i = 2; slugs.has(slug); i++) slug = `${slugify(page.name ?? page.externalId)}-${i}`;
      slugs.add(slug);
      const { data: brand, error: e3 } = await db
        .from("brands")
        .insert({
          organization_id: opts.organizationId,
          name: page.name ?? page.externalId,
          slug,
          sector: page.category ?? null,
          color: colorFor(page.externalId),
          avatar_url: page.avatarUrl,
        })
        .select("id")
        .single();
      if (e3 || !brand) throw new Error(`[connect] création de la marque : ${e3?.message}`);
      brandId = brand.id;
      orgBrandIds.add(brandId);
      result.createdBrands++;
    } else if (page.avatarUrl) {
      await db.from("brands").update({ avatar_url: page.avatarUrl }).eq("id", brandId);
    }

    for (const acc of ig ? [page, ig] : [page]) {
      const prev = find(acc.network, acc.externalId);
      if (prev && !orgBrandIds.has(prev.brand_id)) {
        result.skipped.push({ externalId: acc.externalId, reason: "compte rattaché à une autre organisation" });
        continue;
      }
      const expiresAt = await opts.tokenExpiresAt(acc);
      const { data: row, error: e4 } = await db
        .from("social_accounts")
        .upsert(
          {
            brand_id: prev?.brand_id ?? brandId,
            network: acc.network,
            external_id: acc.externalId,
            parent_page_id: acc.parentPageId,
            handle: acc.handle,
            name: acc.name,
            avatar_url: acc.avatarUrl,
            followers_count: acc.followersCount,
            token_expires_at: expiresAt,
            status: "active",
            status_message: null,
            connected_by: opts.userId,
          },
          { onConflict: "network,external_id" },
        )
        .select("id")
        .single();
      if (e4 || !row) throw new Error(`[connect] compte ${acc.network} : ${e4?.message}`);
      const { error: e5 } = await db.from("social_account_tokens").upsert(
        {
          account_id: row.id,
          access_token_enc: encryptToken(acc.pageAccessToken),
          token_type: "page",
          scopes: META_METRIC_MAP.permissions,
          expires_at: expiresAt,
        },
        { onConflict: "account_id" },
      );
      if (e5) throw new Error(`[connect] jeton : ${e5.message}`);
      result.accountIds.push(row.id);
    }
  }
  return result;
}
