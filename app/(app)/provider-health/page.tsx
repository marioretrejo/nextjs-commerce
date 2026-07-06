"use client";

import { useState, useEffect, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Activity,
  RefreshCw,
  AlertTriangle,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { toast } from "sonner";
import type {
  AlertIncident,
  ProviderHealthResponse,
} from "./_components/types";
import { ProviderCard } from "./_components/ProviderCard";
import { ActiveIncidentsSection } from "./_components/ActiveIncidentsSection";
import { JobsWebhooks } from "./_components/JobsWebhooks";
import { Timeline } from "./_components/Timeline";
import { Legend } from "./_components/Legend";

const WINDOWS = [
  { value: 5, label: "5m" },
  { value: 15, label: "15m" },
  { value: 60, label: "1h" },
  { value: 1440, label: "24h" },
] as const;

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
        <JobsWebhooks jobs={data.jobs} webhooks={data.webhooks} />
      )}

      {/* Timeline */}
      {!loading && data && data.timeline.length > 0 && (
        <Timeline timeline={data.timeline} />
      )}

      {/* Circuit state legend */}
      <Legend />

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
