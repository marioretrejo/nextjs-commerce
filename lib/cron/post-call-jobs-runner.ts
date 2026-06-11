/**
 * Post-call jobs runner — called by both /api/cron/post-call-jobs and
 * agent/operational_worker.ts (Render). No HTTP layer.
 */
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

export interface PostCallJobsRunnerResult {
  claimed: number;
  completed: number;
  retrying: number;
  failed: number;
  dead_letter: number;
  ran_at: string;
}

export async function runPostCallJobs(opts: {
  workerId: string;
  limit?: number;
  jobType?: PostCallJobType;
}): Promise<PostCallJobsRunnerResult> {
  const { workerId, limit = 10, jobType } = opts;
  const cap = Math.min(Math.max(1, limit), 50);

  const admin = createAdminClient();
  const jobs = await claimNextPostCallJobs(admin, workerId, cap, jobType);

  const result: PostCallJobsRunnerResult = {
    claimed: jobs.length,
    completed: 0,
    retrying: 0,
    failed: 0,
    dead_letter: 0,
    ran_at: new Date().toISOString(),
  };

  for (const job of jobs) {
    try {
      const outcome = await processPostCallJob(admin, job);
      await markJobCompleted(admin, job.id, outcome);
      result.completed++;
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
        result.dead_letter++;
      } else if (decision.shouldRetry) {
        await markJobRetrying(
          admin,
          job.id,
          { message: errorMsg, code: errorCode },
          job.attempts,
        );
        result.retrying++;
      } else {
        await markJobFailed(admin, job.id, {
          message: errorMsg,
          code: errorCode,
        });
        result.failed++;
      }
    }
  }

  return result;
}
