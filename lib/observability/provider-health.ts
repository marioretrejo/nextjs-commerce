/**
 * lib/observability/provider-health.ts
 *
 * Provider health computation from call_events, post_call_jobs, and
 * provider_health_checks snapshots.
 *
 * Security rules (enforced throughout):
 *   1. Never store/return API keys, tokens, Bearer values.
 *   2. last_error_message is sanitized + truncated before storage.
 *   3. metadata cannot contain auth headers or raw request bodies.
 *   4. No active probes by default — health is derived from existing event data.
 *
 * circuit_state semantics:
 *   This is an INFERRED state computed from event patterns.
 *   It is NOT a real circuit breaker state machine.
 *   See docs/provider-health.md for the distinction.
 */
import type { SupabaseClient } from "@supabase/supabase-js";

// ── Public types ───────────────────────────────────────────────────────────────

export type ProviderName =
  | "groq"
  | "openai"
  | "cartesia"
  | "deepgram"
  | "livekit"
  | "twilio"
  | "supabase"
  | "webhook"
  | "post_call_jobs"
  | "cron"
  | "unknown";

export type ProviderType =
  | "llm"
  | "tts"
  | "stt"
  | "telephony"
  | "database"
  | "webhook"
  | "jobs"
  | "cron"
  | "realtime"
  | "internal";

export type ProviderStatus = "healthy" | "degraded" | "down" | "unknown";
export type CircuitState =
  | "closed"
  | "half_open"
  | "open"
  | "disabled"
  | "unknown";

// ── Configurable thresholds ───────────────────────────────────────────────────

export const HEALTH_THRESHOLDS = {
  /** error_rate >= this → degraded */
  ERROR_RATE_DEGRADED: 0.1,
  /** error_rate >= this → down */
  ERROR_RATE_DOWN: 0.4,
  /** p95 latency ms >= this → degraded */
  LATENCY_MS_DEGRADED: 2000,
  /** p95 latency ms >= this → down */
  LATENCY_MS_DOWN: 5000,
  /** any fallback in window → degraded (even if primary is now healthy) */
  FALLBACK_COUNT_DEGRADED: 1,
  /** minimum events in window before classifying (fewer → unknown) */
  MIN_SAMPLE_FOR_CLASSIFICATION: 3,
  /** error_rate above this threshold → infer circuit = open */
  CIRCUIT_OPEN_ERROR_RATE: 0.5,
  /** job running > this many minutes → stale */
  STALE_JOB_MINUTES: 10,
  /** any dead_letter jobs in window → jobs health degraded */
  DEAD_LETTER_DEGRADED_COUNT: 1,
} as const;

// ── Secret scrubbing ──────────────────────────────────────────────────────────

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[\w\-.]+/gi,
  /api[-_]?key[:\s=]+[\w\-.]+/gi,
  /token[:\s=]+[\w\-.]+/gi,
  /password[:\s=]+\S+/gi,
  /secret[:\s=]+[\w\-.]+/gi,
  /authorization[:\s=]+\S+/gi,
  /sk-[\w\-]{20,}/gi,
  // Anything that looks like a 40+ char token/hash
  /[A-Za-z0-9_\-]{40,}/g,
];

/** Strip potential secrets from an error before storing it. */
export function sanitizeProviderError(error: unknown): string {
  const raw = error instanceof Error ? error.message : String(error ?? "");
  let s = raw.slice(0, 800);
  for (const p of SECRET_PATTERNS) {
    s = s.replace(p, "[REDACTED]");
  }
  return s.slice(0, 200);
}

// ── Metrics interface ─────────────────────────────────────────────────────────

export interface ProviderMetrics {
  provider: ProviderName;
  providerType: ProviderType;
  sampleSize: number;
  successCount: number;
  errorCount: number;
  fallbackCount: number;
  latencyValues?: number[];
  lastErrorCode?: string;
  lastErrorMessage?: string;
  circuitBreakerTriggered?: boolean;
}

export interface ClassifyResult {
  status: ProviderStatus;
  circuitState: CircuitState;
  errorRate: number;
  successRate: number;
  latencyMsP50: number | null;
  latencyMsP95: number | null;
}

// ── Classification ────────────────────────────────────────────────────────────

