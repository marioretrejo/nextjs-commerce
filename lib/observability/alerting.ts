/**
 * lib/observability/alerting.ts
 *
 * Core alerting service for VoiceOS operational incidents.
 *
 * Design principles:
 *   1. Fingerprint-based deduplication — same signal+provider+workspace = same incident.
 *   2. Cooldown-aware delivery — respects cooldown_minutes before re-notifying.
 *   3. No secrets in metadata — sanitizeAlertMetadata strips tokens/keys.
 *   4. External sends disabled by default — dashboard-only until VOICEOS_ALERTING_SEND_EXTERNAL=true.
 *   5. Non-throwing — all DB errors are logged, never surface to callers.
 *
 * Signal sources:
 *   - provider_health_checks (via get_provider_health_summary RPC)
 *   - post_call_jobs (direct query)
 *   - call_events (webhook, billing, job events)
 */
import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getJobsHealth, getWebhookHealthFromEvents } from "./provider-health";

// ── Public types ───────────────────────────────────────────────────────────────

export type AlertSignal =
  | "provider_down"
  | "provider_degraded"
  | "circuit_open"
  | "fallback_spike"
  | "post_call_jobs_dead_letter"
  | "post_call_jobs_stale_running"
  | "webhook_failure_spike"
  | "cron_failure"
  | "db_error_spike"
  | "active_calls_zombie"
  | "call_failure_spike"
  | "cost_spike"
  | "compliance_block_spike";

export type AlertSeverity = "info" | "warning" | "critical";
export type AlertIncidentStatus =
  | "open"
  | "acknowledged"
  | "resolved"
  | "muted";
export type AlertChannel = "dashboard" | "slack" | "email" | "webhook";

// ── Thresholds ─────────────────────────────────────────────────────────────────

export const ALERT_THRESHOLDS = {
  /** Webhook failed/(sent+failed) ratio to trigger webhook_failure_spike */
  WEBHOOK_FAILURE_RATE: 0.3,
  /** Minimum webhook events before triggering spike (avoids noise on low volume) */
  WEBHOOK_MIN_SAMPLE: 5,
  /** fallback_count per provider >= this → fallback_spike */
  FALLBACK_SPIKE_COUNT: 3,
  /** Any dead_letter job → post_call_jobs_dead_letter */
  DEAD_LETTER_COUNT: 1,
  /** Job running > this many minutes without finishing → stale */
  STALE_JOB_MINUTES: 10,
  /** No provider_health_checks inserted in this many minutes → cron_failure */
  CRON_STALE_MINUTES: 15,
  /** call_events billing.circuit_breaker_triggered count > 0 → db_error_spike */
  BILLING_CIRCUIT_BREAKER_COUNT: 1,
} as const;

// ── Internal types ─────────────────────────────────────────────────────────────

export interface EvaluatedSignal {
  signal: AlertSignal;
  severity: AlertSeverity;
  title: string;
  description: string | null;
  provider: string | null;
  providerType: string | null;
  source: string;
  metadata: Record<string, unknown>;
  fingerprint: string;
  workspaceId: string | null;
}

export interface AlertIncidentRow {
  id: string;
  workspace_id: string | null;
  rule_id: string | null;
  signal: string;
  severity: AlertSeverity;
  status: AlertIncidentStatus;
  title: string;
  description: string | null;
  fingerprint: string;
  provider: string | null;
  provider_type: string | null;
  source: string;
  first_seen_at: string;
  last_seen_at: string;
  resolved_at: string | null;
  occurrence_count: number;
  metadata: Record<string, unknown>;
}

// ── Secret scrubbing ───────────────────────────────────────────────────────────

const BLOCKED_META_KEYS = new Set([
  "api_key",
  "apikey",
  "token",
  "secret",
  "password",
  "authorization",
  "bearer",
  "key",
  "credential",
  "auth",
  "signature",
]);

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[\w\-.]+/gi,
  /api[-_]?key[:\s=]+[\w\-.]+/gi,
  /sk-[\w\-]{20,}/gi,
  /[A-Za-z0-9_\-]{40,}/g,
];

/** Remove secrets from alert metadata before storage. */
export function sanitizeAlertMetadata(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    if (BLOCKED_META_KEYS.has(k.toLowerCase())) continue;
    if (typeof v === "string") {
      let s = v.slice(0, 500);
      for (const p of SECRET_PATTERNS) {
        s = s.replace(p, "[REDACTED]");
      }
      result[k] = s.slice(0, 200);
    } else if (typeof v === "number" || typeof v === "boolean" || v === null) {
      result[k] = v;
    }
    // skip nested objects/arrays — not needed for alert metadata
  }
  return result;
}

