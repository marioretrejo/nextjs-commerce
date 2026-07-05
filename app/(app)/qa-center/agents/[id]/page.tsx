"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { EmptyState } from "@/components/ui/empty-state";
import { hasChartData } from "@/lib/chart-utils";
import {
  ArrowLeft,
  User,
  Phone,
  Star,
  TrendingUp,
  TrendingDown,
  Minus,
  Shield,
  MessageSquare,
  BarChart2,
  Clock,
  CheckCircle,
  AlertCircle,
  XCircle,
  Loader2,
  Edit2,
  Save,
  X,
  ChevronRight,
  FileText,
  Activity,
} from "lucide-react";

/* ─── Types ─────────────────────────────────────────────────────── */
interface AgentProfile {
  id: string;
  agent_id: string;
  name: string;
  email: string | null;
  team: string | null;
  role: string | null;
  hire_date: string | null;
  is_active: boolean;
  created_at: string;
  metrics: {
    call_count: number;
    avg_score: number;
    avg_compliance: number;
    avg_sales: number;
    avg_soft_skills: number;
    avg_risk: number;
    last_call_at: string | null;
    improvement_trend: "up" | "down" | "stable";
  };
  score_trend: Array<{ date: string; score: number }>;
  recent_calls: CallItem[];
  coaching_reports: CoachingItem[];
}

interface CallItem {
  id: string;
  created_at: string;
  channel: string;
  duration_s: number | null;
  risk_level: string | null;
  review_status: string;
  overall_score: number | null;
  compliance_score: number | null;
  sales_score: number | null;
  soft_skills_score: number | null;
}

interface CoachingItem {
  id: string;
  created_at: string;
  priority: string;
  strengths: string[] | null;
  improvements: string[] | null;
  qac_interactions?: { created_at: string; channel: string } | null;
}

/* ─── Helpers ────────────────────────────────────────────────────── */
const RISK_COLOR: Record<string, string> = {
  high: "text-red-400 bg-red-400/10",
  medium: "text-amber-400 bg-amber-400/10",
  low: "text-emerald-400 bg-emerald-400/10",
};

const REVIEW_COLOR: Record<string, string> = {
  pending_review: "text-gray-400 bg-gray-700/50",
  in_review: "text-blue-400 bg-blue-400/10",
  reviewed: "text-indigo-400 bg-indigo-400/10",
  approved: "text-emerald-400 bg-emerald-400/10",
  disputed: "text-red-400 bg-red-400/10",
};

const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-red-400 bg-red-400/10",
  high: "text-amber-400 bg-amber-400/10",
  medium: "text-blue-400 bg-blue-400/10",
  low: "text-gray-400 bg-gray-700/50",
};

function ScoreBadge({ score }: { score: number }) {
  const cls =
    score >= 80
      ? "text-emerald-400 bg-emerald-400/10"
      : score >= 65
        ? "text-amber-400 bg-amber-400/10"
        : "text-red-400 bg-red-400/10";
  return (
    <span className={`rounded px-2 py-0.5 text-xs font-semibold ${cls}`}>
      {score.toFixed(0)}
    </span>
  );
}

function TrendIcon({ trend }: { trend: "up" | "down" | "stable" }) {
  if (trend === "up")
    return <TrendingUp className="h-4 w-4 text-emerald-400" />;
  if (trend === "down")
    return <TrendingDown className="h-4 w-4 text-red-400" />;
  return <Minus className="h-4 w-4 text-gray-500" />;
}

