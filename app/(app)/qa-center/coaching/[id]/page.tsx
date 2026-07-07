"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare, Loader2, XCircle } from "lucide-react";
import type { CoachingDetail } from "./_components/types";
import { PRIORITY_COLOR, priorityLabel, fmtDate } from "./_components/helpers";
import { AgentProfileCard } from "./_components/AgentProfileCard";
import { RelatedCallCard } from "./_components/RelatedCallCard";
import { CoachingSections } from "./_components/CoachingSections";

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
        {report.agent_profile && (
          <AgentProfileCard
            profile={report.agent_profile}
            onViewProfile={(id) => router.push(`/qa-center/agents/${id}`)}
          />
        )}

        {interaction && (
          <RelatedCallCard
            interaction={interaction}
            evaluation={evaluation}
            onViewCall={(id) => router.push(`/qa-center/calls/${id}`)}
          />
        )}

        <CoachingSections report={report} evaluation={evaluation} />
      </div>
    </div>
  );
}
