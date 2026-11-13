import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers";
import { isDemoMode } from "@/lib/env";
import { DEMO_USER_COOKIE } from "@/lib/db/demo";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  if (isDemoMode()) (await cookies()).delete(DEMO_USER_COOKIE);
  else await (await createSupabaseServerClient()).auth.signOut();
  return NextResponse.redirect(new URL("/login", request.nextUrl.origin), { status: 303 });
}
