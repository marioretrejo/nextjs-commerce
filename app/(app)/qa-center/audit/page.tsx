"use client";

import { useState, useEffect, useCallback } from "react";
import { Shield, Download, RefreshCw } from "lucide-react";
import { type AuditLog, type AuditResponse } from "./_components/config";
import { AuditFilters } from "./_components/AuditFilters";
import { AuditTimeline } from "./_components/AuditTimeline";

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
    const headers = [
      "timestamp",
      "action",
      "entity_type",
      "entity_id",
      "user_id",
      "details",
      "ip_address",
    ];
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
              <RefreshCw
                className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <AuditFilters
        filterAction={filterAction}
        filterEntity={filterEntity}
        filterFrom={filterFrom}
        filterTo={filterTo}
        onAction={(v) => {
          setFilterAction(v);
          setPage(1);
        }}
        onEntity={(v) => {
          setFilterEntity(v);
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
          setFilterAction("");
          setFilterEntity("");
          setFilterFrom("");
          setFilterTo("");
          setPage(1);
        }}
      />

      {/* Content */}
      <AuditTimeline
        logs={logs}
        loading={loading}
        error={error}
        page={page}
        pages={pages}
        total={total}
        onPrev={() => setPage((p) => p - 1)}
        onNext={() => setPage((p) => p + 1)}
      />
    </div>
  );
}
