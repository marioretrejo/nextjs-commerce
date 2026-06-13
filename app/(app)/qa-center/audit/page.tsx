"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Shield,
  Filter,
  Download,
  RefreshCw,
  ChevronLeft,
  ChevronRight,
  Clock,
  User,
  FileText,
  Settings,
  UserCheck,
  MessageSquare,
} from "lucide-react";

interface AuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  user_id: string | null;
  created_at: string;
}

interface AuditResponse {
  data: AuditLog[];
  total: number;
  page: number;
  pages: number;
}

const ACTION_LABELS: Record<string, string> = {
  analyze: "Analysis Run",
  "interaction.create": "Interaction Created",
  "interaction.delete": "Interaction Deleted",
  "rule.create": "Rule Created",
  "rule.update": "Rule Updated",
  "rule.delete": "Rule Deleted",
  "agent.create": "Agent Created",
  "agent.update": "Agent Updated",
  "agent.deactivate": "Agent Deactivated",
  "agent.view": "Agent Viewed",
  "coaching_report.view": "Coaching Report Viewed",
  "coaching_report.generated": "Coaching Report Generated",
  "review_status.change": "Review Status Changed",
  "comment.create": "Comment Added",
};

const ACTION_ICONS: Record<string, React.ReactNode> = {
  analyze: <FileText className="h-3.5 w-3.5" />,
  "interaction.create": <FileText className="h-3.5 w-3.5" />,
  "interaction.delete": <FileText className="h-3.5 w-3.5" />,
  "rule.create": <Settings className="h-3.5 w-3.5" />,
  "rule.update": <Settings className="h-3.5 w-3.5" />,
  "rule.delete": <Settings className="h-3.5 w-3.5" />,
  "agent.create": <UserCheck className="h-3.5 w-3.5" />,
  "agent.update": <UserCheck className="h-3.5 w-3.5" />,
  "agent.deactivate": <UserCheck className="h-3.5 w-3.5" />,
  "agent.view": <User className="h-3.5 w-3.5" />,
  "coaching_report.view": <FileText className="h-3.5 w-3.5" />,
  "coaching_report.generated": <FileText className="h-3.5 w-3.5" />,
  "review_status.change": <Shield className="h-3.5 w-3.5" />,
  "comment.create": <MessageSquare className="h-3.5 w-3.5" />,
};

const ACTION_COLORS: Record<string, string> = {
  "interaction.delete": "text-red-400 bg-red-400/10",
  "agent.deactivate": "text-red-400 bg-red-400/10",
  "rule.delete": "text-red-400 bg-red-400/10",
  "rule.create": "text-emerald-400 bg-emerald-400/10",
  "agent.create": "text-emerald-400 bg-emerald-400/10",
  "interaction.create": "text-emerald-400 bg-emerald-400/10",
  "comment.create": "text-blue-400 bg-blue-400/10",
  "review_status.change": "text-amber-400 bg-amber-400/10",
};

function formatRelativeTime(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(dateStr).toLocaleDateString();
}

function formatDetails(log: AuditLog): string {
  if (!log.details) return "";
  if (log.action === "review_status.change") {
    const d = log.details as { from?: string; to?: string };
    return d.from && d.to ? `${d.from} → ${d.to}` : "";
  }
  if (log.action === "agent.create") {
    const d = log.details as { name?: string };
    return d.name ? `"${d.name}"` : "";
  }
  if (log.action === "agent.update") {
    const d = log.details as { fields?: string[] };
    return d.fields?.length ? `Fields: ${d.fields.join(", ")}` : "";
  }
  return "";
}

const ALL_ACTIONS = Object.keys(ACTION_LABELS);
const ENTITY_TYPES = ["interaction", "evaluation", "rule", "agent", "coaching_report", "review_comment"];