// ── Fingerprint ────────────────────────────────────────────────────────────────

/**
 * Stable fingerprint for deduplication.
 * Encodes workspace in the hash so NULL workspace behaves like "global".
 */
export function dedupeFingerprint(
  signal: AlertSignal,
  provider: string | null,
  workspaceId: string | null,
): string {
  const parts = [signal, provider ?? "_", workspaceId ?? "global"].join(":");
  return createHash("sha256").update(parts).digest("hex").slice(0, 32);
}

// ── Default rules (used when no alert_rules rows exist) ───────────────────────

interface DefaultRule {
  signal: AlertSignal;
  severity: AlertSeverity;
  cooldown_minutes: number;
}

const DEFAULT_RULES: DefaultRule[] = [
  { signal: "provider_down", severity: "critical", cooldown_minutes: 30 },
  { signal: "provider_degraded", severity: "warning", cooldown_minutes: 60 },
  { signal: "circuit_open", severity: "critical", cooldown_minutes: 30 },
  { signal: "fallback_spike", severity: "warning", cooldown_minutes: 60 },
  {
    signal: "post_call_jobs_dead_letter",
    severity: "critical",
    cooldown_minutes: 30,
  },
  {
    signal: "post_call_jobs_stale_running",
    severity: "warning",
    cooldown_minutes: 60,
  },
  {
    signal: "webhook_failure_spike",
    severity: "warning",
    cooldown_minutes: 60,
  },
  { signal: "cron_failure", severity: "critical", cooldown_minutes: 30 },
  { signal: "db_error_spike", severity: "critical", cooldown_minutes: 30 },
  { signal: "call_failure_spike", severity: "warning", cooldown_minutes: 60 },
  { signal: "active_calls_zombie", severity: "warning", cooldown_minutes: 120 },
  { signal: "cost_spike", severity: "warning", cooldown_minutes: 60 },
  { signal: "compliance_block_spike", severity: "info", cooldown_minutes: 120 },
];

function defaultRuleFor(signal: AlertSignal): DefaultRule {
  return (
    DEFAULT_RULES.find((r) => r.signal === signal) ?? {
      signal,
      severity: "warning",
      cooldown_minutes: 60,
    }
  );
}

// ── Signal evaluation ──────────────────────────────────────────────────────────

