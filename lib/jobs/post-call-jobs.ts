/**
 * lib/jobs/post-call-jobs.ts
 *
 * Job repository for post-call persistent job queue (migration 056).
 *
 * Design principles:
 *   - All functions accept an injected Supabase client (works in worker + Next.js)
 *   - Never stores secrets in payload / result / error_message
 *   - claimNextPostCallJobs uses FOR UPDATE SKIP LOCKED via Postgres RPC
 *   - Exponential backoff: 30s → 2m → 10m → 30m → dead_letter
 *   - Every function is non-throwing: errors are returned, not raised
 */
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Types ─────────────────────────────────────────────────────────────────────

export type PostCallJobType =
  | "crm_extraction"
  | "qa_analysis"
  | "outbound_webhook"
  | "integration_dispatch"
  | "cost_finalization"
  | "transcript_postprocess"
  | "call_summary"
  | "cleanup";

export type PostCallJobStatus =
  | "pending"
  | "running"
  | "completed"
  | "retrying"
  | "failed"
  | "dead_letter"
  | "canceled";

export interface PostCallJob {
  id: string;
  workspace_id: string;
  call_id: string | null;
  room_name: string | null;
  agent_id: string | null;
  job_type: PostCallJobType;
  status: PostCallJobStatus;
  priority: number;
  attempts: number;
  max_attempts: number;
  payload: Record<string, unknown>;
  result: Record<string, unknown> | null;
  error_message: string | null;
  error_code: string | null;
  locked_at: string | null;
  locked_by: string | null;
  run_after: string;
  started_at: string | null;
  completed_at: string | null;
  failed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface EnqueueJobInput {
  job_type: PostCallJobType;
  priority?: number;
  max_attempts?: number;
  run_after?: Date;
  payload?: Record<string, unknown>;
}

export interface EnqueueForCallInput {
  workspaceId: string;
  callId: string;
  roomName?: string;
  agentId?: string;
  jobs: EnqueueJobInput[];
  supabase: SupabaseClient;
}

export interface EnqueueForCallResult {
  enqueued: number;
  skipped: number;
  errors: string[];
}

// Backoff delays in seconds: attempt 1=30s, 2=120s, 3=600s, 4=1800s, 5+=dead_letter
const BACKOFF_SECONDS = [30, 120, 600, 1800] as const;

function backoffSeconds(attempts: number): number {
  return (
    BACKOFF_SECONDS[Math.min(attempts - 1, BACKOFF_SECONDS.length - 1)] ?? 1800
  );
}

// ── Enqueue ───────────────────────────────────────────────────────────────────

export async function enqueuePostCallJob(
  supabase: SupabaseClient,
  workspaceId: string,
  callId: string | null,
  input: EnqueueJobInput & { roomName?: string; agentId?: string },
): Promise<{ jobId: string | null; error: string | null }> {
  try {
    const { data, error } = await supabase
      .from("post_call_jobs")
      .insert({
        workspace_id: workspaceId,
        call_id: callId,
        room_name: input.roomName ?? null,
        agent_id: input.agentId ?? null,
        job_type: input.job_type,
        priority: input.priority ?? 100,
        max_attempts: input.max_attempts ?? 5,
        payload: input.payload ?? {},
        run_after: input.run_after?.toISOString() ?? new Date().toISOString(),
      })
      .select("id")
      .single();

    if (error) return { jobId: null, error: error.message };
    return { jobId: (data as { id: string }).id, error: null };
  } catch (err) {
    return { jobId: null, error: String(err) };
  }
}

export async function enqueuePostCallJobsForCall(
  input: EnqueueForCallInput,
): Promise<EnqueueForCallResult> {
  const { workspaceId, callId, roomName, agentId, jobs, supabase } = input;
  const errors: string[] = [];

  const rows = jobs.map((j) => ({
    workspace_id: workspaceId,
    call_id: callId,
    room_name: roomName ?? null,
    agent_id: agentId ?? null,
    job_type: j.job_type,
    priority: j.priority ?? 100,
    max_attempts: j.max_attempts ?? 5,
    payload: j.payload ?? {},
    run_after: j.run_after?.toISOString() ?? new Date().toISOString(),
  }));

  try {
    // Uses ON CONFLICT (call_id, job_type) DO NOTHING — idempotent.
    // Returns only the rows actually inserted; skipped = total - inserted.
    const { data, error } = await supabase.rpc(
      "enqueue_post_call_jobs_idempotent",
      { p_jobs: rows },
    );

    if (error) {
      errors.push(error.message);
      return { enqueued: 0, skipped: jobs.length, errors };
    }

    const inserted = (data as { id: string }[] | null) ?? [];
    return {
      enqueued: inserted.length,
      skipped: jobs.length - inserted.length,
      errors,
    };
  } catch (err) {
    errors.push(String(err));
    return { enqueued: 0, skipped: jobs.length, errors };
  }
}

// ── Claim ─────────────────────────────────────────────────────────────────────

export async function claimNextPostCallJobs(
  supabase: SupabaseClient,
  workerId: string,
  limit = 10,
  jobType?: PostCallJobType,
): Promise<PostCallJob[]> {
  try {
    const { data, error } = await supabase.rpc("claim_post_call_jobs", {
      p_worker_id: workerId,
      p_limit: limit,
      p_job_type: jobType ?? null,
    });
    if (error) {
      console.warn("[post-call-jobs] claim failed:", error.message);
      return [];
    }
    return (data as PostCallJob[]) ?? [];
  } catch (err) {
    console.warn("[post-call-jobs] claim threw:", String(err));
    return [];
  }
}

// ── Status transitions ────────────────────────────────────────────────────────

export async function markJobRunning(
  supabase: SupabaseClient,
  jobId: string,
  workerId: string,
): Promise<void> {
  await supabase
    .from("post_call_jobs")
    .update({
      status: "running",
      locked_at: new Date().toISOString(),
      locked_by: workerId,
    })
    .eq("id", jobId)
    .then(
      () => null,
      () => null,
    );
}

export async function markJobCompleted(
  supabase: SupabaseClient,
  jobId: string,
  result: Record<string, unknown>,
): Promise<void> {
  await supabase
    .from("post_call_jobs")
    .update({
      status: "completed",
      result,
      completed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
    })
    .eq("id", jobId)
    .then(
      () => null,
      () => null,
    );
}

export async function markJobFailed(
  supabase: SupabaseClient,
  jobId: string,
  error: { message: string; code?: string },
): Promise<void> {
  await supabase
    .from("post_call_jobs")
    .update({
      status: "failed",
      error_message: error.message.slice(0, 500),
      error_code: error.code ?? null,
      failed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
    })
    .eq("id", jobId)
    .then(
      () => null,
      () => null,
    );
}

export async function markJobRetrying(
  supabase: SupabaseClient,
  jobId: string,
  error: { message: string; code?: string },
  attempts: number,
): Promise<void> {
  const delaySec = backoffSeconds(attempts);
  const nextRunAt = new Date(Date.now() + delaySec * 1000).toISOString();

  await supabase
    .from("post_call_jobs")
    .update({
      status: "retrying",
      error_message: error.message.slice(0, 500),
      error_code: error.code ?? null,
      run_after: nextRunAt,
      locked_at: null,
      locked_by: null,
    })
    .eq("id", jobId)
    .then(
      () => null,
      () => null,
    );
}

export async function markJobDeadLetter(
  supabase: SupabaseClient,
  jobId: string,
  error: { message: string; code?: string },
): Promise<void> {
  await supabase
    .from("post_call_jobs")
    .update({
      status: "dead_letter",
      error_message: error.message.slice(0, 500),
      error_code: error.code ?? null,
      failed_at: new Date().toISOString(),
      locked_at: null,
      locked_by: null,
    })
    .eq("id", jobId)
    .then(
      () => null,
      () => null,
    );
}

export async function cancelPendingJobsForCall(
  supabase: SupabaseClient,
  callId: string,
): Promise<number> {
  try {
    const { data } = await supabase
      .from("post_call_jobs")
      .update({ status: "canceled" })
      .eq("call_id", callId)
      .in("status", ["pending", "retrying"])
      .select("id");
    return (data as { id: string }[] | null)?.length ?? 0;
  } catch {
    return 0;
  }
}

export async function getJobsForCall(
  supabase: SupabaseClient,
  callId: string,
): Promise<PostCallJob[]> {
  try {
    const { data } = await supabase
      .from("post_call_jobs")
      .select("*")
      .eq("call_id", callId)
      .order("created_at", { ascending: true });
    return (data as PostCallJob[]) ?? [];
  } catch {
    return [];
  }
}

// ── Eligibility ───────────────────────────────────────────────────────────────

/**
 * Returns true when a call row should receive post_call_jobs.
 *
 * Requires explicit agent session evidence (has_agent_session=true), which is
 * determined by the caller via call_events inspection. This prevents creating
 * CRM/QA/integration jobs for calls where only telephony connected but no real
 * voice session occurred (trial disclaimer, voicemail, TwiML error, etc.).
 *
 * The voice worker close handler is the primary creator of post_call_jobs.
 * Recovery runners use this function to re-enqueue for orphaned calls.
 */
export function shouldEnqueuePostCallJobs(call: {
  technical_status: string | null;
  ended_at: string | null;
  has_agent_session: boolean;
}): boolean {
  if (!call.ended_at) return false;
  if (!call.has_agent_session) return false;
  if (call.technical_status === "no_answer") return false;
  if (call.technical_status === "failed") return false;
  return true;
}

// ── Retry decision ────────────────────────────────────────────────────────────

export interface RetryDecision {
  shouldRetry: boolean;
  isDeadLetter: boolean;
  reason: string;
}

export function shouldRetryJob(
  job: Pick<PostCallJob, "attempts" | "max_attempts">,
  errorCode?: string,
): RetryDecision {
  // Permanent errors — never retry
  const permanentCodes = [
    "400",
    "401",
    "403",
    "not_found",
    "workspace_not_found",
    "call_not_found",
  ];
  if (errorCode && permanentCodes.includes(errorCode)) {
    return {
      shouldRetry: false,
      isDeadLetter: job.attempts >= job.max_attempts,
      reason: "permanent_error",
    };
  }

  if (job.attempts >= job.max_attempts) {
    return {
      shouldRetry: false,
      isDeadLetter: true,
      reason: "max_attempts_reached",
    };
  }

  return { shouldRetry: true, isDeadLetter: false, reason: "transient_error" };
}
