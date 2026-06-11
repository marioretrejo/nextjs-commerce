/**
 * GET /api/cron/recover-missing-post-call-jobs
 *
 * Recovery scan: finds calls completed in the last N hours that have no
 * post_call_jobs rows and re-enqueues the standard job set idempotently.
 * Safe to run repeatedly — enqueue_post_call_jobs_idempotent uses ON CONFLICT
 * DO NOTHING, so a second run for the same call produces zero new rows.
 *
 * Auth: Bearer INTERNAL_API_SECRET (same secret as /api/cron/post-call-jobs)
 * Query params:
 *   hours   — look-back window in hours (default 48, max 168)
 *   limit   — max calls to recover per run (default 50, max 200)
 *   dry_run — if "1", scan and report without writing
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  enqueuePostCallJobsForCall,
  shouldEnqueuePostCallJobs,
  type EnqueueJobInput,
} from "@/lib/jobs/post-call-jobs";
import { timingSafeEqual } from "node:crypto";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifySecret(provided: string | null): boolean {
  const secret = process.env["INTERNAL_API_SECRET"];
  if (!secret || secret.trim().length < 16) return false;
  if (!provided || provided.length === 0) return false;
  const a = Buffer.from(secret, "utf8");
  const b = Buffer.from(provided, "utf8");
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

// Standard jobs to enqueue for any recovered call
const RECOVERY_JOBS: EnqueueJobInput[] = [
  { job_type: "crm_extraction", priority: 50 },
  { job_type: "qa_analysis", priority: 80 },
  { job_type: "integration_dispatch", priority: 90 },
  { job_type: "cost_finalization", priority: 110 },
];

interface CallRow {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  room_name: string | null;
  technical_status: string | null;
  ended_at: string | null;
  answered_at: string | null;
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
  const hoursParam = parseInt(url.searchParams.get("hours") ?? "48", 10);
  const hours = Math.min(Math.max(1, isNaN(hoursParam) ? 48 : hoursParam), 168);
  const limitParam = parseInt(url.searchParams.get("limit") ?? "50", 10);
  const limit = Math.min(Math.max(1, isNaN(limitParam) ? 50 : limitParam), 200);
  const dryRun = url.searchParams.get("dry_run") === "1";

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

  // Step 1: Fetch recent calls that are eligible for post_call_jobs.
  // Only completed/ended calls with ended_at set — excludes no_answer and failed.
  const { data: recentCalls, error: callsErr } = await admin
    .from("calls")
    .select(
      "id, workspace_id, agent_id, room_name, technical_status, ended_at, answered_at",
    )
    .gte("created_at", cutoff)
    .in("technical_status", ["ended", "completed"])
    .not("ended_at", "is", null)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (callsErr) {
    return NextResponse.json(
      { error: `calls scan failed: ${callsErr.message}` },
      { status: 500 },
    );
  }

  const calls = (recentCalls ?? []) as CallRow[];
  if (!calls.length) {
    return NextResponse.json({
      scanned: 0,
      orphaned: 0,
      jobs_enqueued: 0,
      jobs_skipped: 0,
      errors: [],
      dry_run: dryRun,
    });
  }

  // Step 2: Find which of these calls already have at least one post_call_job
  const callIds = calls.map((c) => c.id);
  const { data: coveredRows } = await admin
    .from("post_call_jobs")
    .select("call_id")
    .in("call_id", callIds);

  const coveredIds = new Set(
    ((coveredRows ?? []) as { call_id: string }[]).map((r) => r.call_id),
  );

  // Step 3: Orphaned = eligible calls that have no post_call_jobs at all
  const orphaned = calls.filter(
    (c) => !coveredIds.has(c.id) && shouldEnqueuePostCallJobs(c),
  );

  const summary = {
    scanned: calls.length,
    orphaned: orphaned.length,
    jobs_enqueued: 0,
    jobs_skipped: 0,
    errors: [] as string[],
    dry_run: dryRun,
  };

  if (dryRun || !orphaned.length) return NextResponse.json(summary);

  // Step 4: Re-enqueue jobs idempotently for each orphaned call
  for (const call of orphaned) {
    const result = await enqueuePostCallJobsForCall({
      workspaceId: call.workspace_id,
      callId: call.id,
      roomName: call.room_name ?? undefined,
      agentId: call.agent_id ?? undefined,
      jobs: RECOVERY_JOBS,
      supabase: admin,
    });

    summary.jobs_enqueued += result.enqueued;
    summary.jobs_skipped += result.skipped;
    if (result.errors.length) {
      summary.errors.push(...result.errors.map((e) => `call ${call.id}: ${e}`));
    }
  }

  return NextResponse.json(summary);
}
