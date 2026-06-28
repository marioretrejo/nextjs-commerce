"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  MessageSquare,
  CheckCircle,
  AlertCircle,
  ChevronRight,
  Loader2,
  XCircle,
  Phone,
  Clock,
  User,
  Star,
  Shield,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────── */
interface CoachingDetail {
  id: string;
  agent_id: string | null;
  priority_score: number;
  strengths: string[] | null;
  weaknesses: string[] | null;
  recommended_training: string[] | null;
  coaching_plan: string | null;
  created_at: string;
  agent_profile: {
    id: string;
    name: string;
    email: string | null;
    team: string | null;
    role: string | null;
  } | null;
  qac_interactions: {
    id: string;
    agent_name: string;
    channel: string;
    duration_s: number | null;
    created_at: string;
    risk_level: string | null;
    customer_name: string | null;
    review_status: string;
    qac_evaluations: Array<{
      overall_score: number | null;
      compliance_score: number | null;
      sales_score: number | null;
      soft_skills_score: number | null;
      summary: string | null;
      coaching_summary: string | null;
    }>;
  } | null;
}

/* ─── Helpers ────────────────────────────────────────────────────── */
const PRIORITY_COLOR: Record<string, string> = {
  urgent: "text-red-400 bg-red-400/10 border-red-400/20",
  high: "text-amber-400 bg-amber-400/10 border-amber-400/20",
  medium: "text-blue-400 bg-blue-400/10 border-blue-400/20",
  low: "text-gray-400 bg-gray-700/50 border-gray-700",
};

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

function priorityLabel(score: number): string {
  if (score >= 80) return "urgent";
  if (score >= 65) return "high";
  if (score >= 50) return "medium";
  return "low";
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
    hour: "2-digit",
    minute: "2-digit",
  });
}

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