function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const idx = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.max(0, idx)]!;
}

export function classifyProviderStatus(m: ProviderMetrics): ClassifyResult {
  if (m.sampleSize < HEALTH_THRESHOLDS.MIN_SAMPLE_FOR_CLASSIFICATION) {
    return {
      status: "unknown",
      circuitState: "unknown",
      errorRate: 0,
      successRate: 0,
      latencyMsP50: null,
      latencyMsP95: null,
    };
  }

  const total = m.successCount + m.errorCount;
  const errorRate = total > 0 ? m.errorCount / total : 0;
  const successRate = total > 0 ? m.successCount / total : 0;

  const sorted = m.latencyValues
    ? [...m.latencyValues].sort((a, b) => a - b)
    : [];
  const latencyMsP50 = sorted.length > 0 ? percentile(sorted, 50) : null;
  const latencyMsP95 = sorted.length > 0 ? percentile(sorted, 95) : null;
  const p95 = latencyMsP95 ?? 0;

  // Infer circuit state from error rate
  let circuitState: CircuitState = "closed";
  if (
    m.circuitBreakerTriggered ||
    errorRate >= HEALTH_THRESHOLDS.CIRCUIT_OPEN_ERROR_RATE
  ) {
    circuitState = "open";
  } else if (errorRate >= HEALTH_THRESHOLDS.ERROR_RATE_DOWN) {
    circuitState = "half_open";
  }

  // Classify status
  let status: ProviderStatus = "healthy";
  if (
    errorRate >= HEALTH_THRESHOLDS.ERROR_RATE_DOWN ||
    p95 >= HEALTH_THRESHOLDS.LATENCY_MS_DOWN
  ) {
    status = "down";
    if (circuitState !== "open") circuitState = "open";
  } else if (
    errorRate >= HEALTH_THRESHOLDS.ERROR_RATE_DEGRADED ||
    p95 >= HEALTH_THRESHOLDS.LATENCY_MS_DEGRADED ||
    m.fallbackCount >= HEALTH_THRESHOLDS.FALLBACK_COUNT_DEGRADED
  ) {
    status = "degraded";
    if (circuitState === "closed") circuitState = "half_open";
  }

  return {
    status,
    circuitState,
    errorRate,
    successRate,
    latencyMsP50,
    latencyMsP95,
  };
}

// ── Event → metrics computation ───────────────────────────────────────────────

interface RawCallEvent {
  event_type: string;
  payload: Record<string, unknown>;
  created_at: string;
}

interface ProviderHealthRow {
  provider: ProviderName;
  providerType: ProviderType;
  status: ProviderStatus;
  circuitState: CircuitState;
  latencyMsP50: number | null;
  latencyMsP95: number | null;
  errorRate: number;
  successRate: number;
  sampleSize: number;
  fallbackCount: number;
  fallbackProvider: string | null;
  lastErrorCode: string | null;
  lastErrorMessage: string | null;
}

/**
 * Derives per-provider health metrics from a batch of call_events rows.
 * Pure function — no I/O.
 */
