"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ArrowLeft,
  Cpu,
  Phone,
  DollarSign,
  Activity,
  CheckCircle,
  XCircle,
  AlertCircle,
  Lock,
  RefreshCw,
  Clock,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import Link from "next/link";

type Tab = "voice" | "telephony" | "costs" | "health";

const TABS: { id: Tab; label: string; icon: React.ReactNode }[] = [
  { id: "voice", label: "Voice Engines", icon: <Cpu className="w-4 h-4" /> },
  { id: "telephony", label: "Telephony", icon: <Phone className="w-4 h-4" /> },
  {
    id: "costs",
    label: "Cost Dashboard",
    icon: <DollarSign className="w-4 h-4" />,
  },
  {
    id: "health",
    label: "Provider Health",
    icon: <Activity className="w-4 h-4" />,
  },
];

const VOICE_ENGINES = [
  {
    tier: "Standard Voice",
    internal: "ElevenLabs v2",
    altInternal: "Cartesia Sonic-3",
    defaultEngine: "elevenlabs_v2",
    costPerMin: 0.03,
    monthlyMinutes: 12480,
    envKey: "ELEVENLABS_API_KEY",
    status: "active",
  },
  {
    tier: "Ultra-Fast Voice",
    internal: "Cartesia Sonic-3",
    altInternal: "Deepgram",
    defaultEngine: "cartesia_sonic3",
    costPerMin: 0.025,
    monthlyMinutes: 3120,
    envKey: "CARTESIA_API_KEY",
    status: "active",
  },
  {
    tier: "Premium Voice",
    internal: "ElevenLabs v3",
    altInternal: null,
    defaultEngine: "elevenlabs_v3",
    costPerMin: 0.06,
    monthlyMinutes: 780,
    envKey: "ELEVENLABS_API_KEY",
    status: "locked",
  },
];

const TELEPHONY_PROVIDERS = [
  { name: "Twilio", type: "twilio", status: "active", cost: "$0.0085/min" },
  { name: "Telnyx", type: "telnyx", status: "active", cost: "$0.0045/min" },
  {
    name: "Vonage",
    type: "vonage",
    status: "disconnected",
    cost: "$0.0090/min",
  },
  {
    name: "VoIP.ms",
    type: "voip_ms",
    status: "disconnected",
    cost: "$0.0069/min",
  },
  {
    name: "Custom SIP",
    type: "custom_sip",
    status: "disconnected",
    cost: "Custom",
  },
];

const MOCK_WORKSPACE_COSTS = [
  {
    name: "Acme Corp",
    plan: "scale",
    minutesUsed: 4800,
    planRevenue: 297,
    providerCost: 144,
  },
  {
    name: "Beta Labs",
    plan: "pro",
    minutesUsed: 980,
    planRevenue: 97,
    providerCost: 29.4,
  },
  {
    name: "Gamma Inc",
    plan: "scale",
    minutesUsed: 5200,
    planRevenue: 297,
    providerCost: 156,
  },
  {
    name: "Delta LLC",
    plan: "free",
    minutesUsed: 48,
    planRevenue: 0,
    providerCost: 1.44,
  },
  {
    name: "Epsilon Co",
    plan: "pro",
    minutesUsed: 1100,
    planRevenue: 97,
    providerCost: 33,
  },
];

// ── Provider Health types ──────────────────────────────────────────────────────

type ProviderStatus = "healthy" | "degraded" | "down" | "unknown";
type CircuitState = "closed" | "half_open" | "open" | "disabled" | "unknown";

