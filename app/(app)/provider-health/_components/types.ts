export interface HealthSummaryRow {
  provider: string;
  provider_type: string;
  status: "healthy" | "degraded" | "down" | "unknown";
  circuit_state: "closed" | "half_open" | "open" | "disabled" | "unknown";
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

export interface AlertIncident {
  id: string;
  signal: string;
  severity: "info" | "warning" | "critical";
  status: "open" | "acknowledged" | "resolved" | "muted";
  title: string;
  description: string | null;
  provider: string | null;
  occurrence_count: number;
  first_seen_at: string;
  last_seen_at: string;
}

export interface ProviderHealthResponse {
  window_minutes: number;
  workspace_id: string | null;
  is_global: boolean;
  generated_at: string;
  summary: HealthSummaryRow[];
  incidents: Array<{
    provider: string;
    status: string;
    circuit_state: string;
    since: string;
    last_error_code: string | null;
  }>;
  jobs: JobsHealth;
  webhooks: WebhookHealth;
  timeline: TimelineEvent[];
}
