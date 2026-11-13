import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { decryptToken } from "@/lib/security/tokens";
import type { SyncStore } from "./store";

type Admin = ReturnType<typeof createSupabaseAdminClient>;

function check(context: string, error: { message: string } | null) {
  if (error) throw new Error(`[sync] ${context} : ${error.message}`);
}

/** Stockage de la collecte via le client service role (cron / tâches sans utilisateur). */
export function createSupabaseSyncStore(client: Admin = createSupabaseAdminClient()): SyncStore {
  return {
    async listAccounts(opts) {
      let q = client.from("social_accounts").select("*").in("network", ["fb", "ig"]).neq("status", "disconnected");
      if (opts?.ids) q = q.in("id", opts.ids);
      const { data, error } = await q;
      check("comptes", error);
      return data ?? [];
    },
    async listStates(ids) {
      if (!ids.length) return [];
      const { data, error } = await client.from("account_sync_state").select("*").in("account_id", ids);
      check("état de collecte", error);
      return data ?? [];
    },
    async saveState(accountId, patch) {
      const { error } = await client.from("account_sync_state").upsert({ account_id: accountId, ...patch }, { onConflict: "account_id" });
      check("état de collecte (écriture)", error);
    },
    async getToken(accountId) {
      const { data, error } = await client.from("social_account_tokens").select("access_token_enc").eq("account_id", accountId).maybeSingle();
      check("jeton", error);
      if (!data) return null;
      try {
        return decryptToken(data.access_token_enc);
      } catch {
        return null;
      }
    },
    async updateAccount(accountId, patch) {
      const { error } = await client.from("social_accounts").update(patch).eq("id", accountId);
      check("compte (écriture)", error);
    },
    async refreshBrandAvatar(account, profile) {
      if (!profile.avatarUrl) return;
      if (account.network === "ig") {
        const { count } = await client.from("social_accounts").select("id", { count: "exact", head: true }).eq("brand_id", account.brand_id).eq("network", "fb");
        if (count) return; // la photo de la Page prime
      }
      const { error } = await client.from("brands").update({ avatar_url: profile.avatarUrl }).eq("id", account.brand_id);
      check("photo de la marque", error);
    },
    async getDailyRows(accountId, range) {
      const { data, error } = await client
        .from("account_daily_metrics")
        .select("*")
        .eq("account_id", accountId)
        .gte("date", range.from)
        .lte("date", range.to)
        .order("date");
      check("métriques existantes", error);
      return data ?? [];
    },
    async getDailyRow(accountId, date) {
      const { data, error } = await client.from("account_daily_metrics").select("*").eq("account_id", accountId).eq("date", date).maybeSingle();
      check("métrique du jour", error);
      return data;
    },
    async upsertDailyRows(rows) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await client.from("account_daily_metrics").upsert(rows.slice(i, i + 500), { onConflict: "account_id,date" });
        check("métriques quotidiennes (écriture)", error);
      }
    },
    async upsertPosts(rows) {
      const out: { id: string; external_id: string; published_at: string }[] = [];
      for (let i = 0; i < rows.length; i += 200) {
        const { data, error } = await client
          .from("posts")
          .upsert(rows.slice(i, i + 200), { onConflict: "account_id,external_id" })
          .select("id,external_id,published_at");
        check("publications (écriture)", error);
        out.push(...(data ?? []));
      }
      return out;
    },
    async getSnapshots(postIds) {
      const out: { post_id: string; snapshot_day: number; captured_at: string }[] = [];
      for (let i = 0; i < postIds.length; i += 200) {
        const { data, error } = await client.from("post_metrics").select("post_id,snapshot_day,captured_at").in("post_id", postIds.slice(i, i + 200));
        check("snapshots", error);
        out.push(...(data ?? []));
      }
      return out;
    },
    async upsertPostMetrics(rows) {
      for (let i = 0; i < rows.length; i += 500) {
        const { error } = await client.from("post_metrics").upsert(rows.slice(i, i + 500), { onConflict: "post_id,snapshot_day" });
        check("statistiques des publications (écriture)", error);
      }
    },
    async upsertAudience(row) {
      const { error } = await client.from("audience_snapshots").upsert(row, { onConflict: "account_id,date" });
      check("audience (écriture)", error);
    },
    async startRun(row) {
      const { data, error } = await client.from("sync_runs").insert({ ...row, status: "running", details: {} }).select("id").single();
      if (error) return null; // le journal ne doit jamais bloquer la collecte
      return data.id;
    },
    async finishRun(id, patch) {
      if (id == null) return;
      await client.from("sync_runs").update({ ...patch, finished_at: new Date().toISOString() }).eq("id", id);
    },
  };
}
