"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  HelpCircle,
  Zap,
  Clock,
  Bell,
  BellOff,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";

// ── Types ──────────────────────────────────────────────────────────────────────

interface HealthSummaryRow {
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

interface JobsHealth {
  pending: number;
  running: number;
  retrying: number;
  dead_letter: number;
  failed: number;
  stale_running: number;
}

interface WebhookHealth {
  sent: number;
  failed: number;
  retrying: number;
  pending: number;
}

interface TimelineEvent {
  event_type: string;
  provider: string | null;
  workspace_id: string;
  created_at: string;
  payload: Record<string, unknown>;
}

interface AlertIncident {
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

interface ProviderHealthResponse {
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

// ── Sub-components ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: HealthSummaryRow["status"] }) {
  const configs = {
    healthy: {
      icon: <CheckCircle2 className="h-3 w-3" />,
      label: "Healthy",
      className: "bg-green-100 text-green-800 border-green-200",
    },
    degraded: {
      icon: <AlertTriangle className="h-3 w-3" />,
      label: "Degraded",
      className: "bg-yellow-100 text-yellow-800 border-yellow-200",
    },
    down: {
      icon: <XCircle className="h-3 w-3" />,
      label: "Down",
      className: "bg-red-100 text-red-800 border-red-200",
    },
    unknown: {
      icon: <HelpCircle className="h-3 w-3" />,
      label: "Unknown",
      className: "bg-gray-100 text-gray-600 border-gray-200",
    },
  };
  const c = configs[status] ?? configs.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium border ${c.className}`}
    >
      {c.icon}
      {c.label}
    </span>
  );
}

function CircuitBadge({ state }: { state: HealthSummaryRow["circuit_state"] }) {
  const configs = {
    closed: { label: "Closed", className: "bg-green-50 text-green-700" },
    half_open: {
      label: "Half-Open",
      className: "bg-yellow-50 text-yellow-700",
    },
    open: { label: "Open", className: "bg-red-50 text-red-700" },
    disabled: { label: "Disabled", className: "bg-gray-50 text-gray-500" },
    unknown: { label: "Unknown", className: "bg-gray-50 text-gray-500" },
  };
  const c = configs[state] ?? configs.unknown;
  return (
    <span
      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-xs font-mono ${c.className}`}
    >
      <Zap className="h-2.5 w-2.5" />
      {c.label}
    </span>
  );
}

