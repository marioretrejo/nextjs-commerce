"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  MessageSquare,
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  ChevronRight as ArrowRight,
  Loader2,
  Phone,
  Clock,
} from "lucide-react";

interface CoachingReport {
  id: string;
  agent_id: string | null;
  agent_name: string | null;
  priority: string;
  strengths: string[] | null;
  improvements: string[] | null;
  action_items: string[] | null;
  manager_summary: string | null;
  created_at: string;
  qac_interactions: {
    id: string;
    channel: string;
    risk_level: string | null;
    created_at: string;
  } | null;
}

interface CoachingResponse {
  data: CoachingReport[];
  total: number;
  page: number;
  pages: number;
}

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
      if (filterPriority) params.set("min_priority", filterPriority);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);

      const res = await fetch(`/api/qac/coaching?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as { error?: string }).error ?? "Failed to load coaching reports");
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
      "id", "agent_name", "agent_id", "priority", "strengths", "improvements",
      "action_items", "manager_summary", "created_at",
    ];
    const rows = reports.map((r) => [
      r.id,
      r.agent_name ?? "",
      r.agent_id ?? "",
      r.priority,
      (r.strengths ?? []).join("; "),
      (r.improvements ?? []).join("; "),
      (r.action_items ?? []).join("; "),
      r.manager_summary ?? "",
      r.created_at,
    ]);
    const csv = [headers, ...rows]
      .map((row) => row.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
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
              <h1 className="text-lg font-semibold text-white">Coaching Reports</h1>
              <p className="text-sm text-gray-400">{total.toLocaleString()} reports</p>
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
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="border-b border-gray-800 bg-gray-900/30 px-6 py-3">
        <div className="flex flex-wrap items-center gap-3">
          <Filter className="h-4 w-4 text-gray-500" />
          <select
            value={filterPriority}
            onChange={(e) => { setFilterPriority(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Priorities</option>
            <option value="urgent">Urgent</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-sm text-gray-600">to</span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => { setFilterTo(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {(filterPriority || filterFrom || filterTo) && (
            <button
              onClick={() => { setFilterPriority(""); setFilterFrom(""); setFilterTo(""); setPage(1); }}
              className="text-sm text-indigo-400 hover:text-indigo-300"
            >
              Clear filters
            </button>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-6">
        {error && (
          <div className="mb-4 rounded-lg border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        ) : reports.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <MessageSquare className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">No coaching reports found</p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {reports.map((r) => (
                <div
                  key={r.id}
                  onClick={() => router.push(`/qa-center/coaching/${r.id}`)}
                  className="cursor-pointer rounded-xl border border-gray-800 bg-gray-900/50 p-5 transition hover:bg-gray-800/50"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      {/* Top row */}
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`rounded border px-2 py-0.5 text-xs capitalize ${PRIORITY_COLOR[r.priority] ?? "text-gray-400 bg-gray-700/50 border-gray-700"}`}
                        >
                          {r.priority}
                        </span>
                        {r.agent_name && (
                          <span className="text-sm font-medium text-gray-200">{r.agent_name}</span>
                        )}
                        {r.qac_interactions?.risk_level && (
                          <span
                            className={`rounded px-2 py-0.5 text-xs capitalize ${RISK_COLOR[r.qac_interactions.risk_level] ?? "text-gray-400"}`}
                          >
                            {r.qac_interactions.risk_level} risk
                          </span>
                        )}
                        <span className="flex items-center gap-1 text-xs text-gray-500">
                          <Clock className="h-3 w-3" />
                          {fmtRelative(r.created_at)}
                        </span>
                        {r.qac_interactions && (
                          <span className="flex items-center gap-1 text-xs text-gray-500">
                            <Phone className="h-3 w-3" />
                            {r.qac_interactions.channel}
                          </span>
                        )}
                      </div>

                      {/* Manager summary */}
                      {r.manager_summary && (
                        <p className="mt-2 text-sm text-gray-400 line-clamp-2">
                          {r.manager_summary}
                        </p>
                      )}

                      {/* Strengths / Improvements */}
                      <div className="mt-3 flex flex-wrap gap-4">
                        {r.strengths && r.strengths.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs text-emerald-400">Strengths</p>
                            <ul className="space-y-0.5">
                              {r.strengths.slice(0, 2).map((s, i) => (
                                <li key={i} className="text-xs text-gray-500">
                                  · {s}
                                </li>
                              ))}
                              {r.strengths.length > 2 && (
                                <li className="text-xs text-gray-600">
                                  +{r.strengths.length - 2} more
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                        {r.improvements && r.improvements.length > 0 && (
                          <div>
                            <p className="mb-1 text-xs text-amber-400">Improvements</p>
                            <ul className="space-y-0.5">
                              {r.improvements.slice(0, 2).map((s, i) => (
                                <li key={i} className="text-xs text-gray-500">
                                  · {s}
                                </li>
                              ))}
                              {r.improvements.length > 2 && (
                                <li className="text-xs text-gray-600">
                                  +{r.improvements.length - 2} more
                                </li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>

                    <ArrowRight className="h-4 w-4 flex-shrink-0 text-gray-600 mt-1" />
                  </div>
                </div>
              ))}
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-gray-800 pt-4">
                <p className="text-sm text-gray-500">
                  Page {page} of {pages} — {total.toLocaleString()} total
                </p>
                <div className="flex items-center gap-2">
                  <button
                    disabled={page === 1}
                    onClick={() => setPage((p) => p - 1)}
                    className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 disabled:opacity-40 hover:bg-gray-700"
                  >
                    <ChevronLeft className="h-4 w-4" />
                    Prev
                  </button>
                  <button
                    disabled={page === pages}
                    onClick={() => setPage((p) => p + 1)}
                    className="flex items-center gap-1 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 disabled:opacity-40 hover:bg-gray-700"
                  >
                    Next
                    <ChevronRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
