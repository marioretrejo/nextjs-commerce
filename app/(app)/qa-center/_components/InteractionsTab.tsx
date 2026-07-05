"use client";

import type { Dispatch, SetStateAction } from "react";
import { Activity, Loader2, PlayCircle, Plus, Search, X } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { QACInteraction } from "./types";
import { InteractionRow } from "./InteractionRow";

interface Props {
  interactions: QACInteraction[];
  displayedInteractions: QACInteraction[];
  interactionView: "all" | "flagged" | "review";
  setInteractionView: Dispatch<SetStateAction<"all" | "flagged" | "review">>;
  filterAgent: string;
  setFilterAgent: Dispatch<SetStateAction<string>>;
  filterStatus: string;
  setFilterStatus: Dispatch<SetStateAction<string>>;
  filterRange: string;
  setFilterRange: Dispatch<SetStateAction<string>>;
  filterRisk: string;
  setFilterRisk: Dispatch<SetStateAction<string>>;
  totalCount: number;
  analyzing: string | null;
  handleAnalyze: (id: string) => void;
  setActiveTab: (v: string) => void;
  fetchAll: (
    agent?: string,
    status?: string,
    range?: string,
    risk?: string,
  ) => void;
}

export function InteractionsTab({
  interactions,
  displayedInteractions,
  interactionView,
  setInteractionView,
  filterAgent,
  setFilterAgent,
  filterStatus,
  setFilterStatus,
  filterRange,
  setFilterRange,
  filterRisk,
  setFilterRisk,
  totalCount,
  analyzing,
  handleAnalyze,
  setActiveTab,
  fetchAll,
}: Props) {
  return (
    <>
      {/* Sedric-style view tabs */}
      <div className="flex items-center gap-0 border-b border-[#e0e0e0] -mb-1">
        {(
          [
            ["all", "All", interactions.length],
            [
              "flagged",
              "Flagged",
              interactions.filter((i) =>
                i.qac_evaluations?.[0]?.qac_flags?.some(
                  (f) => f.severity === "critical" || f.severity === "high",
                ),
              ).length,
            ],
            [
              "review",
              "To review",
              interactions.filter(
                (i) => i.status === "pending" || i.status === "failed",
              ).length,
            ],
          ] as [string, string, number][]
        ).map(([val, label, count]) => (
          <button
            key={val}
            onClick={() =>
              setInteractionView(val as "all" | "flagged" | "review")
            }
            className={`relative flex items-center gap-1.5 px-4 py-2 text-sm font-medium transition-colors ${
              interactionView === val
                ? "text-[#111] after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-[#111] after:rounded-t"
                : "text-[#9b9b9b] hover:text-[#555]"
            }`}
          >
            {label}
            {count > 0 && (
              <span
                className={`rounded-full px-1.5 py-px text-[10px] font-semibold ${
                  interactionView === val
                    ? "bg-[#111] text-white"
                    : "bg-[#f0f0f0] text-[#6b6b6b]"
                }`}
              >
                {count}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Filter bar */}
      <div className="flex flex-wrap items-center gap-2">
        {/* Agent search */}
        <div className="relative flex-1 min-w-[160px] max-w-[220px]">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-[#9b9b9b] pointer-events-none" />
          <input
            className="w-full h-8 rounded-lg border border-[#e0e0e0] bg-white pl-8 pr-3 text-xs placeholder:text-[#b0b0b0] focus:outline-none focus:ring-1 focus:ring-[#111]"
            placeholder="Filter by agent…"
            value={filterAgent}
            onChange={(e) => {
              setFilterAgent(e.target.value);
              void fetchAll(
                e.target.value,
                filterStatus,
                filterRange,
                filterRisk,
              );
            }}
          />
        </div>

        {/* Status */}
        <select
          className="h-8 rounded-lg border border-[#e0e0e0] bg-white px-2.5 text-xs text-[#555] focus:outline-none focus:ring-1 focus:ring-[#111]"
          value={filterStatus}
          onChange={(e) => {
            setFilterStatus(e.target.value);
            void fetchAll(filterAgent, e.target.value, filterRange, filterRisk);
          }}
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="analyzed">Analyzed</option>
          <option value="analyzing">Analyzing</option>
          <option value="failed">Failed</option>
        </select>

        {/* Date range */}
        <div className="flex items-center rounded-lg border border-[#e0e0e0] bg-white p-0.5 gap-px">
          {(
            [
              ["", "All"],
              ["today", "Today"],
              ["week", "7d"],
              ["month", "30d"],
            ] as [string, string][]
          ).map(([val, label]) => (
            <button
              key={val}
              onClick={() => {
                setFilterRange(val);
                void fetchAll(filterAgent, filterStatus, val, filterRisk);
              }}
              className={`px-2 py-1 text-[10px] font-medium rounded-md transition-colors ${
                filterRange === val
                  ? "bg-[#111] text-white"
                  : "text-[#6b6b6b] hover:text-[#111] hover:bg-[#f5f5f5]"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Risk level */}
        <select
          className="h-8 rounded-lg border border-[#e0e0e0] bg-white px-2.5 text-xs text-[#555] focus:outline-none focus:ring-1 focus:ring-[#111]"
          value={filterRisk}
          onChange={(e) => {
            setFilterRisk(e.target.value);
            void fetchAll(
              filterAgent,
              filterStatus,
              filterRange,
              e.target.value,
            );
          }}
        >
          <option value="">All risk levels</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>

        {/* Clear filters */}
        {(filterAgent || filterStatus || filterRange || filterRisk) && (
          <button
            className="flex items-center gap-1 text-[10px] font-medium text-[#9b9b9b] hover:text-[#111] transition-colors"
            onClick={() => {
              setFilterAgent("");
              setFilterStatus("");
              setFilterRange("");
              setFilterRisk("");
              void fetchAll("", "", "", "");
            }}
          >
            <X className="h-3 w-3" /> Clear
          </button>
        )}

        <div className="ml-auto flex items-center gap-2">
          <span className="text-xs text-[#9b9b9b]">
            {displayedInteractions.length}
            {totalCount > interactions.length ? ` of ${totalCount}` : ""}{" "}
            interaction{displayedInteractions.length !== 1 ? "s" : ""}
            {" · "}
            {
              displayedInteractions.filter((i) => i.status === "analyzed")
                .length
            }{" "}
            analyzed
          </span>
          {displayedInteractions.some(
            (i) => i.status === "pending" || i.status === "failed",
          ) && (
            <Button
              size="sm"
              variant="outline"
              disabled={!!analyzing}
              onClick={async () => {
                const pending = displayedInteractions.filter(
                  (i) => i.status === "pending" || i.status === "failed",
                );
                for (const p of pending) await handleAnalyze(p.id);
              }}
            >
              {analyzing ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin mr-1.5" />
              ) : (
                <PlayCircle className="h-3.5 w-3.5 mr-1.5" />
              )}
              Analyze All Pending
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardContent className="p-0 mt-0">
          {displayedInteractions.length === 0 ? (
            <div className="py-16 text-center">
              <Activity className="h-8 w-8 text-[#e0e0e0] mx-auto mb-3" />
              {filterAgent ||
              filterStatus ||
              filterRange ||
              filterRisk ||
              interactionView !== "all" ? (
                <>
                  <p className="text-sm text-[#555] font-medium">
                    No interactions match the current filters
                  </p>
                  <p className="text-xs text-[#9b9b9b] mt-1 mb-4">
                    Try adjusting or clearing the filters above.
                  </p>
                </>
              ) : (
                <>
                  <p className="text-sm text-[#555] font-medium">
                    No interactions uploaded
                  </p>
                  <p className="text-xs text-[#9b9b9b] mt-1 mb-4">
                    Upload a call center transcript to start 100% QA coverage.
                  </p>
                  <Button size="sm" onClick={() => setActiveTab("new")}>
                    <Plus className="h-4 w-4 mr-1.5" /> New Evaluation
                  </Button>
                </>
              )}
            </div>
          ) : (
            <div>
              {/* Table header */}
              <div className="hidden md:flex items-center gap-3 px-5 py-2 border-b border-[#f0f0f0] text-[10px] font-semibold text-[#9b9b9b] uppercase tracking-wider">
                <span className="w-4" />
                <span className="w-4" />
                <span className="w-36">Agent</span>
                <span className="w-28">Date</span>
                <span className="w-10">Score</span>
                <span className="flex-1">Failed Criteria</span>
                <span className="w-12">Flags</span>
                <span className="w-16" />
              </div>
              {displayedInteractions.map((interaction) => (
                <InteractionRow
                  key={interaction.id}
                  interaction={interaction}
                  onAnalyze={handleAnalyze}
                  analyzing={analyzing}
                />
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