/* ─── Page ───────────────────────────────────────────────────────── */
export default function CoachingDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const router = useRouter();
  const [reportId, setReportId] = useState<string | null>(null);
  const [report, setReport] = useState<CoachingDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    params.then(({ id }) => setReportId(id));
  }, [params]);

  const fetchReport = useCallback(async () => {
    if (!reportId) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/qac/coaching/${reportId}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Report not found");
      }
      setReport(await res.json());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [reportId]);

  useEffect(() => {
    void fetchReport();
  }, [fetchReport]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-950">
        <Loader2 className="h-7 w-7 animate-spin text-indigo-400" />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-gray-950 text-gray-400">
        <XCircle className="h-10 w-10 text-red-500/50" />
        <p className="text-sm">{error ?? "Report not found"}</p>
        <button
          onClick={() => router.push("/qa-center/coaching")}
          className="text-sm text-indigo-400 hover:text-indigo-300"
        >
          ← Back to Coaching
        </button>
      </div>
    );
  }

  const interaction = report.qac_interactions;
  const evaluation = interaction?.qac_evaluations?.[0];

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => router.push("/qa-center/coaching")}
              className="rounded-lg p-1.5 text-gray-400 transition hover:bg-gray-800 hover:text-gray-200"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="rounded-lg bg-indigo-500/10 p-2">
              <MessageSquare className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">
                Coaching Report
              </h1>
              <p className="text-sm text-gray-400">
                {report.qac_interactions?.agent_name ?? "Unknown Agent"} ·{" "}
                {fmtDate(report.created_at)}
              </p>
            </div>
          </div>
          <span
            className={`rounded border px-3 py-1 text-sm capitalize ${PRIORITY_COLOR[priorityLabel(report.priority_score)] ?? "text-gray-400 bg-gray-700/50 border-gray-700"}`}
          >
            {priorityLabel(report.priority_score)} priority
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-4xl space-y-6 p-6">
        {/* Agent Profile */}
        {report.agent_profile && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h2 className="mb-3 text-sm font-medium text-gray-400">Agent</h2>
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-indigo-500/20 text-sm font-semibold text-indigo-300">
                {report.agent_profile.name.slice(0, 2).toUpperCase()}
              </div>
              <div>
                <p className="font-medium text-gray-200">
                  {report.agent_profile.name}
                </p>
                <p className="text-sm text-gray-500">
                  {report.agent_profile.role ?? "Agent"}
                  {report.agent_profile.team
                    ? ` · ${report.agent_profile.team}`
                    : ""}
                  {report.agent_profile.email
                    ? ` · ${report.agent_profile.email}`
                    : ""}
                </p>
              </div>
              <button
                onClick={() =>
                  router.push(`/qa-center/agents/${report.agent_profile!.id}`)
                }
                className="ml-auto flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
              >
                View Profile <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        )}

        {/* Related Call */}
        {interaction && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h2 className="mb-3 text-sm font-medium text-gray-400">
              Related Call
            </h2>
            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded bg-gray-800 px-2 py-0.5 font-mono text-xs text-gray-400">
                {interaction.channel}
              </span>
              {interaction.risk_level && (
                <span
                  className={`rounded px-2 py-0.5 text-xs capitalize ${RISK_COLOR[interaction.risk_level] ?? "text-gray-400"}`}
                >
                  {interaction.risk_level} risk
                </span>
              )}
              <span
                className={`rounded px-2 py-0.5 text-xs capitalize ${REVIEW_COLOR[interaction.review_status] ?? "text-gray-400"}`}
              >
                {interaction.review_status.replace(/_/g, " ")}
              </span>
              <span className="flex items-center gap-1 text-xs text-gray-500">
                <Clock className="h-3 w-3" />
                {fmtDuration(interaction.duration_s)}
              </span>
              <span className="text-xs text-gray-500">
                {fmtDate(interaction.created_at)}
              </span>
              {interaction.customer_name && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <User className="h-3 w-3" />
                  {interaction.customer_name}
                </span>
              )}
              <button
                onClick={() =>
                  router.push(`/qa-center/calls/${interaction.id}`)
                }
                className="ml-auto flex items-center gap-1 text-sm text-indigo-400 hover:text-indigo-300"
              >
                View Call <ChevronRight className="h-3.5 w-3.5" />
              </button>
            </div>

            {evaluation && (
              <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {[
                  {
                    label: "Overall",
                    score: evaluation.overall_score,
                    icon: Star,
                  },
                  {
                    label: "Compliance",
                    score: evaluation.compliance_score,
                    icon: Shield,
                  },
                  { label: "Sales", score: evaluation.sales_score, icon: Star },
                  {
                    label: "Soft Skills",
                    score: evaluation.soft_skills_score,
                    icon: Star,
                  },
                ].map(({ label, score }) => (
                  <div
                    key={label}
                    className="rounded-lg bg-gray-800/50 px-3 py-2"
                  >
                    <p className="text-xs text-gray-500">{label}</p>
                    <div className="mt-1">
                      {score != null ? (
                        <ScoreBadge score={score} />
                      ) : (
                        <span className="text-xs text-gray-600">—</span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Coaching Plan */}
        {report.coaching_plan ? (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h2 className="mb-3 text-sm font-medium text-gray-400">
              Coaching Plan
            </h2>
            <p className="text-sm leading-relaxed text-gray-300">
              {report.coaching_plan}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h2 className="mb-3 text-sm font-medium text-gray-400">
              Coaching Plan
            </h2>
            <p className="text-sm text-gray-600">No coaching plan available.</p>
          </div>
        )}

        {/* Coaching Summary from Evaluation */}
        {evaluation?.coaching_summary && (
          <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-5">
            <h2 className="mb-3 text-sm font-medium text-indigo-400">
              AI Coaching Notes
            </h2>
            <p className="text-sm leading-relaxed text-gray-300">
              {evaluation.coaching_summary}
            </p>
          </div>
        )}

        {/* Strengths */}
        {report.strengths && report.strengths.length > 0 && (
          <div className="rounded-xl border border-emerald-500/20 bg-emerald-500/5 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-emerald-400">
              <CheckCircle className="h-4 w-4" />
              Strengths
            </h2>
            <ul className="space-y-2">
              {report.strengths.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-300"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-emerald-400" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Weaknesses */}
        {report.weaknesses && report.weaknesses.length > 0 && (
          <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 p-5">
            <h2 className="mb-3 flex items-center gap-2 text-sm font-medium text-amber-400">
              <AlertCircle className="h-4 w-4" />
              Areas to Improve
            </h2>
            <ul className="space-y-2">
              {report.weaknesses.map((s, i) => (
                <li
                  key={i}
                  className="flex items-start gap-2 text-sm text-gray-300"
                >
                  <span className="mt-1.5 h-1.5 w-1.5 flex-shrink-0 rounded-full bg-amber-400" />
                  {s}
                </li>
              ))}
            </ul>
          </div>
        )}

        {/* Recommended Training */}
        {report.recommended_training &&
          report.recommended_training.length > 0 && (
            <div className="rounded-xl border border-blue-500/20 bg-blue-500/5 p-5">
              <h2 className="mb-3 text-sm font-medium text-blue-400">
                Recommended Training
              </h2>
              <ul className="space-y-2">
                {report.recommended_training.map((s, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-300"
                  >
                    <span className="mt-0.5 flex h-4 w-4 flex-shrink-0 items-center justify-center rounded-full border border-blue-400/40 text-xs text-blue-400">
                      {i + 1}
                    </span>
                    {s}
                  </li>
                ))}
              </ul>
            </div>
          )}

        {/* Evaluation Summary */}
        {evaluation?.summary && (
          <div className="rounded-xl border border-gray-800 bg-gray-900/50 p-5">
            <h2 className="mb-3 text-sm font-medium text-gray-400">
              Evaluation Summary
            </h2>
            <p className="text-sm leading-relaxed text-gray-400">
              {evaluation.summary}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