export function computeProviderHealthFromEvents(
  events: RawCallEvent[],
): ProviderHealthRow[] {
  // Accumulators keyed by provider name
  const acc = new Map<
    ProviderName,
    {
      type: ProviderType;
      metrics: ProviderMetrics;
      lastErrorCode: string | null;
      lastErrorMessage: string | null;
      lastFallbackProvider: string | null;
    }
  >();

  function getAcc(
    provider: ProviderName,
    type: ProviderType,
  ): typeof acc extends Map<string, infer V> ? V : never {
    if (!acc.has(provider)) {
      acc.set(provider, {
        type,
        metrics: {
          provider,
          providerType: type,
          sampleSize: 0,
          successCount: 0,
          errorCount: 0,
          fallbackCount: 0,
          latencyValues: [],
          circuitBreakerTriggered: false,
        },
        lastErrorCode: null,
        lastErrorMessage: null,
        lastFallbackProvider: null,
      });
    }
    return acc.get(provider)!;
  }

  function p(ev: RawCallEvent, key: string): unknown {
    return ev.payload[key];
  }

  for (const ev of events) {
    const et = ev.event_type;
    const payload = ev.payload;

    // ── LLM: Groq ──────────────────────────────────────────────────────────────
    if (et === "llm.provider_selected" && p(ev, "provider") === "groq") {
      const a = getAcc("groq", "llm");
      a.metrics.sampleSize++;
      a.metrics.successCount++;
      const lat = payload["latency_ms"];
      if (typeof lat === "number") a.metrics.latencyValues!.push(lat);
    } else if (
      et === "llm.provider_selected" &&
      p(ev, "provider") === "openai"
    ) {
      const a = getAcc("openai", "llm");
      a.metrics.sampleSize++;
      a.metrics.successCount++;
      const lat = payload["latency_ms"];
      if (typeof lat === "number") a.metrics.latencyValues!.push(lat);
    } else if (et === "llm.provider_degraded") {
      const prov = String(payload["provider"] ?? "groq") as ProviderName;
      const a = getAcc(prov, "llm");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
    } else if (et === "llm.provider_down") {
      const prov = String(payload["provider"] ?? "groq") as ProviderName;
      const a = getAcc(prov, "llm");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      const ec = String(payload["error_code"] ?? "provider_down");
      const em = sanitizeProviderError(
        payload["error"] ?? payload["reason"] ?? "provider_down",
      );
      a.lastErrorCode = ec;
      a.lastErrorMessage = em;
    } else if (et === "llm.provider_constructor_failed") {
      const prov = String(payload["provider"] ?? "groq") as ProviderName;
      const a = getAcc(prov, "llm");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      a.lastErrorCode = "constructor_failed";
      a.lastErrorMessage = sanitizeProviderError(
        payload["reason"] ?? payload["error"] ?? "constructor_failed",
      );
    } else if (et === "llm.slow" || et === "llm.timeout") {
      const prov = String(payload["provider"] ?? "groq") as ProviderName;
      const a = getAcc(prov, "llm");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      const lat = payload["latency_ms"] ?? payload["elapsed_ms"];
      if (typeof lat === "number") a.metrics.latencyValues!.push(lat);
    } else if (
      et === "llm.fallback_selected" ||
      et === "llm.fallback_used" ||
      et === "llm.fallback_attempted"
    ) {
      const fromProv = String(
        payload["from"] ?? payload["provider"] ?? "groq",
      ) as ProviderName;
      const toProv = String(
        payload["to"] ?? payload["fallback_provider"] ?? "openai",
      );
      const a = getAcc(fromProv, "llm");
      a.metrics.sampleSize++;
      a.metrics.fallbackCount++;
      a.lastFallbackProvider = toProv;
    } else if (et === "llm.fallback_succeeded") {
      const a = getAcc("openai", "llm");
      a.metrics.sampleSize++;
      a.metrics.successCount++;
    } else if (et === "llm.fallback_failed") {
      const a = getAcc("openai", "llm");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      a.lastErrorCode = "fallback_failed";
      a.lastErrorMessage = sanitizeProviderError(
        payload["error"] ?? payload["reason"] ?? "fallback failed",
      );
    } else if (
      et === "llm.runtime_fallback_unavailable" ||
      et === "llm.emergency_response_used"
    ) {
      const a = getAcc("groq", "llm");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      a.lastErrorCode = et;

      // ── TTS: Cartesia ────────────────────────────────────────────────────────
    } else if (
      et === "tts.provider_selected" &&
      p(ev, "provider") === "cartesia"
    ) {
      const a = getAcc("cartesia", "tts");
      a.metrics.sampleSize++;
      a.metrics.successCount++;
    } else if (
      et === "tts.provider_selected" &&
      p(ev, "provider") === "openai"
    ) {
      const a = getAcc("openai", "tts");
      a.metrics.sampleSize++;
      a.metrics.successCount++;
    } else if (et === "tts.provider_degraded") {
      const prov = String(payload["provider"] ?? "cartesia") as ProviderName;
      const a = getAcc(prov, "tts");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
    } else if (et === "tts.provider_down") {
      const prov = String(payload["provider"] ?? "cartesia") as ProviderName;
      const a = getAcc(prov, "tts");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      a.lastErrorCode = "provider_down";
      a.lastErrorMessage = sanitizeProviderError(
        payload["error"] ?? payload["reason"] ?? "provider_down",
      );
    } else if (et === "tts.provider_constructor_failed") {
      const prov = String(payload["provider"] ?? "cartesia") as ProviderName;
      const a = getAcc(prov, "tts");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      a.lastErrorCode = "constructor_failed";
      a.lastErrorMessage = sanitizeProviderError(
        payload["reason"] ?? "constructor_failed",
      );
    } else if (et === "tts.first_audio_slow") {
      const prov = String(payload["provider"] ?? "cartesia") as ProviderName;
      const a = getAcc(prov, "tts");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      const ttfb =
        payload["ttfb_ms"] ?? payload["latency_ms"] ?? payload["elapsed_ms"];
      if (typeof ttfb === "number") a.metrics.latencyValues!.push(ttfb);
    } else if (
      et === "tts.first_audio_timeout" ||
      et === "tts.manual_say_failed"
    ) {
      const prov = String(payload["provider"] ?? "cartesia") as ProviderName;
      const a = getAcc(prov, "tts");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      a.lastErrorCode = et;
    } else if (
      et === "tts.fallback_selected" ||
      et === "tts.fallback_used" ||
      et === "tts.fallback_attempted"
    ) {
      const fromProv = String(
        payload["from"] ?? payload["provider"] ?? "cartesia",
      ) as ProviderName;
      const toProv = String(
        payload["to"] ?? payload["fallback_provider"] ?? "openai",
      );
      const a = getAcc(fromProv, "tts");
      a.metrics.sampleSize++;
      a.metrics.fallbackCount++;
      a.lastFallbackProvider = toProv;
    } else if (et === "tts.fallback_succeeded") {
      const a = getAcc("openai", "tts");
      a.metrics.sampleSize++;
      a.metrics.successCount++;
    } else if (
      et === "tts.fallback_failed" ||
      et === "tts.fallback_unavailable"
    ) {
      const a = getAcc("openai", "tts");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      a.lastErrorCode = et;
    } else if (et === "tts.provider_recovered") {
      const prov = String(payload["provider"] ?? "cartesia") as ProviderName;
      const a = getAcc(prov, "tts");
      a.metrics.sampleSize++;
      a.metrics.successCount++;

      // ── Billing / circuit breaker ────────────────────────────────────────────
    } else if (et === "billing.circuit_breaker_triggered") {
      // Not provider-specific — mark billing as having circuit open
      const a = getAcc("supabase", "database");
      a.metrics.circuitBreakerTriggered = true;
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      a.lastErrorCode = "billing_circuit_breaker";
    } else if (et === "billing.preflight_failed") {
      const a = getAcc("supabase", "database");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      a.lastErrorCode = String(payload["reason"] ?? "preflight_failed");

      // ── Webhooks ─────────────────────────────────────────────────────────────
    } else if (et === "webhook.sent") {
      const a = getAcc("webhook", "webhook");
      a.metrics.sampleSize++;
      a.metrics.successCount++;
    } else if (et === "webhook.failed") {
      const a = getAcc("webhook", "webhook");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      const status = payload["http_status"] ?? payload["status"];
      a.lastErrorCode =
        typeof status === "number" ? String(status) : "delivery_failed";
      a.lastErrorMessage = sanitizeProviderError(
        payload["error"] ?? "delivery failed",
      );

      // ── Post-call jobs ────────────────────────────────────────────────────────
    } else if (et === "post_call_jobs.completed") {
      const a = getAcc("post_call_jobs", "jobs");
      a.metrics.sampleSize++;
      a.metrics.successCount++;
    } else if (et === "post_call_jobs.failed") {
      const a = getAcc("post_call_jobs", "jobs");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      a.lastErrorCode = String(payload["error_code"] ?? "job_failed");
      a.lastErrorMessage = sanitizeProviderError(
        payload["error_message"] ?? payload["error"] ?? "job failed",
      );
    } else if (et === "post_call_jobs.dead_letter") {
      const a = getAcc("post_call_jobs", "jobs");
      a.metrics.sampleSize++;
      a.metrics.errorCount++;
      a.lastErrorCode = "dead_letter";
      a.lastErrorMessage = sanitizeProviderError(
        payload["error_message"] ?? payload["error"] ?? "dead letter",
      );
    } else if (et === "post_call_jobs.retry_scheduled") {
      const a = getAcc("post_call_jobs", "jobs");
      a.metrics.sampleSize++;
    }
  }

  // Convert accumulators to health rows
  const result: ProviderHealthRow[] = [];
  for (const [, entry] of acc) {
    const classified = classifyProviderStatus(entry.metrics);
    result.push({
      provider: entry.metrics.provider,
      providerType: entry.type,
      status: classified.status,
      circuitState: classified.circuitState,
      latencyMsP50: classified.latencyMsP50,
      latencyMsP95: classified.latencyMsP95,
      errorRate: classified.errorRate,
      successRate: classified.successRate,
      sampleSize: entry.metrics.sampleSize,
      fallbackCount: entry.metrics.fallbackCount,
      fallbackProvider: entry.lastFallbackProvider,
      lastErrorCode: entry.lastErrorCode,
      lastErrorMessage: entry.lastErrorMessage,
    });
  }
  return result;
}

