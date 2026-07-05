"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Activity,
  BookOpen,
  Globe,
  Plus,
  Settings2,
  TrendingUp,
  Users2,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { CompliancePanel } from "../compliance/CompliancePanel";
import type {
  QACInteraction,
  QACStats,
  ViolationsStats,
  AgentStat,
} from "./_components/types";
import { QACRulesManager } from "./_components/QACRulesManager";
import { QACIntegrationsPanel } from "./_components/QACIntegrationsPanel";
import { QACDocsPanel } from "./_components/QACDocsPanel";
import { DashboardTab } from "./_components/DashboardTab";
import { InteractionsTab } from "./_components/InteractionsTab";
import { SubmitInteractionTab } from "./_components/SubmitInteractionTab";
import { MonitoringTab } from "./_components/MonitoringTab";
import { QACHeader } from "./_components/QACHeader";

export default function QACenterPage() {
  const [interactions, setInteractions] = useState<QACInteraction[]>([]);
  const [stats, setStats] = useState<QACStats | null>(null);
  const [violationsStats, setViolationsStats] =
    useState<ViolationsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [analyzing, setAnalyzing] = useState<string | null>(null);

  // Upload form
  const [agentName, setAgentName] = useState("");
  const [agentId, setAgentId] = useState("");
  const [channel, setChannel] = useState("call");
  const [transcript, setTranscript] = useState("");
  const [durationMin, setDurationMin] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const [activeTab, setActiveTab] = useState("dashboard");
  const [interactionView, setInteractionView] = useState<
    "all" | "flagged" | "review"
  >("all");

  // ── Filter / Segmenter state ───────────────────────────────────────────────
  const [filterAgent, setFilterAgent] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterRange, setFilterRange] = useState(""); // 'today'|'week'|'month'|''
  const [filterRisk, setFilterRisk] = useState("");
  const [totalCount, setTotalCount] = useState(0);

  const buildInteractionsUrl = useCallback(
    (agent: string, status: string, range: string, risk: string) => {
      const p = new URLSearchParams({ limit: "100" });
      if (agent) p.set("agent", agent);
      if (status) p.set("status", status);
      if (risk) p.set("risk_level", risk);
      if (range) {
        const now = new Date();
        if (range === "today") {
          const start = new Date(now);
          start.setHours(0, 0, 0, 0);
          p.set("date_from", start.toISOString());
        } else if (range === "week") {
          const start = new Date(now);
          start.setDate(now.getDate() - 7);
          p.set("date_from", start.toISOString());
        } else if (range === "month") {
          const start = new Date(now);
          start.setDate(now.getDate() - 30);
          p.set("date_from", start.toISOString());
        }
      }
      return `/api/qac/interactions?${p.toString()}`;
    },
    [],
  );

  const fetchAll = useCallback(
    async (
      agent = filterAgent,
      status = filterStatus,
      range = filterRange,
      risk = filterRisk,
    ) => {
      const url = buildInteractionsUrl(agent, status, range, risk);
      const [intRes, statsRes, vStatsRes] = await Promise.all([
        fetch(url),
        fetch("/api/qac/stats"),
        fetch("/api/qac/violations/stats"),
      ]);
      if (intRes.ok) {
        const d = (await intRes.json()) as {
          interactions: QACInteraction[];
          total: number;
        };
        setInteractions(d.interactions ?? []);
        setTotalCount(d.total ?? 0);
      }
      if (statsRes.ok) setStats((await statsRes.json()) as QACStats);
      if (vStatsRes.ok)
        setViolationsStats((await vStatsRes.json()) as ViolationsStats);
      setLoading(false);
    },
    [filterAgent, filterStatus, filterRange, filterRisk, buildInteractionsUrl],
  );

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  const displayedInteractions = useMemo(() => {
    if (interactionView === "flagged") {
      return interactions.filter((i) => {
        const flags = i.qac_evaluations?.[0]?.qac_flags ?? [];
        return flags.some(
          (f) => f.severity === "critical" || f.severity === "high",
        );
      });
    }
    if (interactionView === "review")
      return interactions.filter(
        (i) => i.status === "pending" || i.status === "failed",
      );
    return interactions;
  }, [interactions, interactionView]);

  const agentStats: AgentStat[] = useMemo(() => {
    const map = new Map<
      string,
      {
        name: string;
        count: number;
        scoreSum: number;
        scored: number;
        flagged: number;
        passed: number;
      }
    >();
    for (const i of interactions) {
      if (!map.has(i.agent_name))
        map.set(i.agent_name, {
          name: i.agent_name,
          count: 0,
          scoreSum: 0,
          scored: 0,
          flagged: 0,
          passed: 0,
        });
      const a = map.get(i.agent_name)!;
      a.count++;
      const ev = i.qac_evaluations?.[0];
      if (ev) {
        a.scoreSum += Number(ev.overall_score);
        a.scored++;
        if (Number(ev.overall_score) >= 70) a.passed++;
        if (
          ev.qac_flags?.some(
            (f) => f.severity === "critical" || f.severity === "high",
          )
        )
          a.flagged++;
      }
    }
    return Array.from(map.values())
      .map((a) => ({
        ...a,
        avgScore: a.scored > 0 ? Math.round(a.scoreSum / a.scored) : null,
        passRate: a.scored > 0 ? Math.round((a.passed / a.scored) * 100) : null,
      }))
      .sort((a, b) => (a.avgScore ?? 999) - (b.avgScore ?? 999));
  }, [interactions]);

  async function handleAnalyze(id: string) {
    setAnalyzing(id);
    setInteractions((prev) =>
      prev.map((i) => (i.id === id ? { ...i, status: "analyzing" } : i)),
    );
    try {
      const res = await fetch(`/api/qac/interactions/${id}/analyze`, {
        method: "POST",
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      toast.success("Analysis complete");
      await fetchAll();
    } catch (e) {
      toast.error(`Analysis failed: ${String(e)}`);
      setInteractions((prev) =>
        prev.map((i) => (i.id === id ? { ...i, status: "failed" } : i)),
      );
    } finally {
      setAnalyzing(null);
    }
  }

  async function handleSubmit() {
    if (!agentName.trim()) {
      toast.error("Agent name is required");
      return;
    }
    if (transcript.trim().length < 20) {
      toast.error("Transcript too short (min 20 chars)");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/qac/interactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          agent_name: agentName.trim(),
          agent_id: agentId.trim() || undefined,
          channel,
          transcript: transcript.trim(),
          duration_s: durationMin
            ? Math.round(Number(durationMin) * 60)
            : undefined,
        }),
      });
      if (!res.ok)
        throw new Error(((await res.json()) as { error: string }).error);
      const newInt = (await res.json()) as QACInteraction;
      toast.success("Interaction uploaded — starting analysis…");
      setAgentName("");
      setAgentId("");
      setTranscript("");
      setDurationMin("");
      setChannel("call");
      setInteractions((prev) => [{ ...newInt, qac_evaluations: [] }, ...prev]);
      setActiveTab("interactions");
      await handleAnalyze(newInt.id);
    } catch (e) {
      toast.error(String(e));
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="p-6">
        <div className="h-9 w-40 bg-[#f5f5f5] rounded-lg animate-pulse mb-6" />
        <div className="grid grid-cols-4 gap-4 mb-6">
          {[...Array(4)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-[#f5f5f5] rounded-xl animate-pulse"
            />
          ))}
        </div>
        <div className="h-80 bg-[#f5f5f5] rounded-xl animate-pulse" />
      </div>
    );
  }

  const s = stats;
  const criticalFlags = s?.flagsBySeverity.critical ?? 0;
  const highFlags = s?.flagsBySeverity.high ?? 0;

  return (
    <div className="p-6 mx-auto max-w-6xl space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <QACHeader highRiskFlags={s ? criticalFlags + highFlags : 0} />

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="h-9 w-full justify-start overflow-x-auto flex-nowrap scrollbar-none">
          <TabsTrigger value="dashboard" className="text-xs gap-1.5">
            <TrendingUp className="h-3.5 w-3.5" />
            Dashboard
          </TabsTrigger>
          <TabsTrigger value="interactions" className="text-xs gap-1.5">
            <Activity className="h-3.5 w-3.5" />
            Interactions
            {interactions.length > 0 && (
              <span className="ml-1 rounded-full bg-[#111] text-white text-[9px] px-1.5 py-px leading-none">
                {interactions.length}
              </span>
            )}
          </TabsTrigger>
          <TabsTrigger value="new" className="text-xs gap-1.5">
            <Plus className="h-3.5 w-3.5" />
            New Evaluation
          </TabsTrigger>
          <TabsTrigger value="rules" className="text-xs gap-1.5">
            <Settings2 className="h-3.5 w-3.5" />
            QA Rules
          </TabsTrigger>
          <TabsTrigger value="compliance" className="text-xs gap-1.5">
            <ShieldCheck className="h-3.5 w-3.5" />
            Compliance
          </TabsTrigger>
          <TabsTrigger value="monitoring" className="text-xs gap-1.5">
            <Users2 className="h-3.5 w-3.5" />
            Monitoring
          </TabsTrigger>
          <TabsTrigger value="integrations" className="text-xs gap-1.5">
            <Globe className="h-3.5 w-3.5" />
            Integrations
          </TabsTrigger>
          <TabsTrigger value="docs" className="text-xs gap-1.5">
            <BookOpen className="h-3.5 w-3.5" />
            Docs
          </TabsTrigger>
        </TabsList>

        {/* ── DASHBOARD ──────────────────────────────────────────────── */}
        <TabsContent value="dashboard" className="space-y-4 pt-4">
          <DashboardTab
            interactions={interactions}
            stats={stats}
            violationsStats={violationsStats}
            setActiveTab={setActiveTab}
          />
        </TabsContent>

        {/* ── INTERACTIONS ───────────────────────────────────────────── */}
        <TabsContent value="interactions" className="pt-4 space-y-3">
          <InteractionsTab
            interactions={interactions}
            displayedInteractions={displayedInteractions}
            interactionView={interactionView}
            setInteractionView={setInteractionView}
            filterAgent={filterAgent}
            setFilterAgent={setFilterAgent}
            filterStatus={filterStatus}
            setFilterStatus={setFilterStatus}
            filterRange={filterRange}
            setFilterRange={setFilterRange}
            filterRisk={filterRisk}
            setFilterRisk={setFilterRisk}
            totalCount={totalCount}
            analyzing={analyzing}
            handleAnalyze={handleAnalyze}
            setActiveTab={setActiveTab}
            fetchAll={fetchAll}
          />
        </TabsContent>

        {/* ── NEW EVALUATION ─────────────────────────────────────────── */}
        <TabsContent value="new" className="pt-4">
          <SubmitInteractionTab
            agentName={agentName}
            setAgentName={setAgentName}
            agentId={agentId}
            setAgentId={setAgentId}
            channel={channel}
            setChannel={setChannel}
            transcript={transcript}
            setTranscript={setTranscript}
            durationMin={durationMin}
            setDurationMin={setDurationMin}
            submitting={submitting}
            handleSubmit={handleSubmit}
          />
        </TabsContent>

        {/* ── QA RULES ───────────────────────────────────────────────── */}
        <TabsContent value="rules" className="pt-4">
          <QACRulesManager />
        </TabsContent>

        {/* ── COMPLIANCE RULES ───────────────────────────────────────── */}
        <TabsContent value="compliance" className="pt-4">
          <CompliancePanel />
        </TabsContent>

        {/* ── AGENT MONITORING ───────────────────────────────────────── */}
        <TabsContent value="monitoring" className="pt-4 space-y-4">
          <MonitoringTab interactions={interactions} agentStats={agentStats} />
        </TabsContent>

        {/* ── INTEGRATIONS ───────────────────────────────────────────── */}
        <TabsContent value="integrations" className="pt-4">
          <QACIntegrationsPanel />
        </TabsContent>

        {/* ── DEVELOPER DOCS ─────────────────────────────────────────── */}
        <TabsContent value="docs" className="pt-4">
          <QACDocsPanel />
        </TabsContent>
      </Tabs>
    </div>
  );
}