interface HealthSummaryRow {
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

interface HealthData {
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

function StatusBadge({ status }: { status: ProviderStatus }) {
  if (status === "healthy")
    return (
      <Badge className="bg-green-600 text-white border-transparent text-xs flex items-center gap-1 w-fit">
        <CheckCircle className="w-3 h-3" /> Healthy
      </Badge>
    );
  if (status === "degraded")
    return (
      <Badge className="bg-yellow-500 text-white border-transparent text-xs flex items-center gap-1 w-fit">
        <AlertCircle className="w-3 h-3" /> Degraded
      </Badge>
    );
  if (status === "down")
    return (
      <Badge className="bg-red-600 text-white border-transparent text-xs flex items-center gap-1 w-fit">
        <XCircle className="w-3 h-3" /> Down
      </Badge>
    );
  return (
    <Badge className="border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs">
      Unknown
    </Badge>
  );
}

function CircuitBadge({ state }: { state: CircuitState }) {
  const cls = {
    closed: "bg-[#f5f5f5] text-[#0a0a0a] border-[#e0e0e0]",
    half_open: "bg-yellow-50 text-yellow-700 border-yellow-200",
    open: "bg-red-50 text-red-700 border-red-200",
    disabled: "bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]",
    unknown: "bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]",
  }[state];
  const label = state === "half_open" ? "half-open" : state;
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-mono ${cls}`}
    >
      {label}
    </span>
  );
}

function providerLabel(p: string): string {
  const labels: Record<string, string> = {
    groq: "Groq (LLM)",
    openai: "OpenAI",
    cartesia: "Cartesia (TTS)",
    deepgram: "Deepgram (STT)",
    livekit: "LiveKit",
    twilio: "Twilio",
    supabase: "Supabase",
    webhook: "Webhooks",
    post_call_jobs: "Post-Call Jobs",
    cron: "Cron Jobs",
  };
  return labels[p] ?? p;
}

function timeAgo(iso: string): string {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000;
  if (diff < 60) return `${Math.round(diff)}s ago`;
  if (diff < 3600) return `${Math.round(diff / 60)}m ago`;
  return `${Math.round(diff / 3600)}h ago`;
}

function eventLabel(et: string): string {
  const labels: Record<string, string> = {
    "llm.provider_degraded": "LLM degraded",
    "llm.provider_down": "LLM down",
    "llm.fallback_selected": "LLM fallback triggered",
    "llm.fallback_failed": "LLM fallback failed",
    "llm.runtime_fallback_unavailable": "LLM no fallback available",
    "tts.provider_degraded": "TTS degraded",
    "tts.provider_down": "TTS down",
    "tts.fallback_selected": "TTS fallback triggered",
    "tts.fallback_failed": "TTS fallback failed",
    "tts.fallback_unavailable": "TTS no fallback available",
    "billing.circuit_breaker_triggered": "Billing circuit breaker opened",
    "webhook.failed": "Webhook delivery failed",
    "post_call_jobs.dead_letter": "Job moved to dead-letter",
    "post_call_jobs.failed": "Job failed",
  };
  return labels[et] ?? et;
}

const WINDOW_OPTIONS = [
  { label: "5m", value: 5 },
  { label: "15m", value: 15 },
  { label: "1h", value: 60 },
  { label: "24h", value: 1440 },
];

// ── Health tab ─────────────────────────────────────────────────────────────────

function ProviderHealthTab() {
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
          {data.summary.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-[#6b6b6b] text-sm">
                No health data in the last {windowMinutes} minutes. Run the
                provider-health cron or wait for calls to generate events.
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 gap-3">
              {data.summary.map((p) => (
                <Card
                  key={p.provider}
                  className={
                    p.status === "down"
                      ? "border-red-200 bg-red-50/30"
                      : p.status === "degraded"
                        ? "border-yellow-200 bg-yellow-50/30"
                        : ""
                  }
                >
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-start gap-4 justify-between">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-2 flex-wrap">
                          <p className="font-medium text-[#0a0a0a] text-sm">
                            {providerLabel(p.provider)}
                          </p>
                          <span className="text-xs text-[#6b6b6b] font-mono bg-[#f5f5f5] rounded px-1.5 py-0.5">
                            {p.provider_type}
                          </span>
                          <StatusBadge status={p.status} />
                          <CircuitBadge state={p.circuit_state} />
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-2 text-sm">
                          <div>
                            <p className="text-xs text-[#6b6b6b] mb-0.5">
                              p95 Latency
                            </p>
                            <p
                              className={`font-medium text-sm ${
                                (p.latency_ms ?? 0) >= 5000
                                  ? "text-red-600"
                                  : (p.latency_ms ?? 0) >= 2000
                                    ? "text-yellow-600"
                                    : "text-[#0a0a0a]"
                              }`}
                            >
                              {p.latency_ms != null
                                ? `${p.latency_ms} ms`
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[#6b6b6b] mb-0.5">
                              Error rate
                            </p>
                            <p
                              className={`font-medium text-sm ${
                                (p.error_rate ?? 0) >= 0.4
                                  ? "text-red-600"
                                  : (p.error_rate ?? 0) >= 0.1
                                    ? "text-yellow-600"
                                    : "text-[#0a0a0a]"
                              }`}
                            >
                              {p.error_rate != null
                                ? `${(p.error_rate * 100).toFixed(1)}%`
                                : "—"}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[#6b6b6b] mb-0.5">
                              Sample size
                            </p>
                            <p className="font-medium text-sm">
                              {p.sample_size}
                            </p>
                          </div>
                          <div>
                            <p className="text-xs text-[#6b6b6b] mb-0.5">
                              Fallbacks
                            </p>
                            <p
                              className={`font-medium text-sm ${p.fallback_count > 0 ? "text-yellow-600" : "text-[#0a0a0a]"}`}
                            >
                              {p.fallback_count > 0
                                ? `${p.fallback_count} → ${p.fallback_provider ?? "?"}`
                                : "0"}
                            </p>
                          </div>
                        </div>

                        {p.last_error_message && (
                          <p className="text-xs text-[#6b6b6b] mt-2 font-mono bg-[#f5f5f5] rounded px-2 py-1 truncate">
                            {p.last_error_code && (
                              <span className="text-red-600 mr-1">
                                [{p.last_error_code}]
                              </span>
                            )}
                            {p.last_error_message}
                          </p>
                        )}
                      </div>
                      <div className="text-right shrink-0">
                        <p className="text-xs text-[#6b6b6b]">Last check</p>
                        <p className="text-xs font-mono mt-0.5">
                          {timeAgo(p.checked_at)}
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

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

export default function InfrastructurePage() {
  const [tab, setTab] = useState<Tab>("health");

  return (
    <div className="min-h-screen bg-[#f5f5f5]">
      <div className="bg-white border-b border-[#e0e0e0] px-6 py-4 flex items-center gap-4">
        <Link href="/admin">
          <Button variant="ghost" size="icon" className="h-8 w-8">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-lg font-bold text-[#0a0a0a]">Infrastructure</h1>
          <p className="text-xs text-[#6b6b6b]">
            Superadmin only — provider configuration, cost visibility, and
            real-time health
          </p>
        </div>
      </div>

      <div className="p-6 max-w-7xl mx-auto">
        {/* Tab bar */}
        <div className="flex gap-1 mb-6 bg-white rounded-lg border border-[#e0e0e0] p-1 w-fit">
          {TABS.map(({ id, label, icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-colors ${
                tab === id
                  ? "bg-[#0a0a0a] text-white"
                  : "text-[#6b6b6b] hover:text-[#0a0a0a]"
              }`}
            >
              {icon} {label}
            </button>
          ))}
        </div>

        {/* TAB 1 — Voice Engines */}
        {tab === "voice" && (
          <div className="space-y-4">
            <p className="text-sm text-[#6b6b6b]">
              Configure which voice engine powers each client-facing tier.
              Internal reference only — clients see tier names, never provider
              names.
            </p>
            {VOICE_ENGINES.map((engine) => (
              <Card key={engine.tier}>
                <CardContent className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <p className="font-semibold text-[#0a0a0a]">
                          {engine.tier}
                        </p>
                        <Badge className="text-xs bg-[#f5f5f5] text-[#6b6b6b] border-[#e0e0e0]">
                          {engine.internal}
                        </Badge>
                        {engine.status === "locked" && (
                          <Badge className="text-xs bg-[#0a0a0a] text-white border-transparent flex items-center gap-1">
                            <Lock className="w-3 h-3" /> Locked
                          </Badge>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-6 mt-3 text-sm">
                        <div>
                          <p className="text-xs text-[#6b6b6b] mb-0.5">
                            Internal engine
                          </p>
                          <p className="font-mono text-xs text-[#0a0a0a]">
                            {engine.defaultEngine}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6b6b6b] mb-0.5">
                            Cost / minute
                          </p>
                          <p className="font-medium">
                            ${engine.costPerMin.toFixed(3)}
                          </p>
                        </div>
                        <div>
                          <p className="text-xs text-[#6b6b6b] mb-0.5">
                            Minutes this month
                          </p>
                          <p className="font-medium">
                            {engine.monthlyMinutes.toLocaleString()}
                          </p>
                        </div>
                      </div>
                      <div className="mt-3">
                        <p className="text-xs text-[#6b6b6b] mb-1">
                          API Key ({engine.envKey})
                        </p>
                        <div className="flex items-center gap-2">
                          <CheckCircle className="w-4 h-4 text-green-500" />
                          <span className="text-xs font-mono text-[#6b6b6b]">
                            ••••••••••••••••••••••••••••••••
                          </span>
                        </div>
                      </div>
                    </div>
                    {engine.altInternal && (
                      <div className="text-right">
                        <p className="text-xs text-[#6b6b6b] mb-2">
                          Failover to
                        </p>
                        <Badge className="text-xs border-[#e0e0e0] text-[#6b6b6b] bg-white">
                          {engine.altInternal}
                        </Badge>
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* TAB 2 — Telephony */}
        {tab === "telephony" && (
          <div className="space-y-4">
            <p className="text-sm text-[#6b6b6b]">
              BYOT (Bring Your Own Telephony) configuration. All provider
              details are superadmin-only and never visible to clients.
            </p>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Telephony Providers</CardTitle>
                <CardDescription>
                  Manage provider credentials, configure defaults, and
                  per-workspace overrides.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-5 gap-3 px-5 py-3 border-b border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
                  <span>Provider</span>
                  <span>Type</span>
                  <span>Status</span>
                  <span>Cost/min</span>
                  <span />
                </div>
                <div className="divide-y divide-[#e0e0e0]">
                  {TELEPHONY_PROVIDERS.map((p) => (
                    <div
                      key={p.type}
                      className="grid grid-cols-5 gap-3 px-5 py-4 text-sm items-center"
                    >
                      <span className="font-medium text-[#0a0a0a]">
                        {p.name}
                      </span>
                      <span className="text-[#6b6b6b] font-mono text-xs">
                        {p.type}
                      </span>
                      <span>
                        {p.status === "active" ? (
                          <Badge className="bg-[#0a0a0a] text-white border-transparent text-xs">
                            Active
                          </Badge>
                        ) : (
                          <Badge className="border-[#e0e0e0] text-[#6b6b6b] bg-white text-xs">
                            Disconnected
                          </Badge>
                        )}
                      </span>
                      <span className="text-[#6b6b6b] font-mono text-xs">
                        {p.cost}
                      </span>
                      <span>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 text-xs"
                        >
                          Configure
                        </Button>
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">BYOT Call Flow</CardTitle>
                <CardDescription>
                  Session anonymization is always ON. Voice AI never receives
                  real phone numbers.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <ol className="space-y-2 text-sm text-[#6b6b6b]">
                  {[
                    "Generate anonymized session_id = uuid()",
                    "Store mapping server-side: session_id → { contact_id, phone, campaign_id }",
                    "Initiate call via telephony provider (Twilio/Telnyx) using real phone number",
                    "Bridge audio stream to Voice AI using only session_id",
                    "Voice AI receives: audio + agent config only — no phone number, no contact surname",
                    'Dynamic variables use generic labels: contact_ref="C-4872", greeting_name="Juan"',
                    "On call end: webhook → map session_id → store results in Supabase",
                  ].map((step, i) => (
                    <li key={i} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#0a0a0a] text-white text-xs font-bold">
                        {i + 1}
                      </span>
                      {step}
                    </li>
                  ))}
                </ol>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3 — Cost Dashboard */}
        {tab === "costs" && (
          <div className="space-y-4">
            <p className="text-sm text-[#6b6b6b]">
              Internal cost visibility — never shown to clients. Shows margin
              per workspace and infrastructure spend.
            </p>
            <div className="grid grid-cols-4 gap-4">
              {[
                {
                  label: "Total Infrastructure Cost",
                  value: `$${MOCK_WORKSPACE_COSTS.reduce((s, w) => s + w.providerCost, 0).toFixed(2)}`,
                  sub: "This month",
                },
                {
                  label: "Total Revenue",
                  value: `$${MOCK_WORKSPACE_COSTS.reduce((s, w) => s + w.planRevenue, 0).toFixed(2)}`,
                  sub: "Subscription + overage",
                },
                {
                  label: "Gross Margin",
                  value: (() => {
                    const rev = MOCK_WORKSPACE_COSTS.reduce(
                      (s, w) => s + w.planRevenue,
                      0,
                    );
                    const cost = MOCK_WORKSPACE_COSTS.reduce(
                      (s, w) => s + w.providerCost,
                      0,
                    );
                    return `${(((rev - cost) / rev) * 100).toFixed(1)}%`;
                  })(),
                  sub: "Revenue minus provider cost",
                },
                {
                  label: "Active Workspaces",
                  value: String(
                    MOCK_WORKSPACE_COSTS.filter((w) => w.minutesUsed > 0)
                      .length,
                  ),
                  sub: "With usage this month",
                },
              ].map((m) => (
                <Card key={m.label}>
                  <CardContent className="p-5">
                    <p className="text-sm text-[#6b6b6b] mb-2">{m.label}</p>
                    <p className="text-2xl font-bold text-[#0a0a0a]">
                      {m.value}
                    </p>
                    <p className="text-xs text-[#6b6b6b] mt-1">{m.sub}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">
                  Per-Workspace Margin
                </CardTitle>
                <CardDescription>
                  Cost, revenue, and margin by workspace. Internal only.
                </CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="grid grid-cols-6 gap-3 px-5 py-3 border-b border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
                  <span className="col-span-2">Workspace</span>
                  <span>Plan</span>
                  <span className="text-right">Revenue</span>
                  <span className="text-right">Provider Cost</span>
                  <span className="text-right">Margin</span>
                </div>
                <div className="divide-y divide-[#e0e0e0]">
                  {MOCK_WORKSPACE_COSTS.map((w) => {
                    const margin = w.planRevenue - w.providerCost;
                    return (
                      <div
                        key={w.name}
                        className="grid grid-cols-6 gap-3 px-5 py-3 text-sm items-center hover:bg-[#f5f5f5]"
                      >
                        <span className="col-span-2 font-medium text-[#0a0a0a]">
                          {w.name}
                        </span>
                        <span className="capitalize text-[#6b6b6b]">
                          {w.plan}
                        </span>
                        <span className="text-right">${w.planRevenue}</span>
                        <span className="text-right text-[#6b6b6b]">
                          ${w.providerCost.toFixed(2)}
                        </span>
                        <span
                          className={`text-right font-medium ${margin < 0 ? "text-red-600" : "text-[#0a0a0a]"}`}
                        >
                          {margin < 0 ? "-" : "+"}${Math.abs(margin).toFixed(2)}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 4 — Provider Health (Real data) */}
        {tab === "health" && <ProviderHealthTab />}
      </div>
    </div>
  );
}
