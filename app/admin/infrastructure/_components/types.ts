/** Types for the infrastructure page. */

export type Tab = "voice" | "telephony" | "costs" | "health";

export type ProviderStatus = "healthy" | "degraded" | "down" | "unknown";
export type CircuitState =
  | "closed"
  | "half_open"
  | "open"
  | "disabled"
  | "unknown";

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

export interface JobsHealth {
  pending: number;
  running: number;
  retrying: number;
  dead_letter: number;
  failed: number;
  stale_running: number;
}

export interface WebhookHealth {
  sent: number;
  failed: number;
  retrying: number;
  pending: number;
}

export interface TimelineEvent {
  event_type: string;
  provider: string | null;
  workspace_id: string;
  created_at: string;
  payload: Record<string, unknown>;
}

export interface HealthData {
  window_minutes: number;
  generated_at: string;
  summary: HealthSummaryRow[];
  incidents: {
    provider: string;
    status: string;
    since: string;
    last_error_code: string | null;
  }[];
  jobs: JobsHealth;
  webhooks: WebhookHealth;
  timeline: TimelineEvent[];
}

// ── Helper components ─────────────────────────────────────────────────────────
