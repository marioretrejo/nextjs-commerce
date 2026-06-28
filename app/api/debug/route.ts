import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { cookies } from "next/headers";

export const dynamic = "force-dynamic";

const REQUIRED_ENV_VARS = [
  "CARTESIA_API_KEY",
  "ANTHROPIC_API_KEY",
  "OPENAI_API_KEY",
  "RETELL_API_KEY",
  "ELEVENLABS_API_KEY",
  "NEXT_PUBLIC_SUPABASE_URL",
  "SUPABASE_SERVICE_ROLE_KEY",
  "STRIPE_SECRET_KEY",
];

export async function GET(req: Request) {
  // This endpoint exposes env-var presence and session/cookie diagnostics, so it
  // must not be publicly reachable. Gate it behind the shared debug secret (same
  // pattern as the other /api/debug/* routes); fail closed if it isn't set.
  const expected = process.env["DIRECT_ACCESS_SECRET"];
  const provided =
    new URL(req.url).searchParams.get("secret") ??
    req.headers.get("x-debug-secret");
  if (!expected || provided !== expected) {
    return new NextResponse("Not found", { status: 404 });
  }

  const cookieStore = await cookies();
  const allCookies = cookieStore.getAll();
  const supabaseCookies = allCookies
    .filter((c) => c.name.startsWith("sb-"))
    .map((c) => ({ name: c.name, length: c.value.length }));

  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  const envStatus: Record<string, string> = {};
  for (const key of REQUIRED_ENV_VARS) {
    const val = process.env[key];
    if (!val) {
      envStatus[key] = "❌ MISSING";
    } else {
      envStatus[key] = `✅ set (${val.length} chars)`;
    }
  }

  return NextResponse.json({
    serverSeesSession: !!user,
    userId: user?.id ?? null,
    email: user?.email ?? null,
    error: error?.message ?? null,
    supabaseCookieCount: supabaseCookies.length,
    supabaseCookies,
    totalCookies: allCookies.length,
    env: envStatus,
  });
}
