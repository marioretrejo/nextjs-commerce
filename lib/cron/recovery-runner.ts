/**
 * Recovery runner — re-enqueues post_call_jobs for orphaned calls.
 * Called by agent/operational_worker.ts on a slow cadence (every 30–60 min).
 *
 * Safe to run repeatedly — uses ON CONFLICT DO NOTHING.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  enqueuePostCallJobsForCall,
  shouldEnqueuePostCallJobs,
  type EnqueueJobInput,
} from "@/lib/jobs/post-call-jobs";

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

export interface RecoveryRunnerResult {
  scanned: number;
  orphaned: number;
  jobs_enqueued: number;
  jobs_skipped: number;
  errors: string[];
  dry_run: boolean;
  ran_at: string;
}

export async function runRecovery(opts: {
  hours?: number;
  limit?: number;
  dryRun?: boolean;
}): Promise<RecoveryRunnerResult> {
  const hours = Math.min(Math.max(1, opts.hours ?? 48), 168);
  const limit = Math.min(Math.max(1, opts.limit ?? 50), 200);
  const dryRun = opts.dryRun ?? false;

  const admin = createAdminClient();
  const cutoff = new Date(Date.now() - hours * 60 * 60 * 1000).toISOString();

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
    throw new Error(`calls scan failed: ${callsErr.message}`);
  }

  const calls = (recentCalls ?? []) as CallRow[];

  if (!calls.length) {
    return {
      scanned: 0,
      orphaned: 0,
      jobs_enqueued: 0,
      jobs_skipped: 0,
      errors: [],
      dry_run: dryRun,
      ran_at: new Date().toISOString(),
    };
  }

  const callIds = calls.map((c) => c.id);
  const { data: coveredRows } = await admin
    .from("post_call_jobs")
    .select("call_id")
    .in("call_id", callIds);

  const coveredIds = new Set(
    ((coveredRows ?? []) as { call_id: string }[]).map((r) => r.call_id),
  );

  const orphaned = calls.filter(
    (c) => !coveredIds.has(c.id) && shouldEnqueuePostCallJobs(c),
  );

  const summary: RecoveryRunnerResult = {
    scanned: calls.length,
    orphaned: orphaned.length,
    jobs_enqueued: 0,
    jobs_skipped: 0,
    errors: [],
    dry_run: dryRun,
    ran_at: new Date().toISOString(),
  };

  if (dryRun || !orphaned.length) return summary;

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

  return summary;
}
