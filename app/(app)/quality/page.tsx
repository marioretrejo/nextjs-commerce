"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import type { Agent, Call, QACriteria } from "@/lib/supabase/types";
import { Zap, Loader2 } from "lucide-react";
import {
  format,
  subDays,
  eachWeekOfInterval,
  endOfWeek,
  startOfDay,
} from "date-fns";
import type { QAWeeklyPoint, AgentQARow } from "./_components/types";
import { THRESHOLD } from "./_components/types";
import { SummaryCards } from "./_components/SummaryCards";
import { QATrendChart } from "./_components/QATrendChart";
import { AgentQATable } from "./_components/AgentQATable";
import { LowScoreCalls } from "./_components/LowScoreCalls";
import { CriteriaBuilder } from "./_components/CriteriaBuilder";
import { CriteriaDialog } from "./_components/CriteriaDialog";

export default function QualityPage() {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [calls, setCalls] = useState<Call[]>([]);
  const [criteria, setCriteria] = useState<Record<string, QACriteria[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedAgent, setSelectedAgent] = useState<string>("all");

  // Criteria dialog state
  const [dialogState, setDialogState] = useState<{
    agentId: string;
    editing: QACriteria | null;
  } | null>(null);

  const [workspaceId, setWorkspaceId] = useState("");
  const [reanalyzing, setReanalyzing] = useState(false);

  useEffect(() => {
    fetch("/api/admin/workspace-id")
      .then((r) =>
        r.ok
          ? (r.json() as Promise<{ workspace_id: string }>)
          : Promise.reject(r.status),
      )
      .then((d) => {
        const id = d.workspace_id ?? "";
        setWorkspaceId(id);
        if (!id) setLoading(false); // no workspace → stop spinner
      })
      .catch(() => setLoading(false));
  }, []);

  const fetchData = useCallback(async () => {
    if (!workspaceId) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const since = subDays(new Date(), 90).toISOString();
      const [agentsRes, callsRes] = await Promise.all([
        fetch(`/api/agents?workspace_id=${workspaceId}`),
        fetch(
          `/api/calls?workspace_id=${workspaceId}&since=${since}&limit=1000`,
        ),
      ]);
      if (agentsRes.ok) {
        const agentList = (await agentsRes.json()) as Agent[];
        setAgents(Array.isArray(agentList) ? agentList : []);

        const criteriaMap: Record<string, QACriteria[]> = {};
        await Promise.all(
          (Array.isArray(agentList) ? agentList : []).map(async (a) => {
            const r = await fetch(`/api/agents/${a.id}/criteria`);
            if (r.ok) {
              const cd = (await r.json()) as QACriteria[];
              criteriaMap[a.id] = Array.isArray(cd) ? cd : [];
            }
          }),
        );
        setCriteria(criteriaMap);
      }
      if (callsRes.ok) {
        const d = (await callsRes.json()) as { data: Call[] };
        setCalls(d.data ?? []);
      }
    } catch {
      toast.error("Error loading QA data");
    }
    setLoading(false);
  }, [workspaceId]);

  useEffect(() => {
    if (workspaceId) fetchData();
  }, [fetchData, workspaceId]);

  // Filtered calls
  const filteredCalls =
    selectedAgent === "all"
      ? calls
      : calls.filter((c) => c.agent_id === selectedAgent);

  const scoredCalls = filteredCalls.filter((c) => c.qa_score != null);
  const avgScore =
    scoredCalls.length > 0
      ? scoredCalls.reduce((s, c) => s + (c.qa_score as number), 0) /
        scoredCalls.length
      : 0;

  const belowThresholdCalls = scoredCalls.filter(
    (c) => (c.qa_score as number) < THRESHOLD,
  );

  // Best agent
  const agentQARows: AgentQARow[] = agents
    .map((agent) => {
      const ac = calls.filter(
        (c) => c.agent_id === agent.id && c.qa_score != null,
      );
      const avg =
        ac.length > 0
          ? ac.reduce((s, c) => s + (c.qa_score as number), 0) / ac.length
          : 0;
      return {
        agent,
        avgScore: Math.round(avg * 10) / 10,
        callCount: ac.length,
        belowThreshold: ac.filter((c) => (c.qa_score as number) < THRESHOLD)
          .length,
      };
    })
    .filter((r) => r.callCount > 0)
    .sort((a, b) => b.avgScore - a.avgScore);

  const bestAgent = agentQARows[0] ?? null;
  const worstCall =
    scoredCalls.length > 0
      ? scoredCalls.reduce((min, c) =>
          (c.qa_score as number) < (min.qa_score as number) ? c : min,
        )
      : null;

  // Weekly QA trend
  const weekStarts = eachWeekOfInterval(
    { start: subDays(new Date(), 89), end: new Date() },
    { weekStartsOn: 1 },
  );
  const weeklyData: QAWeeklyPoint[] = weekStarts.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const wc = scoredCalls.filter((c) => {
      const d = new Date(c.created_at);
      return d >= startOfDay(weekStart) && d <= weekEnd;
    });
    const avg =
      wc.length > 0
        ? wc.reduce((s, c) => s + (c.qa_score as number), 0) / wc.length
        : 0;
    return { week: format(weekStart, "MMM d"), avg: Math.round(avg * 10) / 10 };
  });

  async function deleteCriteria(agentId: string, criteriaId: string) {
    await fetch(`/api/agents/${agentId}/criteria?criteria_id=${criteriaId}`, {
      method: "DELETE",
    });
    await fetchData();
  }

  async function reanalyzeCalls() {
    setReanalyzing(true);
    try {
      const res = await fetch("/api/jobs/reanalyze-calls", { method: "POST" });
      const d = (await res.json()) as {
        queued?: number;
        message?: string;
        error?: string;
      };
      if (!res.ok) {
        toast.error(d.error ?? "Re-análisis fallido.");
        return;
      }
      if ((d.queued ?? 0) === 0) {
        toast.info(d.message ?? "No hay llamadas elegibles para re-análisis.");
        return;
      }
      toast.success(
        d.message ??
          `Re-análisis iniciado para ${d.queued} llamada(s). Resultados en ~30s.`,
      );
      setTimeout(() => fetchData(), 35000);
    } catch {
      toast.error("Error de red al iniciar el re-análisis.");
    } finally {
      setReanalyzing(false);
    }
  }

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">
            Quality Assurance
          </h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            Monitor agent performance and manage QA scoring criteria.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={reanalyzeCalls}
            disabled={reanalyzing || loading}
            title="Re-score existing calls using current QA criteria"
          >
            {reanalyzing ? (
              <>
                <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />{" "}
                Analizando…
              </>
            ) : (
              <>
                <Zap className="w-3.5 h-3.5 mr-1.5" /> Re-analizar llamadas
              </>
            )}
          </Button>
          <select
            value={selectedAgent}
            onChange={(e) => setSelectedAgent(e.target.value)}
            className="h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
          >
            <option value="all">All Agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Summary cards */}
      <SummaryCards
        loading={loading}
        avgScore={avgScore}
        scoredCount={scoredCalls.length}
        bestAgent={bestAgent}
        worstCall={worstCall}
        belowThresholdCount={belowThresholdCalls.length}
      />

      {/* Trend chart + agent table */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <QATrendChart loading={loading} weeklyData={weeklyData} />
        <AgentQATable loading={loading} agentQARows={agentQARows} />
      </div>

      {/* Low-score calls */}
      {belowThresholdCalls.length > 0 && (
        <LowScoreCalls calls={belowThresholdCalls} />
      )}

      {/* QA Criteria builder per agent */}
      <CriteriaBuilder
        loading={loading}
        agents={agents}
        criteria={criteria}
        onAdd={(agentId) => setDialogState({ agentId, editing: null })}
        onEdit={(agentId, c) => setDialogState({ agentId, editing: c })}
        onDelete={(agentId, criteriaId) =>
          void deleteCriteria(agentId, criteriaId)
        }
      />

      {/* Criteria dialog */}
      <CriteriaDialog
        open={dialogState !== null}
        onOpenChange={(open) => {
          if (!open) setDialogState(null);
        }}
        agentId={dialogState?.agentId ?? ""}
        editing={dialogState?.editing ?? null}
        onSaved={fetchData}
      />
    </div>
  );
}
