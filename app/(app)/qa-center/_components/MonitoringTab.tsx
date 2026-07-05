"use client";

import Link from "next/link";
import { Users2 } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import type { QACInteraction, AgentStat } from "./types";

interface Props {
  interactions: QACInteraction[];
  agentStats: AgentStat[];
}

export function MonitoringTab({ interactions, agentStats }: Props) {
  return (
    <>
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-[#111]">
            Agent Monitoring Dashboard
          </h3>
          <p className="text-xs text-[#6b6b6b] mt-0.5">
            Performance breakdown per agent — sorted by lowest score first
          </p>
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[#9b9b9b]">
            {agentStats.length} agent{agentStats.length !== 1 ? "s" : ""}
          </span>
          <Link
            href="/qa-center/agents"
            className="inline-flex items-center gap-1 text-xs font-medium text-[#555] hover:text-[#111] transition-colors"
          >
            View all →
          </Link>
        </div>
      </div>
      <Card>
        <CardContent className="p-0">
          {agentStats.length === 0 ? (
            <div className="py-16 text-center">
              <Users2 className="h-8 w-8 text-[#e0e0e0] mx-auto mb-3" />
              <p className="text-sm text-[#555] font-medium">
                No agent data yet
              </p>
              <p className="text-xs text-[#9b9b9b] mt-1">
                Analyze interactions first to see agent-level metrics.
              </p>
            </div>
          ) : (
            <div>
              <div className="hidden md:grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 px-5 py-2.5 border-b border-[#f0f0f0] text-[10px] font-semibold text-[#9b9b9b] uppercase tracking-wider">
                <span>Agent</span>
                <span className="text-right">Interactions</span>
                <span className="text-right">Avg Score</span>
                <span className="text-right">Pass Rate</span>
                <span className="text-right">Flagged</span>
                <span className="text-right">Score Bar</span>
              </div>
              <div className="divide-y divide-[#f5f5f5]">
                {agentStats.map((agent, idx) => (
                  <div
                    key={agent.name}
                    className="grid grid-cols-[2fr_1fr_1fr_1fr_1fr_1fr] gap-3 items-center px-5 py-3 hover:bg-[#fafafa] transition-colors"
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span className="text-[10px] font-bold text-[#c0c0c0] w-4 shrink-0">
                        {idx + 1}
                      </span>
                      <div className="h-7 w-7 rounded-full bg-[#f0f0f0] flex items-center justify-center shrink-0">
                        <span className="text-[10px] font-bold text-[#555]">
                          {agent.name.slice(0, 2).toUpperCase()}
                        </span>
                      </div>
                      <span className="text-sm font-semibold text-[#111] truncate">
                        {agent.name}
                      </span>
                    </div>
                    <span className="text-sm text-[#555] text-right">
                      {agent.count}
                    </span>
                    <span
                      className={`text-sm font-bold text-right ${
                        agent.avgScore === null
                          ? "text-[#c0c0c0]"
                          : agent.avgScore >= 80
                            ? "text-green-600"
                            : agent.avgScore >= 60
                              ? "text-yellow-600"
                              : "text-red-600"
                      }`}
                    >
                      {agent.avgScore !== null ? `${agent.avgScore}%` : "—"}
                    </span>
                    <span
                      className={`text-sm text-right ${
                        agent.passRate === null
                          ? "text-[#c0c0c0]"
                          : agent.passRate >= 80
                            ? "text-green-600"
                            : agent.passRate >= 60
                              ? "text-yellow-600"
                              : "text-red-600"
                      }`}
                    >
                      {agent.passRate !== null ? `${agent.passRate}%` : "—"}
                    </span>
                    <span
                      className={`text-sm text-right ${agent.flagged > 0 ? "text-red-600 font-semibold" : "text-[#9b9b9b]"}`}
                    >
                      {agent.flagged > 0 ? `⚑ ${agent.flagged}` : "—"}
                    </span>
                    <div className="flex items-center gap-1.5">
                      <div className="flex-1 h-1.5 bg-[#f0f0f0] rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            (agent.avgScore ?? 0) >= 80
                              ? "bg-green-500"
                              : (agent.avgScore ?? 0) >= 60
                                ? "bg-yellow-500"
                                : "bg-red-500"
                          }`}
                          style={{ width: `${agent.avgScore ?? 0}%` }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </>
  );
}
