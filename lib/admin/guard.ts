/**
 * Centralised superadmin authorisation for /api/admin/* route handlers.
 *
 * Before this, 16 admin routes each inlined the same "get user → look up
 * is_superadmin → 401/403" preamble, in four subtly different shapes (some
 * checked the profile with the RLS client, some with the service-role client;
 * variable names drifted between profile/p/me). That drift is exactly the class
 * of bug that turns a null profile row into a 500 instead of a clean 403.
 *
 * `evaluateSuperadmin` is the pure decision core (no IO) so the null/empty
 * cases can be locked down by unit tests. `requireSuperadmin` performs the IO
 * and hands back either the service-role client + user, or a ready NextResponse.
 */
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export type SuperadminDecision =
  | { authorized: true }
  | { authorized: false; status: 401 | 403 };

/**
 * Pure authorisation decision.
 *  - No authenticated user            → 401 Unauthorized
 *  - User but no/incomplete profile   → 403 Forbidden (null-safe: a missing
 *                                        row or missing column is NOT superadmin)
 *  - User with is_superadmin === true → authorized
 */
export function evaluateSuperadmin(
  user: { id: string } | null | undefined,
  profile: { is_superadmin?: boolean | null } | null | undefined,
): SuperadminDecision {
  if (!user) return { authorized: false, status: 401 };
  if (!profile?.is_superadmin) return { authorized: false, status: 403 };
  return { authorized: true };
}

export type SuperadminGate =
  | { ok: true; admin: SupabaseClient; user: User }
  | { ok: false; response: NextResponse };

/**
 * Guard for admin route handlers. Usage:
 *
 *   const gate = await requireSuperadmin();
 *   if (!gate.ok) return gate.response;
 *   const { admin, user } = gate;
 *
 * Short-circuits on an unauthenticated request BEFORE constructing the
 * service-role client, so a logged-out caller gets a 401 even in an
 * environment where the service-role credentials are absent.
 */
export async function requireSuperadmin(): Promise<SuperadminGate> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }),
    };
  }

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();

  const decision = evaluateSuperadmin(
    user,
    profile as { is_superadmin?: boolean | null } | null,
  );
  if (!decision.authorized) {
    return {
      ok: false,
      response: NextResponse.json({ error: "Forbidden" }, { status: 403 }),
    };
  }

  return { ok: true, admin, user };
}