// ── Insert health snapshot ────────────────────────────────────────────────────

export interface RecordHealthCheckInput {
  supabase: SupabaseClient;
  row: ProviderHealthRow;
  windowSeconds: number;
  workspaceId?: string | null;
}

export async function recordProviderHealthCheck(
  input: RecordHealthCheckInput,
): Promise<{ error: string | null }> {
  const { supabase, row, windowSeconds, workspaceId } = input;
  const { error } = await supabase.from("provider_health_checks").insert({
    workspace_id: workspaceId ?? null,
    provider: row.provider,
    provider_type: row.providerType,
    status: row.status,
    latency_ms: row.latencyMsP95, // store p95 as the canonical latency
    error_rate: row.errorRate,
    success_rate: row.successRate,
    sample_size: row.sampleSize,
    window_seconds: windowSeconds,
    circuit_state: row.circuitState,
    fallback_provider: row.fallbackProvider,
    fallback_count: row.fallbackCount,
    last_error_code: row.lastErrorCode,
    last_error_message: row.lastErrorMessage,
    metadata: {
      latency_p50: row.latencyMsP50,
      latency_p95: row.latencyMsP95,
    },
    checked_at: new Date().toISOString(),
  });
  return { error: error ? error.message : null };
}

// ── Query health summary ──────────────────────────────────────────────────────

