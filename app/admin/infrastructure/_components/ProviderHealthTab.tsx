"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Activity,
  AlertCircle,
  AlertTriangle,
  Clock,
  Loader2,
  RefreshCw,
  XCircle,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { HealthData } from "./types";
import { timeAgo, eventLabel } from "./helpers";
import { ProviderCards } from "./ProviderCards";

const WINDOW_OPTIONS = [
  { label: "5m", value: 5 },
  { label: "15m", value: 15 },
  { label: "1h", value: 60 },
  { label: "24h", value: 1440 },
];

// ── Health tab ─────────────────────────────────────────────────────────────────

export function ProviderHealthTab() {
  const [windowMinutes, setWindowMinutes] = useState(15);
  const [data, setData] = useState<HealthData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const fetchHealth = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/provider-health?window_minutes=${windowMinutes}`,
        { cache: "no-store" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const json = (await res.json()) as HealthData;
      setData(json);
      setLastRefresh(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [windowMinutes]);

  useEffect(() => {
    void fetchHealth();
  }, [fetchHealth]);

  return (
    <div className="space-y-4">
      {/* Controls */}
      <div className="flex items-center justify-between">
        <div className="flex gap-1 bg-white border border-[#e0e0e0] rounded-lg p-1">
          {WINDOW_OPTIONS.map((w) => (
            <button
              key={w.value}
              onClick={() => setWindowMinutes(w.value)}
              className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors ${
                windowMinutes === w.value
                  ? "bg-[#0a0a0a] text-white"
                  : "text-[#6b6b6b] hover:text-[#0a0a0a]"
              }`}
            >
              {w.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          {lastRefresh && (
            <span className="text-xs text-[#6b6b6b] flex items-center gap-1">
              <Clock className="w-3 h-3" /> {timeAgo(lastRefresh.toISOString())}
            </span>
          )}
          <Button
            size="sm"
            variant="outline"
            className="h-7 text-xs"
            onClick={fetchHealth}
            disabled={loading}
          >
            {loading ? (
              <Loader2 className="w-3 h-3 animate-spin mr-1" />
            ) : (
              <RefreshCw className="w-3 h-3 mr-1" />
            )}
            Refresh
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700 flex items-center gap-2">
          <XCircle className="w-4 h-4 shrink-0" /> {error}
        </div>
      )}

      {loading && !data && (
        <div className="flex items-center justify-center py-12 text-[#6b6b6b]">
          <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading provider
          health…
        </div>
      )}

      {data && (
        <>
          {/* Incidents banner */}
          {data.incidents.length > 0 && (
            <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3">
              <p className="text-sm font-medium text-red-700 mb-1 flex items-center gap-2">
                <AlertTriangle className="w-4 h-4" />
                {data.incidents.length} active incident
                {data.incidents.length > 1 ? "s" : ""}
              </p>
              <div className="space-y-1">
                {data.incidents.map((inc, i) => (
                  <p key={i} className="text-xs text-red-600">
                    <span className="font-mono font-medium">
                      {inc.provider}
                    </span>{" "}
                    — {inc.status}
                    {inc.last_error_code ? ` (${inc.last_error_code})` : ""}
                  </p>
                ))}
              </div>
            </div>
          )}

          {/* Provider cards */}
          <ProviderCards data={data} windowMinutes={windowMinutes} />

          {/* Jobs section */}
          <div className="grid grid-cols-2 gap-4">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  Post-Call Jobs
                  {(data.jobs.dead_letter > 0 ||
                    data.jobs.stale_running > 0) && (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0 pb-4">
                <div className="grid grid-cols-3 gap-0 divide-x divide-[#e0e0e0]">
                  {[
                    { label: "Pending", value: data.jobs.pending, warn: false },
                    { label: "Running", value: data.jobs.running, warn: false },
                    {
                      label: "Retrying",
                      value: data.jobs.retrying,
                      warn: data.jobs.retrying > 0,
                    },
                  ].map((s) => (
                    <div key={s.label} className="text-center px-4 py-2">
                      <p className="text-xs text-[#6b6b6b]">{s.label}</p>
                      <p
                        className={`text-xl font-bold ${s.warn ? "text-yellow-600" : "text-[#0a0a0a]"}`}
                      >
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-3 gap-0 divide-x divide-[#e0e0e0] border-t border-[#e0e0e0]">
                  {[
                    {
                      label: "Failed",
                      value: data.jobs.failed,
                      warn: data.jobs.failed > 0,
                    },
                    {
                      label: "Dead-letter",
                      value: data.jobs.dead_letter,
                      warn: data.jobs.dead_letter > 0,
                    },
                    {
                      label: "Stale",
                      value: data.jobs.stale_running,
                      warn: data.jobs.stale_running > 0,
                    },
                  ].map((s) => (
                    <div key={s.label} className="text-center px-4 py-2">
                      <p className="text-xs text-[#6b6b6b]">{s.label}</p>
                      <p
                        className={`text-xl font-bold ${s.warn ? "text-red-600" : "text-[#0a0a0a]"}`}
                      >
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            {/* Webhooks section */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm flex items-center gap-2">
                  Webhooks
                  {data.webhooks.failed > 0 && (
                    <AlertTriangle className="w-4 h-4 text-yellow-500" />
                  )}
                </CardTitle>
                <CardDescription className="text-xs">
                  Last {windowMinutes} minutes
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0 pb-4">
                <div className="grid grid-cols-2 gap-0 divide-x divide-[#e0e0e0]">
                  {[
                    { label: "Sent", value: data.webhooks.sent, warn: false },
                    {
                      label: "Failed",
                      value: data.webhooks.failed,
                      warn: data.webhooks.failed > 0,
                    },
                  ].map((s) => (
                    <div key={s.label} className="text-center px-4 py-2">
                      <p className="text-xs text-[#6b6b6b]">{s.label}</p>
                      <p
                        className={`text-xl font-bold ${s.warn ? "text-red-600" : "text-[#0a0a0a]"}`}
                      >
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 gap-0 divide-x divide-[#e0e0e0] border-t border-[#e0e0e0]">
                  {[
                    {
                      label: "Retrying",
                      value: data.webhooks.retrying,
                      warn: data.webhooks.retrying > 0,
                    },
                    {
                      label: "Pending",
                      value: data.webhooks.pending,
                      warn: false,
                    },
                  ].map((s) => (
                    <div key={s.label} className="text-center px-4 py-2">
                      <p className="text-xs text-[#6b6b6b]">{s.label}</p>
                      <p
                        className={`text-xl font-bold ${s.warn ? "text-yellow-600" : "text-[#0a0a0a]"}`}
                      >
                        {s.value}
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Timeline */}
          {data.timeline.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm">
                  Recent Incidents Timeline
                </CardTitle>
                <CardDescription className="text-xs">
                  Degradation, fallback, and failure events in the last{" "}
                  {windowMinutes} minutes
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="divide-y divide-[#e0e0e0] max-h-64 overflow-y-auto">
                  {data.timeline.map((ev, i) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 px-4 py-2.5 text-sm"
                    >
                      <span className="shrink-0 mt-0.5">
                        {ev.event_type.includes("down") ||
                        ev.event_type.includes("dead_letter") ||
                        ev.event_type.includes("failed") ? (
                          <XCircle className="w-4 h-4 text-red-500" />
                        ) : ev.event_type.includes("degraded") ||
                          ev.event_type.includes("fallback") ? (
                          <AlertCircle className="w-4 h-4 text-yellow-500" />
                        ) : (
                          <Activity className="w-4 h-4 text-[#6b6b6b]" />
                        )}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="text-[#0a0a0a] text-xs">
                          {eventLabel(ev.event_type)}
                          {ev.provider && (
                            <span className="ml-1 text-[#6b6b6b] font-mono">
                              ({ev.provider})
                            </span>
                          )}
                        </p>
                      </div>
                      <span className="text-xs text-[#6b6b6b] shrink-0 font-mono">
                        {timeAgo(ev.created_at)}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Circuit state legend */}
          <div className="rounded-lg bg-[#f5f5f5] border border-[#e0e0e0] p-4">
            <p className="text-xs font-medium text-[#6b6b6b] uppercase tracking-wide mb-2">
              Circuit State (Inferred) — not a real circuit breaker
            </p>
            <div className="flex flex-wrap gap-4 text-xs text-[#6b6b6b]">
              <span>
                <span className="font-mono font-medium text-[#0a0a0a]">
                  closed
                </span>{" "}
                — provider healthy, error rate low
              </span>
              <span>
                <span className="font-mono font-medium text-yellow-700">
                  half-open
                </span>{" "}
                — recovering or moderate errors
              </span>
              <span>
                <span className="font-mono font-medium text-red-700">open</span>{" "}
                — high error rate or circuit breaker triggered
              </span>
              <span>
                <span className="font-mono font-medium">unknown</span> —
                insufficient data (&lt; 3 events)
              </span>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
