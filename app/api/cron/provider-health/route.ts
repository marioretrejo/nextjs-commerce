/**
 * GET /api/cron/provider-health
 *
 * Periodic cron that computes provider health snapshots from call_events
 * and inserts them into provider_health_checks.
 *
 * Auth: Bearer INTERNAL_API_SECRET or x-internal-secret header (timing-safe).
 * Schedule: every 5 minutes (see vercel.json).
 *
 * NO active probes by default.
 * Set VOICEOS_PROVIDER_HEALTH_ACTIVE_PROBES=true to enable lightweight
 * external probes (not yet implemented — reserved for future use).
 *
 * Query params:
 *   window_minutes  — 5 | 15  (default 5 for cron, 15 for summary)
 */
import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  computeProviderHealthFromEvents,
  recordProviderHealthCheck,
  HEALTH_THRESHOLDS,
} from "@/lib/observability/provider-health";
import { timingSafeEqual } from "node:crypto";

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
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const authHeader = req.headers.get("Authorization");
  const secretHeader = req.headers.get("x-internal-secret");
  const provided = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : secretHeader;

  if (!verifySecret(provided)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  // Active probes guard (disabled by default)
  const activeProbes =
    process.env["VOICEOS_PROVIDER_HEALTH_ACTIVE_PROBES"] === "true";
  if (activeProbes) {
    // Reserved for future external health probes.
    // Currently a no-op — active probes not yet implemented.
    console.log(
      "[provider-health-cron] active probes enabled but not yet implemented",
    );
  }

  const url = new URL(req.url);
  const windowParam = parseInt(
    url.searchParams.get("window_minutes") ?? "5",
    10,
  );
  const windowMinutes = [5, 15].includes(windowParam) ? windowParam : 5;
  const windowSeconds = windowMinutes * 60;

  const admin = createAdminClient();
  const since = new Date(Date.now() - windowSeconds * 1000).toISOString();

  // ── Fetch call_events in window ───────────────────────────────────────────────
  const { data: events, error: eventsError } = await admin
    .from("call_events")
    .select("event_type, payload, workspace_id, created_at")
    .gte("created_at", since)
    .order("created_at", { ascending: true })
    .limit(5000); // hard cap to avoid memory issues

  if (eventsError) {
    console.error(
      "[provider-health-cron] call_events query failed:",
      eventsError.message,
    );
    return NextResponse.json(
      { error: "Failed to query call_events", detail: eventsError.message },
      { status: 500 },
    );
  }

  const rawEvents = (events ?? []) as Array<{
    event_type: string;
    payload: Record<string, unknown>;
    workspace_id: string;
    created_at: string;
  }>;

  // ── Compute global health (all workspaces combined) ───────────────────────────
  const healthRows = computeProviderHealthFromEvents(rawEvents);

  // ── Also compute post_call_jobs stats directly ────────────────────────────────
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

  // Synthesize a jobs health row from DB state
  const jobsErrorCount = jobDeadLetter + (jobStale > 0 ? 1 : 0);
  const jobsTotal = jobRunning + jobRetrying + jobDeadLetter + jobFailed;
  if (jobsTotal > 0 || jobPending > 0) {
    const existingJobsIdx = healthRows.findIndex(
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
    if (existingJobsIdx >= 0) {
      healthRows[existingJobsIdx] = jobsRow;
    } else {
      healthRows.push(jobsRow);
    }
  }

  // ── Insert snapshots ──────────────────────────────────────────────────────────
  let inserted = 0;
  const insertErrors: string[] = [];

  for (const row of healthRows) {
    const { error } = await recordProviderHealthCheck({
      supabase: admin,
      row,
      windowSeconds,
      workspaceId: null, // global snapshot
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

  if (insertErrors.length > 0) {
    console.warn("[provider-health-cron] insert errors:", insertErrors);
  }

  const response = {
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

  // Log degraded/down for observability
  if (down.length > 0) {
    console.error("[provider-health-cron] providers DOWN:", down.join(", "));
  }
  if (degraded.length > 0) {
    console.warn(
      "[provider-health-cron] providers DEGRADED:",
      degraded.join(", "),
    );
  }

  return NextResponse.json(response);
}