export default function AuditLogPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [pages, setPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [page, setPage] = useState(1);
  const [filterAction, setFilterAction] = useState("");
  const [filterEntity, setFilterEntity] = useState("");
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ page: String(page), limit: "50" });
      if (filterAction) params.set("action", filterAction);
      if (filterEntity) params.set("entity_type", filterEntity);
      if (filterFrom) params.set("from", filterFrom);
      if (filterTo) params.set("to", filterTo);

      const res = await fetch(`/api/qac/audit-logs?${params}`);
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error ?? "Failed to load audit logs");
      }
      const json: AuditResponse = await res.json();
      setLogs(json.data);
      setTotal(json.total);
      setPages(json.pages);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }, [page, filterAction, filterEntity, filterFrom, filterTo]);

  useEffect(() => {
    void fetchLogs();
  }, [fetchLogs]);

  function exportCSV() {
    if (!logs.length) return;
    const headers = ["timestamp", "action", "entity_type", "entity_id", "user_id", "details", "ip_address"];
    const rows = logs.map((l) => [
      l.created_at,
      l.action,
      l.entity_type,
      l.entity_id ?? "",
      l.user_id ?? "",
      l.details ? JSON.stringify(l.details) : "",
      l.ip_address ?? "",
    ]);
    const csv = [headers, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qa-audit-log-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function exportJSON() {
    const json = JSON.stringify(logs, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `qa-audit-log-${new Date().toISOString().slice(0, 10)}.json`;
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
              <Shield className="h-5 w-5 text-indigo-400" />
            </div>
            <div>
              <h1 className="text-lg font-semibold text-white">Audit Log</h1>
              <p className="text-sm text-gray-400">
                {total.toLocaleString()} events recorded
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={exportCSV}
              disabled={!logs.length}
              className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-gray-700 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              CSV
            </button>
            <button
              onClick={exportJSON}
              disabled={!logs.length}
              className="flex items-center gap-1.5 rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 transition hover:bg-gray-700 disabled:opacity-40"
            >
              <Download className="h-3.5 w-3.5" />
              JSON
            </button>
            <button
              onClick={() => void fetchLogs()}
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
            value={filterAction}
            onChange={(e) => { setFilterAction(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Actions</option>
            {ALL_ACTIONS.map((a) => (
              <option key={a} value={a}>{ACTION_LABELS[a]}</option>
            ))}
          </select>
          <select
            value={filterEntity}
            onChange={(e) => { setFilterEntity(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          >
            <option value="">All Entities</option>
            {ENTITY_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => { setFilterFrom(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          <span className="text-gray-600 text-sm">to</span>
          <input
            type="date"
            value={filterTo}
            onChange={(e) => { setFilterTo(e.target.value); setPage(1); }}
            className="rounded-lg border border-gray-700 bg-gray-800 px-3 py-1.5 text-sm text-gray-300 focus:outline-none focus:ring-1 focus:ring-indigo-500"
          />
          {(filterAction || filterEntity || filterFrom || filterTo) && (
            <button
              onClick={() => { setFilterAction(""); setFilterEntity(""); setFilterFrom(""); setFilterTo(""); setPage(1); }}
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
            <RefreshCw className="h-6 w-6 animate-spin text-indigo-400" />
          </div>
        ) : logs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-500">
            <Shield className="mb-3 h-10 w-10 opacity-30" />
            <p className="text-sm">No audit events found</p>
          </div>
        ) : (
          <>
            {/* Timeline */}
            <div className="relative">
              <div className="absolute left-[23px] top-0 bottom-0 w-px bg-gray-800" />
              <div className="space-y-1">
                {logs.map((log) => {
                  const colorClass =
                    ACTION_COLORS[log.action] ?? "text-gray-400 bg-gray-700/50";
                  const detail = formatDetails(log);
                  return (
                    <div
                      key={log.id}
                      className="relative flex items-start gap-4 rounded-lg px-2 py-2.5 transition hover:bg-gray-800/40"
                    >
                      {/* Timeline dot */}
                      <div
                        className={`relative z-10 flex h-[30px] w-[30px] flex-shrink-0 items-center justify-center rounded-full border border-gray-700 ${colorClass}`}
                      >
                        {ACTION_ICONS[log.action] ?? (
                          <Clock className="h-3.5 w-3.5" />
                        )}
                      </div>

                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between gap-2">
                          <span className="text-sm font-medium text-gray-200">
                            {ACTION_LABELS[log.action] ?? log.action}
                          </span>
                          <span className="flex-shrink-0 text-xs text-gray-500">
                            {formatRelativeTime(log.created_at)}
                          </span>
                        </div>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                          <span className="rounded bg-gray-800 px-1.5 py-0.5 font-mono text-gray-400">
                            {log.entity_type}
                          </span>
                          {log.entity_id && (
                            <span className="font-mono text-gray-600">
                              {log.entity_id.slice(0, 8)}…
                            </span>
                          )}
                          {log.user_id && (
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {log.user_id.slice(0, 8)}…
                            </span>
                          )}
                          {detail && (
                            <span className="text-gray-400">{detail}</span>
                          )}
                          {log.ip_address && (
                            <span className="text-gray-600">{log.ip_address}</span>
                          )}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Pagination */}
            {pages > 1 && (
              <div className="mt-6 flex items-center justify-between border-t border-gray-800 pt-4">
                <p className="text-sm text-gray-500">
                  Page {page} of {pages} — {total.toLocaleString()} total events
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
