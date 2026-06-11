/**
 * GET /api/cron/provider-health
 *
 * Periodic cron that computes provider health snapshots.
 * Auth: Bearer INTERNAL_API_SECRET or x-internal-secret header (timing-safe).
 *
 * Query params:
 *   window_minutes  — 5 | 15  (default 5 for cron, 15 for summary)
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runProviderHealth } from "@/lib/cron/provider-health-runner";

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
  const windowParam = parseInt(
    url.searchParams.get("window_minutes") ?? "5",
    10,
  );
  const windowMinutes = ([5, 15] as const).includes(windowParam as 5 | 15)
    ? (windowParam as 5 | 15)
    : 5;

  const result = await runProviderHealth({ windowMinutes });

  return NextResponse.json(result);
}
