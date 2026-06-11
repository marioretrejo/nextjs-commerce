/**
 * GET /api/cron/post-call-jobs
 *
 * Cron processor for the post_call_jobs queue.
 * Auth: Bearer INTERNAL_API_SECRET (timing-safe, min 16 chars)
 * Query params:
 *   limit     — jobs per run (default 10, max 50)
 *   job_type  — optional filter to process one type only
 */
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { runPostCallJobs } from "@/lib/cron/post-call-jobs-runner";
import type { PostCallJobType } from "@/lib/jobs/post-call-jobs";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const WORKER_ID = `cron-${process.env["VERCEL_REGION"] ?? "local"}-${Date.now()}`;

function verifySecret(provided: string | null): boolean {
  const secret = process.env["INTERNAL_API_SECRET"];
  if (!secret || secret.trim().length < 16) return false;
  if (!provided || provided.length === 0) return false;
  const a = Buffer.from(secret, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
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
  const limitParam = parseInt(url.searchParams.get("limit") ?? "10", 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 10 : limitParam), 50);
  const jobTypeParam = url.searchParams.get(
    "job_type",
  ) as PostCallJobType | null;

  const result = await runPostCallJobs({
    workerId: WORKER_ID,
    limit,
    jobType: jobTypeParam ?? undefined,
  });

  return NextResponse.json(result);
}
