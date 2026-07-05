"use client";

import {
  CheckCircle2,
  Plus,
  ShieldAlert,
  TrendingDown,
  ShieldCheck,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { QACInteraction, QACStats, ViolationsStats } from "./types";
import { ScoreGauge, RiskBar, SEV, CAT_COLOR } from "./scoring";

interface Props {
  interactions: QACInteraction[];
  stats: QACStats | null;
  violationsStats: ViolationsStats | null;
  setActiveTab: (v: string) => void;
}

export function DashboardTab({
  interactions,
  stats,
  violationsStats,
  setActiveTab,
}: Props) {
  const s = stats;
  const criticalFlags = s?.flagsBySeverity.critical ?? 0;
  const highFlags = s?.flagsBySeverity.high ?? 0;
  return (
    <>
      {/* KPI row */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Overall Score gauge — Sedric-style */}
        <Card className="flex flex-col items-center py-5">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-[#b0b0b0] mb-2">
            Avg QA Score
          </p>
          <ScoreGauge score={s?.avgOverallScore ?? 0} />
          <p className="text-[10px] text-[#c0c0c0] mt-1">
            across {s?.analyzedInteractions ?? 0} analyzed calls
          </p>
        </Card>

        {/* Secondary metrics 2×2 */}
        <div className="md:col-span-2 grid grid-cols-2 gap-4">
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-3xl font-bold text-[#111]">
                {s?.analyzedInteractions ?? 0}
              </p>
              <p className="text-xs font-medium text-[#555] mt-1">
                Calls Analyzed
              </p>
              <p className="text-[10px] text-[#9b9b9b]">
                of {s?.totalInteractions ?? 0} total
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p
                className={`text-3xl font-bold ${
                  (s?.complianceRate ?? 0) >= 80
                    ? "text-green-600"
                    : (s?.complianceRate ?? 0) >= 60
                      ? "text-yellow-600"
                      : "text-red-600"
                }`}
              >
                {s?.complianceRate !== null && s?.complianceRate !== undefined
                  ? `${s.complianceRate}%`
                  : "—"}
              </p>
              <p className="text-xs font-medium text-[#555] mt-1">
                Compliance Rate
              </p>
              <p className="text-[10px] text-[#9b9b9b]">
                interactions with risk &lt; 30
              </p>
            </CardContent>
          </Card>
          <Card
            className={criticalFlags + highFlags > 0 ? "border-red-200" : ""}
          >
            <CardContent className="pt-5 pb-4">
              <p
                className={`text-3xl font-bold ${criticalFlags + highFlags > 0 ? "text-red-600" : "text-[#111]"}`}
              >
                {criticalFlags + highFlags}
              </p>
              <p className="text-xs font-medium text-[#555] mt-1">
                High-Risk Flags
              </p>
              <p className="text-[10px] text-[#9b9b9b]">
                critical + high severity
              </p>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="pt-5 pb-4">
              <p className="text-3xl font-bold text-[#111]">
                {s?.pendingInteractions ?? 0}
              </p>
              <p className="text-xs font-medium text-[#555] mt-1">
                Pending Analysis
              </p>
              <p className="text-[10px] text-[#9b9b9b]">awaiting QA review</p>
            </CardContent>
          </Card>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Flags by severity */}
        {s && s.totalFlags > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Flags by Severity</CardTitle>
              <CardDescription>
                {s.totalFlags} total flags across all interactions
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-3">
              {(["critical", "high", "medium", "low"] as const).map((sev) => {
                const count = s?.flagsBySeverity[sev] ?? 0;
                const total = s?.totalFlags ?? 0;
                const pct = total > 0 ? Math.round((count / total) * 100) : 0;
                const cfg = SEV[sev]!;
                return (
                  <div key={sev} className="flex items-center gap-3">
                    <span
                      className={`capitalize text-xs font-semibold w-14 ${cfg.text}`}
                    >
                      {sev}
                    </span>
                    <div className="flex-1 h-2 bg-[#f0f0f0] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${cfg.dot}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-xs font-bold text-[#555] w-6 text-right">
                      {count}
                    </span>
                  </div>
                );
              })}
            </CardContent>
          </Card>
        )}

        {/* Top risk agents */}
        {s && s.topRiskAgents.length > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Top Risk Agents</CardTitle>
              <CardDescription>
                Agents with highest average risk score
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {s.topRiskAgents.map((agent, i) => (
                <div key={agent.name} className="flex items-center gap-3">
                  <span className="text-xs font-bold text-[#c0c0c0] w-4">
                    {i + 1}
                  </span>
                  <span className="text-sm font-medium text-[#111] flex-1 truncate">
                    {agent.name}
                  </span>
                  <span className="text-[10px] text-[#9b9b9b]">
                    {agent.interactions} call
                    {agent.interactions !== 1 ? "s" : ""}
                  </span>
                  <div className="w-20">
                    <RiskBar score={agent.avg_risk} />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Flags by category */}
        {s && s.totalFlags > 0 && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Flags by Category</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(s.flagsByCategory)
                  .filter(([, v]) => v > 0)
                  .map(([cat, count]) => (
                    <div
                      key={cat}
                      className={`rounded-lg px-3 py-2 flex items-center justify-between ${CAT_COLOR[cat] ?? "bg-gray-100 text-gray-600"}`}
                    >
                      <span className="text-xs font-medium capitalize">
                        {cat}
                      </span>
                      <span className="text-sm font-bold">{count}</span>
                    </div>
                  ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Violations this week */}
      {violationsStats !== null && (
        <Card className="border-[#efefef]">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-[#6b6b6b]" />
              Violaciones esta semana
            </CardTitle>
            <CardDescription>
              Reglas de compliance violadas en los últimos 7 días
            </CardDescription>
          </CardHeader>
          <CardContent>
            {violationsStats.total === 0 ? (
              <div className="flex items-center gap-2 text-sm text-[#555] bg-[#fafafa] rounded-xl p-3 border border-[#efefef]">
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                Sin violaciones de compliance esta semana.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Summary pills */}
                <div className="flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 rounded-full border border-[#e0e0e0] bg-[#f8f8f8] px-3 py-1.5">
                    <span className="text-sm font-bold text-[#111]">
                      {violationsStats.total}
                    </span>
                    <span className="text-xs text-[#6b6b6b]">total</span>
                  </div>
                  {violationsStats.critical > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full border border-transparent bg-[#111] px-3 py-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-white" />
                      <span className="text-sm font-bold text-white">
                        {violationsStats.critical}
                      </span>
                      <span className="text-xs text-white/80">críticas</span>
                    </div>
                  )}
                  {violationsStats.warning > 0 && (
                    <div className="flex items-center gap-1.5 rounded-full border border-[#e0e0e0] bg-[#f0f0f0] px-3 py-1.5">
                      <span className="h-1.5 w-1.5 rounded-full bg-[#9b9b9b]" />
                      <span className="text-sm font-bold text-[#555]">
                        {violationsStats.warning}
                      </span>
                      <span className="text-xs text-[#555]">warnings</span>
                    </div>
                  )}
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* Top rules */}
                  {violationsStats.topRules.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-[#9b9b9b] uppercase tracking-widest mb-2">
                        Reglas más violadas
                      </p>
                      <div className="space-y-1.5">
                        {violationsStats.topRules.map((r, i) => (
                          <div
                            key={r.rule_name}
                            className="flex items-center gap-2"
                          >
                            <span className="text-[10px] font-bold text-[#c0c0c0] w-4 shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-xs text-[#333] flex-1 truncate">
                              {r.rule_name}
                            </span>
                            <span className="text-xs font-semibold text-[#555] shrink-0">
                              {r.count}×
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Top agents */}
                  {violationsStats.topAgents.length > 0 && (
                    <div>
                      <p className="text-[10px] font-bold text-[#9b9b9b] uppercase tracking-widest mb-2">
                        Agentes con más violaciones
                      </p>
                      <div className="space-y-1.5">
                        {violationsStats.topAgents.map((a, i) => (
                          <div
                            key={a.agent_name}
                            className="flex items-center gap-2"
                          >
                            <span className="text-[10px] font-bold text-[#c0c0c0] w-4 shrink-0">
                              {i + 1}
                            </span>
                            <span className="text-xs text-[#333] flex-1 truncate">
                              {a.agent_name}
                            </span>
                            <span className="text-xs font-semibold text-[#111] shrink-0">
                              {a.count} violac.
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Before/After comparison (Sedric-style insight) */}
      {s && s.totalInteractions === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-12 text-center space-y-3">
            <ShieldAlert className="h-10 w-10 text-[#e0e0e0] mx-auto" />
            <p className="font-semibold text-[#555]">
              Zero interactions analyzed yet
            </p>
            <p className="text-sm text-[#9b9b9b] max-w-sm mx-auto">
              Traditional QA reviews only 1–5% of calls. Upload your first
              interaction and get 100% AI-powered coverage.
            </p>
            <Button size="sm" onClick={() => setActiveTab("new")}>
              <Plus className="h-3.5 w-3.5 mr-1.5" /> Upload First Interaction
            </Button>
          </CardContent>
        </Card>
      )}

      {s && s.pendingInteractions > 0 && (
        <Card className="border-yellow-200 bg-yellow-50">
          <CardContent className="py-3 flex items-center gap-3">
            <TrendingDown className="h-4 w-4 text-yellow-600 shrink-0" />
            <p className="text-sm text-yellow-800">
              <span className="font-semibold">
                {s.pendingInteractions} interaction
                {s.pendingInteractions !== 1 ? "s" : ""}
              </span>{" "}
              pending analysis — go to{" "}
              <button
                className="underline font-medium"
                onClick={() => setActiveTab("interactions")}
              >
                Interactions
              </button>{" "}
              to run them.
            </p>
          </CardContent>
        </Card>
      )}
    </>
  );
}