export interface GetSummaryInput {
  supabase: SupabaseClient;
  windowMinutes?: number;
  workspaceId?: string | null;
}

export interface HealthSummaryRow {
  provider: string;
  provider_type: string;
  status: ProviderStatus;
  circuit_state: CircuitState;
  latency_ms: number | null;
  error_rate: number | null;
  success_rate: number | null;
  sample_size: number;
  fallback_count: number;
  fallback_provider: string | null;
  last_error_code: string | null;
  last_error_message: string | null;
  checked_at: string;
}

export async function getProviderHealthSummary(
  input: GetSummaryInput,
): Promise<{ rows: HealthSummaryRow[]; error: string | null }> {
  const { supabase, windowMinutes = 15, workspaceId } = input;
  const { data, error } = await supabase.rpc("get_provider_health_summary", {
    p_workspace_id: workspaceId ?? null,
    p_window_minutes: windowMinutes,
  });
  if (error) return { rows: [], error: error.message };
  return { rows: (data as HealthSummaryRow[]) ?? [], error: null };
}

// ── Query jobs health ─────────────────────────────────────────────────────────

export interface JobsHealth {
  pending: number;
  running: number;
  retrying: number;
  dead_letter: number;
  failed: number;
  stale_running: number;
}

export async function getJobsHealth(
  supabase: SupabaseClient,
  workspaceId?: string | null,
): Promise<JobsHealth> {
  const base = supabase
    .from("post_call_jobs")
    .select("status, locked_at", { count: "exact", head: false });

  const query = workspaceId ? base.eq("workspace_id", workspaceId) : base;

  const { data } = await query.in("status", [
    "pending",
    "running",
    "retrying",
    "dead_letter",
    "failed",
  ]);

  const rows = (data ?? []) as { status: string; locked_at: string | null }[];
  const staleThreshold = new Date(
    Date.now() - HEALTH_THRESHOLDS.STALE_JOB_MINUTES * 60 * 1000,
  ).toISOString();

  const counts: JobsHealth = {
    pending: 0,
    running: 0,
    retrying: 0,
    dead_letter: 0,
    failed: 0,
    stale_running: 0,
  };
  for (const r of rows) {
    if (r.status === "pending") counts.pending++;
    else if (r.status === "running") {
      counts.running++;
      if (r.locked_at && r.locked_at < staleThreshold) counts.stale_running++;
    } else if (r.status === "retrying") counts.retrying++;
    else if (r.status === "dead_letter") counts.dead_letter++;
    else if (r.status === "failed") counts.failed++;
  }
  return counts;
}

