"use client";

import { useState } from "react";
import { RotateCw, Search } from "lucide-react";
import type { Call } from "@/lib/supabase/types";
import { formatDistanceToNow } from "date-fns";

interface CallsListProps {
  calls: Call[];
  selectedCall: Call | null;
  onSelectCall: (call: Call) => void;
  loading: boolean;
  onRefresh: () => void;
}

export function CallsList({
  calls,
  selectedCall,
  onSelectCall,
  loading,
  onRefresh,
}: CallsListProps) {
  const [searchTerm, setSearchTerm] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  const filteredCalls = calls.filter(
    (call) =>
      call.contact_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      call.contact_phone?.includes(searchTerm) ||
      call.external_agent_name?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  async function handleRefresh() {
    setRefreshing(true);
    await onRefresh();
    setRefreshing(false);
  }

  function getScoreColor(score: number | null) {
    if (score === null) return "text-gray-400";
    if (score >= 80) return "text-green-600";
    if (score >= 60) return "text-yellow-600";
    return "text-red-600";
  }

  function getScoreBgColor(score: number | null) {
    if (score === null) return "bg-gray-100";
    if (score >= 80) return "bg-green-50 border border-green-200";
    if (score >= 60) return "bg-yellow-50 border border-yellow-200";
    return "bg-red-50 border border-red-200";
  }

  if (loading) {
    return (
      <div className="p-4 space-y-3">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 bg-gray-100 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="sticky top-0 bg-white border-b border-gray-200 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-black">
            Recent Calls ({filteredCalls.length})
          </h2>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="p-1 hover:bg-gray-100 rounded transition"
            title="Refresh"
          >
            <RotateCw
              className={`h-4 w-4 text-gray-600 ${refreshing ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search calls..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-1 focus:ring-gray-400"
          />
        </div>
      </div>

      {/* Calls List */}
      <div className="flex-1 overflow-auto">
        {filteredCalls.length === 0 ? (
          <div className="p-4 text-center text-gray-500 text-sm">
            No calls found
          </div>
        ) : (
          <div className="space-y-2 p-2">
            {filteredCalls.map((call) => (
              <button
                key={call.id}
                onClick={() => onSelectCall(call)}
                className={`w-full text-left p-3 rounded-lg border-2 transition ${
                  selectedCall?.id === call.id
                    ? "border-black bg-gray-50"
                    : "border-transparent hover:border-gray-200 bg-white"
                }`}
              >
                {/* Client & Agent */}
                <div className="flex items-start justify-between gap-2 mb-1">
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-sm text-black truncate">
                      {call.contact_name || "Unknown Client"}
                    </p>
                    <p className="text-xs text-gray-600">
                      {call.external_agent_name || "—"}
                    </p>
                  </div>
                  {call.qa_score !== null && (
                    <div
                      className={`flex-shrink-0 w-10 h-10 flex items-center justify-center rounded-full font-bold text-sm ${getScoreBgColor(call.qa_score)}`}
                    >
                      <span className={getScoreColor(call.qa_score)}>
                        {Math.round(call.qa_score)}
                      </span>
                    </div>
                  )}
                </div>

                {/* Phone & Date */}
                <div className="flex items-center justify-between text-xs text-gray-500 mb-2">
                  <span className="truncate">{call.contact_phone || "—"}</span>
                  <span className="flex-shrink-0">
                    {call.created_at
                      ? formatDistanceToNow(new Date(call.created_at), {
                          addSuffix: true,
                        })
                      : "—"}
                  </span>
                </div>

                {/* Duration & Status */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-gray-600">
                    {call.duration_seconds
                      ? `${Math.floor(call.duration_seconds / 60)}:${String(call.duration_seconds % 60).padStart(2, "0")}`
                      : "—"}
                  </span>
                  {call.analysis_status && (
                    <span
                      className={`text-xs px-2 py-1 rounded ${
                        call.analysis_status === "analyzed"
                          ? "bg-green-100 text-green-700"
                          : call.analysis_status === "processing"
                            ? "bg-yellow-100 text-yellow-700"
                            : "bg-gray-100 text-gray-700"
                      }`}
                    >
                      {call.analysis_status === "analyzed"
                        ? "Analyzed"
                        : call.analysis_status === "processing"
                          ? "Processing"
                          : "Pending"}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