function fmtDuration(s: number | null) {
  if (!s) return "—";
  const m = Math.floor(s / 60);
  const sec = s % 60;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function fmtRelative(d: string) {
  const diff = Date.now() - new Date(d).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return days < 30 ? `${days}d ago` : fmtDate(d);
}

/* ─── Mini sparkline (SVG) ───────────────────────────────────────── */
function Sparkline({ data }: { data: Array<{ date: string; score: number }> }) {
  // Guard: empty or all-zero series must not render as a flat/solid line.
  if (
    data.length < 2 ||
    !hasChartData(data, (d) => (d as { score: number }).score)
  ) {
    return <EmptyState compact title="Sin actividad aún" />;
  }
  const W = 120,
    H = 36,
    PAD = 4;
  const scores = data.map((d) => d.score);
  const min = Math.min(...scores);
  const max = Math.max(...scores);
  const range = max - min || 1;
  const pts = data
    .map((d, i) => {
      const x = PAD + (i / (data.length - 1)) * (W - PAD * 2);
      const y = H - PAD - ((d.score - min) / range) * (H - PAD * 2);
      return `${x},${y}`;
    })
    .join(" ");
  const last = scores[scores.length - 1]!;
  const first = scores[0]!;
  const stroke = last >= first ? "#34d399" : "#f87171";
  return (
    <svg width={W} height={H} className="inline-block align-middle">
      <polyline
        points={pts}
        fill="none"
        stroke={stroke}
        strokeWidth="1.5"
        strokeLinejoin="round"
      />
    </svg>
  );
}

/* ─── Main Page ──────────────────────────────────────────────────── */
type Tab = "overview" | "calls" | "coaching" | "performance";

export default function AgentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [agentDbId, setAgentDbId] = useState<string | null>(null);
  const [profile, setProfile] = useState<AgentProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("overview");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editFields, setEditFields] = useState({
    name: "",
    email: "",
    team: "",
    role: "",
    hire_date: "",
  });

  // Resolve params
  useEffect(() => {
    params.then(({ id }) => setAgentDbId(id));
  }, [params]);

  const fetchProfile = useCallback(async () => {
    if (!agentDbId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/qac/agents/${agentDbId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ?? "Failed to load agent",
        );
      }
      const data: AgentProfile = await res.json();
      setProfile(data);
      setEditFields({
        name: data.name ?? "",
        email: data.email ?? "",
        team: data.team ?? "",
        role: data.role ?? "",
        hire_date: data.hire_date ?? "",
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [agentDbId]);

  useEffect(() => {
    void fetchProfile();
  }, [fetchProfile]);

  async function saveEdits() {
    if (!agentDbId || !profile) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/qac/agents/${agentDbId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: editFields.name || undefined,
          email: editFields.email || undefined,
          team: editFields.team || undefined,
          role: editFields.role || undefined,
          hire_date: editFields.hire_date || undefined,
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Failed to save");
      }
      await fetchProfile();
      setEditing(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function deactivate() {
    if (!agentDbId || !profile) return;
    if (
      !confirm(
        `Deactivate ${profile.name}? They will no longer appear in active agent lists.`,
      )
    )
      return;
    try {
      const res = await fetch(`/api/qac/agents/${agentDbId}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error("Failed to deactivate");
      router.push("/qa-center/agents");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Deactivate failed");
    }
  }

  /* ── Skeleton ── */
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (error && !profile) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 text-gray-400">
        <XCircle className="h-10 w-10 text-red-500/50" />
        <p className="text-sm">{error}</p>
        <button
          onClick={() => router.push("/qa-center/agents")}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          ← Back to Agents
        </button>
      </div>
    );
  }

  if (!profile) return null;

  const m = profile.metrics;

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-4">
            <button
              onClick={() => router.push("/qa-center/agents")}
              className="mt-0.5 flex-shrink-0 rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-gray-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div>
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-300">
                  {profile.name.slice(0, 2).toUpperCase()}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h1 className="text-lg font-semibold text-white">
                      {profile.name}
                    </h1>
                    {!profile.is_active && (
                      <span className="rounded bg-red-500/10 px-2 py-0.5 text-xs text-red-400">
                        Inactive
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-400">
                    {profile.role ?? "Agent"}
                    {profile.team ? ` · ${profile.team}` : ""}
                    {profile.email ? ` · ${profile.email}` : ""}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {editing ? (
              <>
                <button
                  onClick={() => setEditing(false)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <X className="h-3.5 w-3.5" />
                  Cancel
                </button>
                <button
                  onClick={() => void saveEdits()}
                  disabled={saving}
                  className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3 py-1.5 text-sm text-white hover:bg-indigo-500 disabled:opacity-50"
                >
                  {saving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Save className="h-3.5 w-3.5" />
                  )}
                  Save
                </button>
              </>
            ) : (
              <>
                <button
                  onClick={() => setEditing(true)}
                  className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 hover:bg-gray-700"
                >
                  <Edit2 className="h-3.5 w-3.5" />
                  Edit
                </button>
                {profile.is_active && (
                  <button
                    onClick={() => void deactivate()}
                    className="flex items-center gap-1.5 rounded-lg border border-red-800/50 bg-red-900/20 px-3 py-1.5 text-sm text-red-400 hover:bg-red-900/30"
                  >
                    <XCircle className="h-3.5 w-3.5" />
                    Deactivate
                  </button>
                )}
              </>
            )}
          </div>
        </div>

        {/* Inline edit form */}
        {editing && (
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
            {(
              [
                { field: "name", label: "Name" },
                { field: "email", label: "Email" },
                { field: "team", label: "Team" },
                { field: "role", label: "Role" },
                { field: "hire_date", label: "Hire Date", type: "date" },
              ] as Array<{
                field: keyof typeof editFields;
                label: string;
                type?: string;
              }>
            ).map(({ field, label, type }) => (
              <div key={field}>
                <label className="mb-1 block text-xs text-gray-500">
                  {label}
                </label>
                <input
                  type={type ?? "text"}
                  value={editFields[field]}
                  onChange={(e) =>
                    setEditFields((prev) => ({
                      ...prev,
                      [field]: e.target.value,
                    }))
                  }
                  className="w-full rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
            ))}
          </div>
        )}

        {error && <p className="mt-2 text-xs text-red-400">{error}</p>}

        {/* Tabs */}
        <div className="mt-4 flex gap-1">
          {(
            [
              { id: "overview", label: "Overview", icon: User },
              { id: "calls", label: "Calls", icon: Phone },
              { id: "coaching", label: "Coaching", icon: MessageSquare },
              { id: "performance", label: "Performance", icon: BarChart2 },
            ] as Array<{
              id: Tab;
              label: string;
              icon: React.FC<{ className?: string }>;
            }>
          ).map(({ id, label, icon: Icon }) => (
            <button
              key={id}
              onClick={() => setTab(id)}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm transition ${
                tab === id
                  ? "bg-indigo-600/20 text-indigo-300"
                  : "text-gray-400 hover:bg-gray-800 hover:text-gray-200"
              }`}
            >
              <Icon className="h-3.5 w-3.5" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {tab === "overview" && <OverviewTab profile={profile} />}
        {tab === "calls" && (
          <CallsTab calls={profile.recent_calls} router={router} />
        )}
        {tab === "coaching" && (
          <CoachingTab reports={profile.coaching_reports} />
        )}
        {tab === "performance" && <PerformanceTab profile={profile} />}
      </div>
    </div>
  );
}

/* ─── Overview Tab ───────────────────────────────────────────────── */
function OverviewTab({ profile }: { profile: AgentProfile }) {
  const m = profile.metrics;
  const stats = [
    { label: "Total Calls", value: m.call_count.toString(), icon: Phone },
    {
      label: "Avg Score",
      value: m.avg_score > 0 ? m.avg_score.toFixed(1) : "—",
      icon: Star,
    },
    {
      label: "Compliance",
      value: m.avg_compliance > 0 ? m.avg_compliance.toFixed(1) : "—",
      icon: Shield,
    },
    {
      label: "Trend",
      value: m.improvement_trend,
      icon:
        m.improvement_trend === "up"
          ? TrendingUp
          : m.improvement_trend === "down"
            ? TrendingDown
            : Minus,
    },
  ];

  return (
    <div className="space-y-6">
      {/* KPI cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {stats.map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-800 bg-gray-900/50 p-4"
          >
            <div className="mb-2 flex items-center gap-2 text-xs text-gray-500">
              <Icon className="h-3.5 w-3.5" />
              {label}
            </div>
            <p className="text-2xl font-semibold text-white">{value}</p>
          </div>
        ))}
      </div>

      {/* Profile info */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="mb-4 text-sm font-medium text-gray-300">Profile Info</h3>
        <dl className="grid grid-cols-2 gap-x-8 gap-y-3 sm:grid-cols-3">
          {[
            { label: "Agent ID", value: profile.agent_id },
            { label: "Team", value: profile.team ?? "—" },
            { label: "Role", value: profile.role ?? "—" },
            { label: "Email", value: profile.email ?? "—" },
            {
              label: "Hire Date",
              value: profile.hire_date
                ? new Date(profile.hire_date).toLocaleDateString()
                : "—",
            },
            {
              label: "Last Call",
              value: m.last_call_at ? fmtRelative(m.last_call_at) : "Never",
            },
          ].map(({ label, value }) => (
            <div key={label}>
              <dt className="text-xs text-gray-500">{label}</dt>
              <dd className="mt-0.5 text-sm text-gray-200">{value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {/* Score breakdown */}
      {m.avg_score > 0 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <h3 className="mb-4 text-sm font-medium text-gray-300">
            Score Breakdown
          </h3>
          <div className="space-y-3">
            {[
              {
                label: "Compliance",
                value: m.avg_compliance,
                color: "bg-blue-500",
              },
              { label: "Sales", value: m.avg_sales, color: "bg-emerald-500" },
              {
                label: "Soft Skills",
                value: m.avg_soft_skills,
                color: "bg-purple-500",
              },
              { label: "Overall", value: m.avg_score, color: "bg-indigo-500" },
            ].map(({ label, value, color }) => (
              <div key={label} className="flex items-center gap-3">
                <span className="w-24 flex-shrink-0 text-xs text-gray-400">
                  {label}
                </span>
                <div className="flex-1 rounded-full bg-gray-800">
                  <div
                    className={`h-2 rounded-full ${color} transition-all`}
                    style={{ width: `${Math.min(100, value)}%` }}
                  />
                </div>
                <span className="w-10 text-right text-xs text-gray-300">
                  {value > 0 ? value.toFixed(0) : "—"}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Score trend mini preview */}
      {profile.score_trend.length >= 2 && (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-medium text-gray-300">Score Trend</h3>
            <TrendIcon trend={m.improvement_trend} />
          </div>
          <div className="mt-3">
            <Sparkline data={profile.score_trend} />
          </div>
          <p className="mt-1 text-xs text-gray-600">
            {profile.score_trend.length} evaluated calls
          </p>
        </div>
      )}
    </div>
  );
}

/* ─── Calls Tab ──────────────────────────────────────────────────── */
function CallsTab({
  calls,
  router,
}: {
  calls: CallItem[];
  router: ReturnType<typeof useRouter>;
}) {
  if (!calls.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <Phone className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm">No calls recorded yet</p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-gray-800">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-gray-800 bg-gray-900/50">
            {[
              "Date",
              "Channel",
              "Duration",
              "Score",
              "Compliance",
              "Sales",
              "Risk",
              "Status",
              "",
            ].map((h) => (
              <th
                key={h}
                className="px-4 py-2.5 text-left text-xs font-medium text-gray-500"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {calls.map((c) => (
            <tr
              key={c.id}
              onClick={() => router.push(`/qa-center/calls/${c.id}`)}
              className="cursor-pointer border-b border-gray-800/50 transition hover:bg-gray-800/40 last:border-0"
            >
              <td className="px-4 py-2.5 text-gray-300">
                {fmtRelative(c.created_at)}
              </td>
              <td className="px-4 py-2.5">
                <span className="rounded bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-400">
                  {c.channel}
                </span>
              </td>
              <td className="px-4 py-2.5 text-gray-400">
                {fmtDuration(c.duration_s)}
              </td>
              <td className="px-4 py-2.5">
                {c.overall_score != null ? (
                  <ScoreBadge score={c.overall_score} />
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-400">
                {c.compliance_score != null
                  ? c.compliance_score.toFixed(0)
                  : "—"}
              </td>
              <td className="px-4 py-2.5 text-xs text-gray-400">
                {c.sales_score != null ? c.sales_score.toFixed(0) : "—"}
              </td>
              <td className="px-4 py-2.5">
                {c.risk_level ? (
                  <span
                    className={`rounded px-2 py-0.5 text-xs capitalize ${RISK_COLOR[c.risk_level] ?? "text-gray-400"}`}
                  >
                    {c.risk_level}
                  </span>
                ) : (
                  <span className="text-gray-600">—</span>
                )}
              </td>
              <td className="px-4 py-2.5">
                <span
                  className={`rounded px-2 py-0.5 text-xs capitalize ${REVIEW_COLOR[c.review_status] ?? "text-gray-400"}`}
                >
                  {c.review_status.replace(/_/g, " ")}
                </span>
              </td>
              <td className="px-4 py-2.5">
                <ChevronRight className="h-4 w-4 text-gray-600" />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ─── Coaching Tab ───────────────────────────────────────────────── */
function CoachingTab({ reports }: { reports: CoachingItem[] }) {
  const router = useRouter();

  if (!reports.length) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-gray-500">
        <MessageSquare className="mb-3 h-10 w-10 opacity-30" />
        <p className="text-sm">No coaching reports yet</p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {reports.map((r) => (
        <div
          key={r.id}
          onClick={() => router.push(`/qa-center/coaching/${r.id}`)}
          className="cursor-pointer rounded-xl border border-gray-800 bg-gray-900/50 p-4 transition hover:bg-gray-800/50"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <span
                className={`rounded px-2 py-0.5 text-xs capitalize ${PRIORITY_COLOR[r.priority] ?? "text-gray-400"}`}
              >
                {r.priority}
              </span>
              <span className="text-xs text-gray-500">
                {fmtDate(r.created_at)}
              </span>
            </div>
            <ChevronRight className="h-4 w-4 flex-shrink-0 text-gray-600" />
          </div>
          {r.strengths && r.strengths.length > 0 && (
            <div className="mt-3">
              <p className="mb-1 text-xs text-emerald-400">Strengths</p>
              <ul className="space-y-0.5">
                {r.strengths.slice(0, 2).map((s, i) => (
                  <li key={i} className="text-xs text-gray-400">
                    · {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {r.improvements && r.improvements.length > 0 && (
            <div className="mt-2">
              <p className="mb-1 text-xs text-amber-400">Areas to Improve</p>
              <ul className="space-y-0.5">
                {r.improvements.slice(0, 2).map((s, i) => (
                  <li key={i} className="text-xs text-gray-400">
                    · {s}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

/* ─── Performance Tab ────────────────────────────────────────────── */
function PerformanceTab({ profile }: { profile: AgentProfile }) {
  const m = profile.metrics;
  const trend = profile.score_trend;

  return (
    <div className="space-y-6">
      {/* Summary metrics */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { label: "Avg Overall", value: m.avg_score, suffix: "" },
          { label: "Avg Compliance", value: m.avg_compliance, suffix: "" },
          { label: "Avg Sales", value: m.avg_sales, suffix: "" },
          { label: "Avg Soft Skills", value: m.avg_soft_skills, suffix: "" },
        ].map(({ label, value }) => (
          <div
            key={label}
            className="rounded-xl border border-gray-800 bg-gray-900/50 p-4"
          >
            <p className="text-xs text-gray-500">{label}</p>
            <p className="mt-1 text-2xl font-semibold text-white">
              {value > 0 ? value.toFixed(1) : "—"}
            </p>
          </div>
        ))}
      </div>

      {/* Score trend table */}
      {trend.length > 0 ? (
        <div className="rounded-xl border border-gray-800 bg-gray-900/50">
          <div className="border-b border-gray-800 px-5 py-3">
            <h3 className="text-sm font-medium text-gray-300">
              Score Trend
              <span className="ml-2 text-xs font-normal text-gray-500">
                ({trend.length} evaluated calls)
              </span>
            </h3>
          </div>
          <div className="p-5">
            <Sparkline data={trend} />
          </div>
          <div className="max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-900">
                <tr className="border-b border-gray-800">
                  <th className="px-5 py-2 text-left text-xs font-medium text-gray-500">
                    Date
                  </th>
                  <th className="px-5 py-2 text-right text-xs font-medium text-gray-500">
                    Score
                  </th>
                </tr>
              </thead>
              <tbody>
                {[...trend].reverse().map((d, i) => (
                  <tr
                    key={i}
                    className="border-b border-gray-800/50 last:border-0"
                  >
                    <td className="px-5 py-2 text-gray-400">
                      {fmtDate(d.date)}
                    </td>
                    <td className="px-5 py-2 text-right">
                      <ScoreBadge score={d.score} />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-16 text-gray-500">
          <Activity className="mb-3 h-10 w-10 opacity-30" />
          <p className="text-sm">No evaluated calls yet</p>
        </div>
      )}

      {/* Risk distribution */}
      <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
        <h3 className="mb-3 text-sm font-medium text-gray-300">
          Avg Risk Score
        </h3>
        <div className="flex items-center gap-3">
          <div className="flex-1 rounded-full bg-gray-800">
            <div
              className="h-3 rounded-full bg-amber-500 transition-all"
              style={{ width: `${Math.min(100, m.avg_risk)}%` }}
            />
          </div>
          <span className="text-sm font-semibold text-gray-200">
            {m.avg_risk > 0 ? m.avg_risk.toFixed(1) : "—"}
          </span>
        </div>
        <p className="mt-1 text-xs text-gray-600">
          Lower is better — higher risk means more escalations
        </p>
      </div>
    </div>
  );
}
