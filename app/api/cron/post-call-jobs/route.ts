/**
 * GET /api/cron/post-call-jobs
 *
 * Cron processor for the post_call_jobs queue (migration 056).
 * Run every 1–2 minutes via Vercel Cron.
 *
 * Auth: Bearer INTERNAL_API_SECRET (timing-safe, min 16 chars)
 * Query params:
 *   limit     — number of jobs to claim per run (default 10, max 50)
 *   job_type  — optional filter to process only one type
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  claimNextPostCallJobs,
  markJobCompleted,
  markJobFailed,
  markJobRetrying,
  markJobDeadLetter,
  shouldRetryJob,
  type PostCallJob,
  type PostCallJobType,
} from "@/lib/jobs/post-call-jobs";
import { processPostCallJob } from "@/lib/jobs/process-post-call-job";
import { timingSafeEqual } from "node:crypto";

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
  // Auth: Accept Bearer header or x-internal-secret header
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

  const admin = createAdminClient();

  // Claim jobs atomically
  const jobs = await claimNextPostCallJobs(
    admin,
    WORKER_ID,
    limit,
    jobTypeParam ?? undefined,
  );

  const summary = {
    claimed: jobs.length,
    completed: 0,
    retrying: 0,
    failed: 0,
    dead_letter: 0,
  };

  // Process each job sequentially (avoid overwhelming external APIs)
  for (const job of jobs) {
    try {
      const result = await processPostCallJob(admin, job);
      await markJobCompleted(admin, job.id, result);
      summary.completed++;
    } catch (err) {
      const errorCode = (err as { code?: string }).code ?? "500";
      const errorMsg = (err instanceof Error ? err.message : String(err)).slice(
        0,
        500,
      );
      const decision = shouldRetryJob(job as PostCallJob, errorCode);

      if (decision.isDeadLetter) {
        await markJobDeadLetter(admin, job.id, {
          message: errorMsg,
          code: errorCode,
        });
        summary.dead_letter++;
      } else if (decision.shouldRetry) {
        await markJobRetrying(
          admin,
          job.id,
          { message: errorMsg, code: errorCode },
          job.attempts,
        );
        summary.retrying++;
      } else {
        await markJobFailed(admin, job.id, {
          message: errorMsg,
          code: errorCode,
        });
        summary.failed++;
      }
    }
  }

  return NextResponse.json(summary);
}
