"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { MessageSquare, Download, RefreshCw } from "lucide-react";
import type { CoachingReport, CoachingResponse } from "./_components/config";
import { CoachingFilters } from "./_components/CoachingFilters";
import { ReportsList } from "./_components/ReportsList";

export default function CoachingPage() {
  const router = useRouter();
  const [reports, setReports] = useState<CoachingReport[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [filterPriority, setFilterPriority] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "20" });
      const priorityThresholds: Record<string, number> = {
        urgent: 80,
        high: 65,
        medium: 50,
        low: 0,
      };
      if (filterPriority && filterPriority in priorityThresholds) {
        params.set("min_priority", String(priorityThresholds[filterPriority]));
      }
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);

      const res = await fetch(`/api/qac/coaching?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(
          (j as { error?: string }).error ?? "Failed to load coaching reports",
        );
      }
      const json: CoachingResponse = await res.json();
      setReports(json.data);
      setTotal(json.total);
      setPages(json.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [page, filterPriority, filterFrom, filterTo]);

  useEffect(() => {
    void fetchReports();
  }, [fetchReports]);

  function exportCSV() {
    if (!reports.length) return;
    const headers = [
      "id",
      "agent_name",
      "agent_id",
      "priority_score",
      "strengths",
      "weaknesses",
      "recommended_training",
      "coaching_plan",
      "created_at",
    ];
    const rows = reports.map((r) => [
      r.id,
      r.qac_interactions?.agent_name ?? "",
      r.agent_id ?? "",
      String(r.priority_score),
      (r.strengths ?? []).join("; "),
      (r.weaknesses ?? []).join("; "),
      (r.recommended_training ?? []).join("; "),
      r.coaching_plan ?? "",
      r.created_at,
    ]);
    const csv = [headers, ...rows]
      .map((row) =>
        row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","),
      )
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coaching-reports-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const json = JSON.stringify(reports, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `coaching-reports-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="min-h-screen bg-gray-950 text-gray-100">
      {/* Header */}
      <div className="border-b border-gray-800 bg-gray-900/50 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-indigo-500/10 p-2">
              <MessageSquare className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">
                Coaching Reports
              </h1>
              <p className="text-sm text-gray-400">
                {total.toLocaleString()} reports
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={!reports.length}
              className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-gray-700 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              onClick={exportJSON}
              disabled={!reports.length}
              className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-gray-700 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              JSON
            </button>
            <button
              onClick={() => void fetchReports()}
              className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-gray-700"
            >
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <CoachingFilters
        filterPriority={filterPriority}
        filterFrom={filterFrom}
        filterTo={filterTo}
        onPriority={(v) => {
          setFilterPriority(v);
          setPage(1);
        }}
        onFrom={(v) => {
          setFilterFrom(v);
          setPage(1);
        }}
        onTo={(v) => {
          setFilterTo(v);
          setPage(1);
        }}
        onClear={() => {
          setFilterPriority("");
          setFilterFrom("");
          setFilterTo("");
          setPage(1);
        }}
      />

      {/* Content */}
      <ReportsList
        reports={reports}
        loading={loading}
        error={error}
        page={page}
        pages={pages}
        total={total}
        onOpen={(id) => router.push(`/qa-center/coaching/${id}`)}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}