function ProviderCard({ row }: { row: HealthSummaryRow }) {
  const borderColor =
    row.status === "down"
      ? "border-red-300"
      : row.status === "degraded"
        ? "border-yellow-300"
        : "border-border";

  return (
    <Card className={`border ${borderColor}`}>
      <CardContent className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-semibold text-sm capitalize">
                {row.provider.replace(/_/g, " ")}
              </span>
              <Badge variant="outline" className="text-xs font-normal">
                {row.provider_type}
              </Badge>
            </div>
            <div className="flex items-center gap-2 mt-1.5 flex-wrap">
              <StatusBadge status={row.status} />
              <CircuitBadge state={row.circuit_state} />
            </div>
          </div>
          <div className="text-right shrink-0 text-xs text-muted-foreground">
            <div>n={row.sample_size}</div>
            {row.checked_at && (
              <div className="mt-0.5">
                {formatDistanceToNow(new Date(row.checked_at), {
                  addSuffix: true,
                })}
              </div>
            )}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-3 text-xs text-muted-foreground">
          {row.error_rate !== null && (
            <div>
              Error rate:{" "}
              <span
                className={
                  row.error_rate >= 0.4
                    ? "text-red-600 font-medium"
                    : row.error_rate >= 0.1
                      ? "text-yellow-600 font-medium"
                      : "text-foreground"
                }
              >
                {(row.error_rate * 100).toFixed(1)}%
              </span>
            </div>
          )}
          {row.latency_ms !== null && (
            <div>
              P95 latency:{" "}
              <span
                className={
                  row.latency_ms >= 5000
                    ? "text-red-600 font-medium"
                    : row.latency_ms >= 2000
                      ? "text-yellow-600 font-medium"
                      : "text-foreground"
                }
              >
                {row.latency_ms}ms
              </span>
            </div>
          )}
          {row.fallback_count > 0 && (
            <div>
              Fallbacks:{" "}
              <span className="text-yellow-600 font-medium">
                {row.fallback_count}
                {row.fallback_provider ? ` → ${row.fallback_provider}` : ""}
              </span>
            </div>
          )}
        </div>

        {row.last_error_code && (
          <div className="mt-2 px-2 py-1 rounded bg-red-50 border border-red-100 text-xs text-red-700 font-mono truncate">
            {row.last_error_code}
            {row.last_error_message ? `: ${row.last_error_message}` : ""}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Active Incidents section ───────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: AlertIncident["severity"] }) {
  const cfg = {
    critical: "bg-red-100 text-red-800 border-red-200",
    warning: "bg-yellow-100 text-yellow-800 border-yellow-200",
    info: "bg-blue-100 text-blue-700 border-blue-200",
  };
  return (
    <span
      className={`inline-flex items-center px-1.5 py-0.5 rounded text-xs font-medium border uppercase ${cfg[severity]}`}
    >
      {severity}
    </span>
  );
}

function ActiveIncidentsSection({
  incidents,
  onAck,
  onResolve,
  loading,
}: {
  incidents: AlertIncident[];
  onAck: (id: string) => void;
  onResolve: (id: string) => void;
  loading: boolean;
}) {
  if (!loading && incidents.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 border border-green-200 rounded-lg px-3 py-2">
        <BellOff className="h-4 w-4 shrink-0" />
        No active alert incidents
      </div>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <Bell className="h-4 w-4 text-muted-foreground" />
          <CardTitle className="text-sm font-semibold">
            Active Incidents {loading ? "" : `(${incidents.length})`}
          </CardTitle>
        </div>
      </CardHeader>
      <CardContent className="pt-0">
        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 rounded bg-muted animate-pulse" />
            ))}
          </div>
        ) : (
          <div className="space-y-2">
            {incidents.map((inc) => (
              <div
                key={inc.id}
                className={`flex items-start gap-3 p-3 rounded-lg border text-sm ${
                  inc.severity === "critical"
                    ? "border-red-200 bg-red-50"
                    : inc.severity === "warning"
                      ? "border-yellow-200 bg-yellow-50"
                      : "border-blue-200 bg-blue-50"
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <SeverityBadge severity={inc.severity} />
                    <span className="font-medium truncate">{inc.title}</span>
                    {inc.status === "acknowledged" && (
                      <span className="text-xs text-muted-foreground">
                        (acknowledged)
                      </span>
                    )}
                  </div>
                  {inc.description && (
                    <p className="text-xs text-muted-foreground mt-0.5 truncate">
                      {inc.description}
                    </p>
                  )}
                  <div className="text-xs text-muted-foreground mt-0.5">
                    {inc.occurrence_count > 1
                      ? `${inc.occurrence_count}× · `
                      : ""}
                    {formatDistanceToNow(new Date(inc.last_seen_at), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  {inc.status === "open" && (
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-7 text-xs"
                      onClick={() => onAck(inc.id)}
                    >
                      Ack
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="outline"
                    className="h-7 text-xs text-green-700 border-green-300 hover:bg-green-50"
                    onClick={() => onResolve(inc.id)}
                  >
                    Resolve
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ── Window selector ────────────────────────────────────────────────────────────

const WINDOWS = [
  { value: 5, label: "5m" },
  { value: 15, label: "15m" },
  { value: 60, label: "1h" },
  { value: 1440, label: "24h" },
] as const;

// ── Main page ──────────────────────────────────────────────────────────────────

export default function ProviderHealthPage() {
  const [window, setWindow] = useState<5 | 15 | 60 | 1440>(15);
  const [data, setData] = useState<ProviderHealthResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [incidents, setIncidents] = useState<AlertIncident[]>([]);
  const [incidentsLoading, setIncidentsLoading] = useState(true);

  const fetchHealth = useCallback(async (w: number) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/provider-health?window_minutes=${w}`);
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(
          (body as { error?: string }).error ?? `HTTP ${res.status}`,
        );
      }
      const json = (await res.json()) as ProviderHealthResponse;
      setData(json);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      setError(msg);
      toast.error("Failed to load provider health");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchIncidents = useCallback(async () => {
    setIncidentsLoading(true);
    try {
      const res = await fetch("/api/alerts?status=open&limit=20");
      if (res.ok) {
        const json = (await res.json()) as {
          incidents: AlertIncident[];
        };
        setIncidents(json.incidents ?? []);
      }
    } catch {
      // non-fatal
    } finally {
      setIncidentsLoading(false);
    }
  }, []);

  const handleAck = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "acknowledge" }),
      });
      if (res.ok) {
        toast.success("Incident acknowledged");
        setIncidents((prev) =>
          prev.map((i) =>
            i.id === id ? { ...i, status: "acknowledged" as const } : i,
          ),
        );
      }
    } catch {
      toast.error("Failed to acknowledge incident");
    }
  }, []);

  const handleResolve = useCallback(async (id: string) => {
    try {
      const res = await fetch("/api/alerts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "resolve" }),
      });
      if (res.ok) {
        toast.success("Incident resolved");
        setIncidents((prev) => prev.filter((i) => i.id !== id));
      }
    } catch {
      toast.error("Failed to resolve incident");
    }
  }, []);

  useEffect(() => {
    void fetchHealth(window);
  }, [window, fetchHealth]);

  useEffect(() => {
    void fetchIncidents();
  }, [fetchIncidents]);

  const downCount =
    data?.incidents.filter((i) => i.status === "down").length ?? 0;
  const degradedCount =
    data?.incidents.filter((i) => i.status === "degraded").length ?? 0;

  return (
    <div className="space-y-6 p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Activity className="h-6 w-6 text-primary" />
          <div>
            <h1 className="text-2xl font-bold">Provider Health</h1>
            <p className="text-sm text-muted-foreground">
              Real-time health status derived from call events
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Window selector */}
          <div className="flex rounded-md border overflow-hidden">
            {WINDOWS.map((w) => (
              <button
                key={w.value}
                onClick={() => setWindow(w.value)}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  window === w.value
                    ? "bg-primary text-primary-foreground"
                    : "bg-background text-muted-foreground hover:bg-muted"
                }`}
              >
                {w.label}
              </button>
            ))}
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => fetchHealth(window)}
            disabled={loading}
          >
            <RefreshCw
              className={`h-4 w-4 mr-1 ${loading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
      </div>

      {/* Error state */}
      {error && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4 flex items-center gap-2 text-red-700">
            <XCircle className="h-4 w-4 shrink-0" />
            <span className="text-sm">{error}</span>
          </CardContent>
        </Card>
      )}

      {/* Incidents banner */}
      {!loading && !error && (downCount > 0 || degradedCount > 0) && (
        <Card className="border-red-300 bg-red-50">
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-red-700 mt-0.5 shrink-0" />
              <div>
                <p className="font-semibold text-red-800 text-sm">
                  Active incidents detected
                </p>
                <ul className="mt-1 space-y-0.5">
                  {data?.incidents.map((inc, i) => (
                    <li key={i} className="text-xs text-red-700">
                      <span className="font-medium capitalize">
                        {inc.provider}
                      </span>{" "}
                      — {inc.status}
                      {inc.last_error_code ? ` (${inc.last_error_code})` : ""}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* All-clear banner */}
      {!loading && !error && data && downCount === 0 && degradedCount === 0 && (
        <Card className="border-green-300 bg-green-50">
          <CardContent className="p-4 flex items-center gap-2 text-green-700">
            <CheckCircle2 className="h-4 w-4 shrink-0" />
            <span className="text-sm font-medium">
              All providers healthy in the last {window} minutes
            </span>
          </CardContent>
        </Card>
      )}

      {/* Active Alert Incidents */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            Alert Incidents
          </h2>
          <Button
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={fetchIncidents}
            disabled={incidentsLoading}
          >
            <RefreshCw
              className={`h-3 w-3 mr-1 ${incidentsLoading ? "animate-spin" : ""}`}
            />
            Refresh
          </Button>
        </div>
        <ActiveIncidentsSection
          incidents={incidents}
          onAck={handleAck}
          onResolve={handleResolve}
          loading={incidentsLoading}
        />
      </div>

      {/* Loading skeleton */}
      {loading && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4 h-28" />
            </Card>
          ))}
        </div>
      )}

      {/* Provider cards */}
      {!loading && data && data.summary.length > 0 && (
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground mb-3">
            Providers ({data.summary.length})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {data.summary.map((row) => (
              <ProviderCard
                key={`${row.provider}-${row.provider_type}`}
                row={row}
              />
            ))}
          </div>
        </div>
      )}

      {!loading && data && data.summary.length === 0 && !error && (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground">
            <Activity className="h-8 w-8 mx-auto mb-2 opacity-40" />
            <p className="text-sm">
              No provider health data in the last {window} minutes.
            </p>
            <p className="text-xs mt-1">
              Data appears once calls are processed.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Jobs & Webhooks */}
      {!loading && data && (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Jobs */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">
                Post-Call Jobs
              </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="rounded bg-muted px-2 py-1.5">
                  <div className="text-lg font-bold text-foreground">
                    {data.jobs.pending}
                  </div>
                  <div className="text-muted-foreground">Pending</div>
                </div>
                <div className="rounded bg-muted px-2 py-1.5">
                  <div className="text-lg font-bold text-foreground">
                    {data.jobs.running}
                  </div>
                  <div className="text-muted-foreground">Running</div>
                </div>
                <div className="rounded bg-muted px-2 py-1.5">
                  <div className="text-lg font-bold text-foreground">
                    {data.jobs.retrying}
                  </div>
                  <div className="text-muted-foreground">Retrying</div>
                </div>
                <div
                  className={`rounded px-2 py-1.5 ${data.jobs.dead_letter > 0 ? "bg-red-50 border border-red-100" : "bg-muted"}`}
                >
                  <div
                    className={`text-lg font-bold ${data.jobs.dead_letter > 0 ? "text-red-700" : "text-foreground"}`}
                  >
                    {data.jobs.dead_letter}
                  </div>
                  <div className="text-muted-foreground">Dead Letter</div>
                </div>
                <div className="rounded bg-muted px-2 py-1.5">
                  <div className="text-lg font-bold text-foreground">
                    {data.jobs.failed}
                  </div>
                  <div className="text-muted-foreground">Failed</div>
                </div>
                <div
                  className={`rounded px-2 py-1.5 ${data.jobs.stale_running > 0 ? "bg-yellow-50 border border-yellow-100" : "bg-muted"}`}
                >
                  <div
                    className={`text-lg font-bold ${data.jobs.stale_running > 0 ? "text-yellow-700" : "text-foreground"}`}
                  >
                    {data.jobs.stale_running}
                  </div>
                  <div className="text-muted-foreground">Stale</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Webhooks */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold">Webhooks</CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="rounded bg-green-50 px-2 py-1.5">
                  <div className="text-lg font-bold text-green-700">
                    {data.webhooks.sent}
                  </div>
                  <div className="text-muted-foreground">Sent</div>
                </div>
                <div
                  className={`rounded px-2 py-1.5 ${data.webhooks.failed > 0 ? "bg-red-50 border border-red-100" : "bg-muted"}`}
                >
                  <div
                    className={`text-lg font-bold ${data.webhooks.failed > 0 ? "text-red-700" : "text-foreground"}`}
                  >
                    {data.webhooks.failed}
                  </div>
                  <div className="text-muted-foreground">Failed</div>
                </div>
                <div className="rounded bg-muted px-2 py-1.5">
                  <div className="text-lg font-bold text-foreground">
                    {data.webhooks.retrying}
                  </div>
                  <div className="text-muted-foreground">Retrying</div>
                </div>
                <div className="rounded bg-muted px-2 py-1.5">
                  <div className="text-lg font-bold text-foreground">
                    {data.webhooks.pending}
                  </div>
                  <div className="text-muted-foreground">Pending</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Timeline */}
      {!loading && data && data.timeline.length > 0 && (
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-semibold">
              Recent Incidents ({data.timeline.length})
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            <div className="space-y-2">
              {data.timeline.map((ev, i) => (
                <div
                  key={i}
                  className="flex items-start gap-3 text-xs border-b last:border-0 pb-2 last:pb-0"
                >
                  <Clock className="h-3 w-3 mt-0.5 shrink-0 text-muted-foreground" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-muted-foreground">
                        {ev.event_type}
                      </span>
                      {ev.provider && (
                        <Badge
                          variant="outline"
                          className="text-xs py-0 capitalize"
                        >
                          {ev.provider}
                        </Badge>
                      )}
                    </div>
                  </div>
                  <div className="shrink-0 text-muted-foreground whitespace-nowrap">
                    {formatDistanceToNow(new Date(ev.created_at), {
                      addSuffix: true,
                    })}
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Circuit state legend */}
      <Card className="bg-muted/30">
        <CardContent className="p-4">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
            Circuit State Legend
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs text-muted-foreground">
            <div>
              <span className="font-medium text-green-700">Closed</span> —
              Normal operation
            </div>
            <div>
              <span className="font-medium text-yellow-700">Half-Open</span> —
              Recovering, error rate elevated
            </div>
            <div>
              <span className="font-medium text-red-700">Open</span> — Provider
              failing, fallback active
            </div>
            <div>
              <span className="font-medium text-gray-500">Unknown</span> —
              Insufficient data
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-2">
            Circuit state is inferred from error rates — it does not reflect a
            real circuit breaker state machine.
          </p>
        </CardContent>
      </Card>

      {/* Footer */}
      {data && (
        <p className="text-xs text-muted-foreground text-right">
          Generated{" "}
          {formatDistanceToNow(new Date(data.generated_at), {
            addSuffix: true,
          })}
          {data.is_global
            ? " · Global view"
            : ` · Workspace ${data.workspace_id?.slice(0, 8) ?? ""}`}
        </p>
      )}
    </div>
  );
}
