/**
 * GET /api/cron/alerts
 *
 * Evaluates alert signals and manages incidents.
 * Auth:    Bearer INTERNAL_API_SECRET or x-internal-secret header (timing-safe).
 *
 * External sends (Slack/email) are OFF by default.
 * Set VOICEOS_ALERTING_SEND_EXTERNAL=true to enable.
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runAlerts } from "@/lib/cron/alerts-runner";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifySecret(provided: string | null): boolean {
  const secret =
    process.env["INTERNAL_API_SECRET"] ?? process.env["CRON_SECRET"];
  if (!secret || secret.trim().length < 16) return false;
  if (!provided || provided.trim().length === 0) return false;
  const a = Buffer.from(secret, "utf8");
  const b = Buffer.from(provided.trim(), "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  const authHeader = req.headers.get("Authorization");
  const secretHeader = req.headers.get("x-internal-secret");
  const provided = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : secretHeader;

  if (!verifySecret(provided)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const url = new URL(req.url);
  const windowMinutes = Math.min(
    60,
    Math.max(5, parseInt(url.searchParams.get("window_minutes") ?? "15", 10)),
  );

  const result = await runAlerts({ windowMinutes });

  return NextResponse.json(result);
}
