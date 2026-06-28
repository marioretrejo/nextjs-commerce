import { NextResponse } from "next/server";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * GET /api/health
 *
 * Liveness + readiness probe. Returns 200 when the app and its critical
 * dependency (Supabase) are reachable, 503 otherwise. Each integration reports
 * whether it is configured (env present) and, for Supabase, whether it actually
 * responds within a short timeout. Cheap enough for uptime monitors to poll.
 */
async function pingWithTimeout(url: string, ms: number): Promise<boolean> {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  try {
    const res = await fetch(url, {
      method: "GET",
      signal: controller.signal,
      headers: { "cache-control": "no-store" },
    });
    return res.status > 0;
  } catch {
    return false;
  } finally {
    clearTimeout(t);
  }
}

export async function GET() {
  const configured = {
    supabase: Boolean(process.env["NEXT_PUBLIC_SUPABASE_URL"]),
    stripe: Boolean(process.env["STRIPE_SECRET_KEY"]),
    livekit: Boolean(process.env["LIVEKIT_API_KEY"]),
    deepgram: Boolean(process.env["DEEPGRAM_API_KEY"]),
    elevenlabs: Boolean(process.env["ELEVENLABS_API_KEY"]),
    cartesia: Boolean(process.env["CARTESIA_API_KEY"]),
    groq: Boolean(process.env["GROQ_API_KEY"]),
    twilio: Boolean(process.env["TWILIO_ACCOUNT_SID"]),
  };

  // Active reachability check for the one hard dependency: Supabase.
  const supabaseUrl = process.env["NEXT_PUBLIC_SUPABASE_URL"];
  let supabaseReachable = false;
  if (supabaseUrl) {
    supabaseReachable = await pingWithTimeout(
      `${supabaseUrl}/auth/v1/health`,
      2500,
    );
  }

  const healthy = configured.supabase && supabaseReachable;

  return NextResponse.json(
    {
      status: healthy ? "ok" : "degraded",
      timestamp: new Date().toISOString(),
      checks: {
        supabase: {
          configured: configured.supabase,
          reachable: supabaseReachable,
        },
        stripe: { configured: configured.stripe },
        livekit: { configured: configured.livekit },
        deepgram: { configured: configured.deepgram },
        elevenlabs: { configured: configured.elevenlabs },
        cartesia: { configured: configured.cartesia },
        groq: { configured: configured.groq },
        twilio: { configured: configured.twilio },
      },
    },
    { status: healthy ? 200 : 503 },
  );
}