// ── Query webhook health ──────────────────────────────────────────────────────

export interface WebhookHealth {
  sent: number;
  failed: number;
  retrying: number;
  /** Events present in window with no response (outstanding) */
  pending: number;
}

export async function getWebhookHealthFromEvents(
  supabase: SupabaseClient,
  windowMinutes: number,
  workspaceId?: string | null,
): Promise<WebhookHealth> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  let query = supabase
    .from("call_events")
    .select("event_type")
    .in("event_type", [
      "webhook.sent",
      "webhook.failed",
      "webhook.started",
      "post_call_jobs.retry_scheduled",
    ])
    .gte("created_at", since);

  if (workspaceId) query = query.eq("workspace_id", workspaceId);

  const { data } = await query;
  const rows = (data ?? []) as { event_type: string }[];

  const h: WebhookHealth = { sent: 0, failed: 0, retrying: 0, pending: 0 };
  for (const r of rows) {
    if (r.event_type === "webhook.sent") h.sent++;
    else if (r.event_type === "webhook.failed") h.failed++;
    else if (r.event_type === "webhook.started") h.pending++;
  }
  // pending = started - sent - failed (outstanding)
  h.pending = Math.max(0, h.pending - h.sent - h.failed);
  return h;
}

// ── Timeline events ───────────────────────────────────────────────────────────

export interface HealthTimelineEvent {
  event_type: string;
  provider: string | null;
  workspace_id: string;
  created_at: string;
  payload: Record<string, unknown>;
}

const TIMELINE_EVENT_TYPES = [
  "llm.provider_degraded",
  "llm.provider_down",
  "llm.fallback_selected",
  "llm.fallback_failed",
  "llm.runtime_fallback_unavailable",
  "tts.provider_degraded",
  "tts.provider_down",
  "tts.fallback_selected",
  "tts.fallback_failed",
  "tts.fallback_unavailable",
  "billing.circuit_breaker_triggered",
  "webhook.failed",
  "post_call_jobs.dead_letter",
  "post_call_jobs.failed",
];

export async function getProviderHealthTimeline(
  supabase: SupabaseClient,
  windowMinutes: number,
  workspaceId?: string | null,
  limit = 50,
): Promise<HealthTimelineEvent[]> {
  const since = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();

  let query = supabase
    .from("call_events")
    .select("event_type, workspace_id, payload, created_at")
    .in("event_type", TIMELINE_EVENT_TYPES)
    .gte("created_at", since)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (workspaceId) query = query.eq("workspace_id", workspaceId);

  const { data } = await query;
  const rows = (data ?? []) as Array<{
    event_type: string;
    workspace_id: string;
    payload: Record<string, unknown>;
    created_at: string;
  }>;

  return rows.map((r) => ({
    event_type: r.event_type,
    provider: String(r.payload["provider"] ?? r.payload["from"] ?? "") || null,
    workspace_id: r.workspace_id,
    created_at: r.created_at,
    // Sanitize payload before returning — strip any secret-like values
    payload: sanitizePayload(r.payload),
  }));
}

function sanitizePayload(
  payload: Record<string, unknown>,
): Record<string, unknown> {
  const BLOCKED_KEYS = new Set([
    "api_key",
    "apiKey",
    "token",
    "secret",
    "password",
    "authorization",
    "bearer",
    "key",
    "credential",
  ]);
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(payload)) {
    if (BLOCKED_KEYS.has(k.toLowerCase())) continue;
    if (typeof v === "string" && v.length > 200) {
      result[k] = v.slice(0, 200) + "…";
    } else {
      result[k] = v;
    }
  }
  return result;
}
