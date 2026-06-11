/**
 * Provider health runner — called by both /api/cron/provider-health and
 * agent/operational_worker.ts (Render). No HTTP layer.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeProviderHealthFromEvents,
  recordProviderHealthCheck,
  HEALTH_THRESHOLDS,
} from "@/lib/observability/provider-health";

export interface ProviderHealthRunnerResult {
  window_minutes: number;
  events_scanned: number;
  inserted: number;
  insert_errors: number;
  providers: Array<{
    provider: string;
    type: string;
    status: string;
    circuit_state: string;
    sample_size: number;
    error_rate: number;
    fallback_count: number;
  }>;
  degraded: string[];
  down: string[];
  jobs: {
    pending: number;
    running: number;
    retrying: number;
    dead_letter: number;
    failed: number;
    stale_running: number;
  };
  computed_at: string;
}

export async function runProviderHealth(opts: {
  windowMinutes?: 5 | 15;
}): Promise<ProviderHealthRunnerResult> {
  const windowMinutes = opts.windowMinutes ?? 5;
  const windowSeconds = windowMinutes * 60;

  const admin = createAdminClient();
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  const { data: events, error: eventsError } = await admin
    .from("call_events")
    .select("event_type, payload, workspace_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(5000);

  if (eventsError) {
    console.error(
      "[provider-health-runner] call_events query failed:",
      eventsError.message,
    );
    throw new Error(`Failed to query call_events: ${eventsError.message}`);
  }

  const rawEvents = (events ?? []) as Array<{
    event_type: string;
    payload: Record<string, unknown>;
    workspace_id: string;
    created_at: string;
  }>;

  const healthRows = computeProviderHealthFromEvents(rawEvents);

  const staleThreshold = new Date(
    Date.now() - HEALTH_THRESHOLDS.STALE_JOB_MINUTES * 60 * 1000,
  ).toISOString();

  const { data: jobRows } = await admin
    .from("post_call_jobs")
    .select("status, locked_at")
    .in("status", ["pending", "running", "retrying", "dead_letter", "failed"])
    .limit(500);

  let jobPending = 0;
  let jobRunning = 0;
  let jobRetrying = 0;
  let jobDeadLetter = 0;
  let jobFailed = 0;
  let jobStale = 0;

  for (const j of (jobRows ?? []) as Array<{
    status: string;
    locked_at: string | null;
  }>) {
    if (j.status === "pending") jobPending++;
    else if (j.status === "running") {
      jobRunning++;
      if (j.locked_at && j.locked_at < staleThreshold) jobStale++;
    } else if (j.status === "retrying") jobRetrying++;
    else if (j.status === "dead_letter") jobDeadLetter++;
    else if (j.status === "failed") jobFailed++;
  }

  const jobsErrorCount = jobDeadLetter + (jobStale > 0 ? 1 : 0);
  const jobsTotal = jobRunning + jobRetrying + jobDeadLetter + jobFailed;
  if (jobsTotal > 0 || jobPending > 0) {
    const existingIdx = healthRows.findIndex(
      (r) => r.provider === "post_call_jobs",
    );
    const jobsRow = {
      provider: "post_call_jobs" as const,
      providerType: "jobs" as const,
      status: (jobDeadLetter >= HEALTH_THRESHOLDS.DEAD_LETTER_DEGRADED_COUNT ||
      jobStale > 0
        ? jobDeadLetter >= 5
          ? "down"
          : "degraded"
        : "healthy") as import("@/lib/observability/provider-health").ProviderStatus,
      circuitState: (jobDeadLetter >= 5
        ? "open"
        : "closed") as import("@/lib/observability/provider-health").CircuitState,
      latencyMsP50: null,
      latencyMsP95: null,
      errorRate: jobsTotal > 0 ? jobsErrorCount / jobsTotal : 0,
      successRate: jobsTotal > 0 ? (jobsTotal - jobsErrorCount) / jobsTotal : 1,
      sampleSize: jobsTotal,
      fallbackCount: 0,
      fallbackProvider: null,
      lastErrorCode:
        jobDeadLetter > 0
          ? "dead_letter"
          : jobStale > 0
            ? "stale_running"
            : null,
      lastErrorMessage:
        jobDeadLetter > 0 ? `${jobDeadLetter} dead-letter job(s)` : null,
    };
    if (existingIdx >= 0) {
      healthRows[existingIdx] = jobsRow;
    } else {
      healthRows.push(jobsRow);
    }
  }

  let inserted = 0;
  const insertErrors: string[] = [];

  for (const row of healthRows) {
    const { error } = await recordProviderHealthCheck({
      supabase: admin,
      row,
      windowSeconds,
      workspaceId: null,
    });
    if (error) {
      insertErrors.push(`${row.provider}: ${error}`);
    } else {
      inserted++;
    }
  }

  const degraded = healthRows
    .filter((r) => r.status === "degraded")
    .map((r) => r.provider);
  const down = healthRows
    .filter((r) => r.status === "down")
    .map((r) => r.provider);

  if (down.length > 0) {
    console.error("[provider-health-runner] providers DOWN:", down.join(", "));
  }
  if (degraded.length > 0) {
    console.warn(
      "[provider-health-runner] providers DEGRADED:",
      degraded.join(", "),
    );
  }
  if (insertErrors.length > 0) {
    console.warn("[provider-health-runner] insert errors:", insertErrors);
  }

  return {
    window_minutes: windowMinutes,
    events_scanned: rawEvents.length,
    inserted,
    insert_errors: insertErrors.length,
    providers: healthRows.map((r) => ({
      provider: r.provider,
      type: r.providerType,
      status: r.status,
      circuit_state: r.circuitState,
      sample_size: r.sampleSize,
      error_rate: r.errorRate,
      fallback_count: r.fallbackCount,
    })),
    degraded,
    down,
    jobs: {
      pending: jobPending,
      running: jobRunning,
      retrying: jobRetrying,
      dead_letter: jobDeadLetter,
      failed: jobFailed,
      stale_running: jobStale,
    },
    computed_at: new Date().toISOString(),
  };
}