export async function evaluateAlertSignals(
  supabase: SupabaseClient,
  windowMinutes = 15,
  workspaceId: string | null = null,
): Promise<EvaluatedSignal[]> {
  const signals: EvaluatedSignal[] = [];

  // ── 1. Provider health from get_provider_health_summary RPC ───────────────────
  try {
    const { data: healthRows, error } = await supabase.rpc(
      "get_provider_health_summary",
      { p_workspace_id: workspaceId, p_window_minutes: windowMinutes },
    );
    if (!error && Array.isArray(healthRows)) {
      for (const row of healthRows as Array<{
        provider: string;
        provider_type: string;
        status: string;
        circuit_state: string;
        fallback_count: number;
        error_rate: number | null;
        sample_size: number;
        last_error_code: string | null;
        last_error_message: string | null;
      }>) {
        const meta = sanitizeAlertMetadata({
          provider: row.provider,
          provider_type: row.provider_type,
          error_rate: row.error_rate,
          sample_size: row.sample_size,
          last_error_code: row.last_error_code,
          last_error_message: row.last_error_message,
        });

        if (row.status === "down") {
          signals.push({
            signal: "provider_down",
            severity: "critical",
            title: `${row.provider} is down`,
            description: row.last_error_code
              ? `Error: ${row.last_error_code}`
              : null,
            provider: row.provider,
            providerType: row.provider_type,
            source: "provider_health",
            metadata: meta,
            fingerprint: dedupeFingerprint(
              "provider_down",
              row.provider,
              workspaceId,
            ),
            workspaceId,
          });
        }

        if (row.status === "degraded") {
          signals.push({
            signal: "provider_degraded",
            severity: "warning",
            title: `${row.provider} is degraded`,
            description: row.last_error_code
              ? `Error rate elevated. Code: ${row.last_error_code}`
              : `Error rate elevated.`,
            provider: row.provider,
            providerType: row.provider_type,
            source: "provider_health",
            metadata: meta,
            fingerprint: dedupeFingerprint(
              "provider_degraded",
              row.provider,
              workspaceId,
            ),
            workspaceId,
          });
        }

        if (row.circuit_state === "open") {
          signals.push({
            signal: "circuit_open",
            severity: "critical",
            title: `Circuit open: ${row.provider}`,
            description: `Provider circuit breaker is open. Fallbacks may be active.`,
            provider: row.provider,
            providerType: row.provider_type,
            source: "provider_health",
            metadata: meta,
            fingerprint: dedupeFingerprint(
              "circuit_open",
              row.provider,
              workspaceId,
            ),
            workspaceId,
          });
        }

        if (
          (row.fallback_count ?? 0) >= ALERT_THRESHOLDS.FALLBACK_SPIKE_COUNT
        ) {
          signals.push({
            signal: "fallback_spike",
            severity: "warning",
            title: `Fallback spike: ${row.provider}`,
            description: `${row.fallback_count} fallback events in the last ${windowMinutes} minutes.`,
            provider: row.provider,
            providerType: row.provider_type,
            source: "provider_health",
            metadata: { ...meta, fallback_count: row.fallback_count },
            fingerprint: dedupeFingerprint(
              "fallback_spike",
              row.provider,
              workspaceId,
            ),
            workspaceId,
          });
        }
      }
    }
  } catch (err) {
    console.warn(
      "[alerting] evaluateAlertSignals: health query error",
      String(err),
    );
  }

  // ── 2. Post-call jobs ──────────────────────────────────────────────────────────
  try {
    const jobs = await getJobsHealth(supabase, workspaceId);
    if (jobs.dead_letter >= ALERT_THRESHOLDS.DEAD_LETTER_COUNT) {
      signals.push({
        signal: "post_call_jobs_dead_letter",
        severity: "critical",
        title: `${jobs.dead_letter} dead-letter job(s)`,
        description: `${jobs.dead_letter} post-call job(s) exhausted all retries.`,
        provider: "post_call_jobs",
        providerType: "jobs",
        source: "post_call_jobs",
        metadata: sanitizeAlertMetadata({
          dead_letter: jobs.dead_letter,
          failed: jobs.failed,
          retrying: jobs.retrying,
        }),
        fingerprint: dedupeFingerprint(
          "post_call_jobs_dead_letter",
          null,
          workspaceId,
        ),
        workspaceId,
      });
    }
    if (jobs.stale_running > 0) {
      signals.push({
        signal: "post_call_jobs_stale_running",
        severity: "warning",
        title: `${jobs.stale_running} stale running job(s)`,
        description: `Job(s) locked running for >${ALERT_THRESHOLDS.STALE_JOB_MINUTES} min — possible worker crash.`,
        provider: "post_call_jobs",
        providerType: "jobs",
        source: "post_call_jobs",
        metadata: sanitizeAlertMetadata({
          stale_running: jobs.stale_running,
          running: jobs.running,
        }),
        fingerprint: dedupeFingerprint(
          "post_call_jobs_stale_running",
          null,
          workspaceId,
        ),
        workspaceId,
      });
    }
  } catch (err) {
    console.warn(
      "[alerting] evaluateAlertSignals: jobs query error",
      String(err),
    );
  }

  // ── 3. Webhook failure spike ───────────────────────────────────────────────────
  try {
    const wh = await getWebhookHealthFromEvents(
      supabase,
      windowMinutes,
      workspaceId,
    );
    const total = wh.sent + wh.failed;
    if (
      total >= ALERT_THRESHOLDS.WEBHOOK_MIN_SAMPLE &&
      wh.failed / total >= ALERT_THRESHOLDS.WEBHOOK_FAILURE_RATE
    ) {
      signals.push({
        signal: "webhook_failure_spike",
        severity: "warning",
        title: `Webhook delivery spike: ${wh.failed}/${total} failed`,
        description: `${((wh.failed / total) * 100).toFixed(1)}% failure rate in last ${windowMinutes} minutes.`,
        provider: "webhook",
        providerType: "webhook",
        source: "call_events",
        metadata: sanitizeAlertMetadata({
          failed: wh.failed,
          sent: wh.sent,
          total,
          failure_rate: wh.failed / total,
        }),
        fingerprint: dedupeFingerprint(
          "webhook_failure_spike",
          null,
          workspaceId,
        ),
        workspaceId,
      });
    }
  } catch (err) {
    console.warn(
      "[alerting] evaluateAlertSignals: webhook query error",
      String(err),
    );
  }

  // ── 4. Cron failure (no recent provider_health_checks) ────────────────────────
  try {
    const staleThreshold = new Date(
      Date.now() - ALERT_THRESHOLDS.CRON_STALE_MINUTES * 60 * 1000,
    ).toISOString();
    const { data: lastCheck } = await supabase
      .from("provider_health_checks")
      .select("checked_at")
      .is("workspace_id", null)
      .order("checked_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    const lastCheckedAt = (lastCheck as { checked_at: string } | null)
      ?.checked_at;
    if (!lastCheckedAt || lastCheckedAt < staleThreshold) {
      signals.push({
        signal: "cron_failure",
        severity: "critical",
        title: "Provider health cron is stale",
        description: lastCheckedAt
          ? `Last check: ${lastCheckedAt} (>${ALERT_THRESHOLDS.CRON_STALE_MINUTES} min ago)`
          : `No provider health checks found.`,
        provider: null,
        providerType: "cron",
        source: "provider_health_checks",
        metadata: sanitizeAlertMetadata({
          last_checked_at: lastCheckedAt ?? null,
        }),
        fingerprint: dedupeFingerprint(
          "cron_failure",
          "provider_health_cron",
          workspaceId,
        ),
        workspaceId,
      });
    }
  } catch (err) {
    console.warn(
      "[alerting] evaluateAlertSignals: cron check error",
      String(err),
    );
  }

  // ── 5. DB error spike (billing circuit breaker) ────────────────────────────────
  try {
    const since = new Date(
      Date.now() - windowMinutes * 60 * 1000,
    ).toISOString();
    let q = supabase
      .from("call_events")
      .select("id", { count: "exact", head: true })
      .eq("event_type", "billing.circuit_breaker_triggered")
      .gte("created_at", since);
    if (workspaceId) q = q.eq("workspace_id", workspaceId);
    const { count } = await q;
    if ((count ?? 0) >= ALERT_THRESHOLDS.BILLING_CIRCUIT_BREAKER_COUNT) {
      signals.push({
        signal: "db_error_spike",
        severity: "critical",
        title: `Billing circuit breaker triggered (${count} times)`,
        description: `Billing circuit breaker fired ${count} time(s) in last ${windowMinutes} minutes.`,
        provider: "supabase",
        providerType: "database",
        source: "call_events",
        metadata: sanitizeAlertMetadata({ count }),
        fingerprint: dedupeFingerprint(
          "db_error_spike",
          "billing_circuit_breaker",
          workspaceId,
        ),
        workspaceId,
      });
    }
  } catch (err) {
    console.warn(
      "[alerting] evaluateAlertSignals: billing cb query error",
      String(err),
    );
  }

  return signals;
}

// ── Incident management ────────────────────────────────────────────────────────

export interface CreateOrUpdateResult {
  incident: AlertIncidentRow;
  isNew: boolean;
}

/**
 * Upsert an incident by fingerprint.
 * If an open/acknowledged incident exists with the same fingerprint:
 *   → increment occurrence_count and update last_seen_at
 * Otherwise:
 *   → insert new incident
 */
export async function createOrUpdateIncident(
  supabase: SupabaseClient,
  signal: EvaluatedSignal,
  ruleId?: string | null,
): Promise<CreateOrUpdateResult | null> {
  try {
    // Look for existing open/acknowledged incident
    const { data: existing } = await supabase
      .from("alert_incidents")
      .select("*")
      .eq("fingerprint", signal.fingerprint)
      .in("status", ["open", "acknowledged"])
      .maybeSingle();

    if (existing) {
      const row = existing as AlertIncidentRow;
      const { data: updated } = await supabase
        .from("alert_incidents")
        .update({
          last_seen_at: new Date().toISOString(),
          occurrence_count: row.occurrence_count + 1,
          description: signal.description ?? row.description,
          metadata: sanitizeAlertMetadata(signal.metadata),
          updated_at: new Date().toISOString(),
        })
        .eq("id", row.id)
        .select()
        .single();
      return { incident: updated as AlertIncidentRow, isNew: false };
    }

    // Insert new incident
    const { data: inserted } = await supabase
      .from("alert_incidents")
      .insert({
        workspace_id: signal.workspaceId,
        rule_id: ruleId ?? null,
        signal: signal.signal,
        severity: signal.severity,
        status: "open",
        title: signal.title,
        description: signal.description,
        fingerprint: signal.fingerprint,
        provider: signal.provider,
        provider_type: signal.providerType,
        source: signal.source,
        first_seen_at: new Date().toISOString(),
        last_seen_at: new Date().toISOString(),
        occurrence_count: 1,
        metadata: sanitizeAlertMetadata(signal.metadata),
      })
      .select()
      .single();
    return { incident: inserted as AlertIncidentRow, isNew: true };
  } catch (err) {
    console.warn("[alerting] createOrUpdateIncident error:", String(err));
    return null;
  }
}

/** Mark an incident as resolved. */
export async function resolveIncident(
  supabase: SupabaseClient,
  incidentId: string,
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("alert_incidents")
      .update({
        status: "resolved",
        resolved_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq("id", incidentId)
      .in("status", ["open", "acknowledged"]);
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: String(err) };
  }
}

/** Acknowledge an incident (moves it from open → acknowledged). */
export async function acknowledgeIncident(
  supabase: SupabaseClient,
  incidentId: string,
): Promise<{ error: string | null }> {
  try {
    const { error } = await supabase
      .from("alert_incidents")
      .update({
        status: "acknowledged",
        updated_at: new Date().toISOString(),
      })
      .eq("id", incidentId)
      .eq("status", "open");
    return { error: error?.message ?? null };
  } catch (err) {
    return { error: String(err) };
  }
}

/** List open/acknowledged incidents with optional filters. */
export async function getOpenIncidents(
  supabase: SupabaseClient,
  opts: {
    workspaceId?: string | null;
    status?: AlertIncidentStatus | AlertIncidentStatus[];
    severity?: AlertSeverity;
    signal?: AlertSignal;
    limit?: number;
  } = {},
): Promise<AlertIncidentRow[]> {
  try {
    const { workspaceId, status, severity, signal, limit = 50 } = opts;

    let q = supabase
      .from("alert_incidents")
      .select("*")
      .order("last_seen_at", { ascending: false })
      .limit(limit);

    if (workspaceId !== undefined) {
      if (workspaceId === null) {
        q = q.is("workspace_id", null);
      } else {
        q = q.eq("workspace_id", workspaceId);
      }
    }

    if (Array.isArray(status)) {
      q = q.in("status", status);
    } else if (status) {
      q = q.eq("status", status);
    } else {
      q = q.in("status", ["open", "acknowledged"]);
    }

    if (severity) q = q.eq("severity", severity);
    if (signal) q = q.eq("signal", signal);

    const { data } = await q;
    return (data ?? []) as AlertIncidentRow[];
  } catch {
    return [];
  }
}

// ── Delivery helpers ───────────────────────────────────────────────────────────

/**
 * Check if a delivery should be sent based on cooldown.
 * Returns true if no delivery exists for this incident+channel within cooldown_minutes.
 */
export async function shouldNotifyIncident(
  supabase: SupabaseClient,
  incidentId: string,
  channel: AlertChannel,
  cooldownMinutes: number,
): Promise<boolean> {
  try {
    const cooldownSince = new Date(
      Date.now() - cooldownMinutes * 60 * 1000,
    ).toISOString();
    const { data } = await supabase
      .from("alert_deliveries")
      .select("id")
      .eq("incident_id", incidentId)
      .eq("channel", channel)
      .in("status", ["sent", "pending"])
      .gte("created_at", cooldownSince)
      .limit(1);
    return (data ?? []).length === 0;
  } catch {
    return true; // allow on error — better to notify than to miss
  }
}

/** Create a delivery record for an incident on a given channel. */
export async function enqueueAlertDelivery(
  supabase: SupabaseClient,
  incidentId: string,
  workspaceId: string | null,
  channel: AlertChannel,
  destination?: string | null,
): Promise<string | null> {
  try {
    const { data } = await supabase
      .from("alert_deliveries")
      .insert({
        incident_id: incidentId,
        workspace_id: workspaceId,
        channel,
        status: "pending",
        // Mask destination — never store raw webhook URLs or email addresses in full
        destination: destination ? maskDestination(destination) : null,
        attempts: 0,
        created_at: new Date().toISOString(),
      })
      .select("id")
      .single();
    return (data as { id: string } | null)?.id ?? null;
  } catch (err) {
    console.warn("[alerting] enqueueAlertDelivery error:", String(err));
    return null;
  }
}

/** Mask a destination string (URL domain only, no path/query; email: domain only). */
function maskDestination(dest: string): string {
  try {
    if (dest.includes("@")) {
      const [, domain] = dest.split("@");
      return `***@${domain ?? "***"}`;
    }
    const url = new URL(dest);
    return `${url.protocol}//${url.hostname}/***`;
  } catch {
    return "***";
  }
}
