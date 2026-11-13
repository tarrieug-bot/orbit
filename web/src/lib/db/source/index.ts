import "server-only";
import { cache } from "react";
import { cookies } from "next/headers";
import { isDemoMode } from "@/lib/env";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createDemoSource, DEMO_USER_COOKIE } from "../demo";
import { createSupabaseSource } from "./supabase";
import type { DataSource } from "./types";

/**
 * Source de données de la requête en cours (mémoïsée par requête via React cache).
 * Supabase (RLS) en temps normal ; démo si ORBIT_DATA_SOURCE=demo ou Supabase non configuré.
 */
export const getDataSource = cache(async (): Promise<DataSource> => {
  if (isDemoMode()) {
    const store = await cookies();
    return createDemoSource(store.get(DEMO_USER_COOKIE)?.value);
  }
  return createSupabaseSource(await createSupabaseServerClient());
});

