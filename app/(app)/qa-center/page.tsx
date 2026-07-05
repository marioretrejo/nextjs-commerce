"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from "next/link";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Activity,
  AlertTriangle,
  BookOpen,
  CheckCircle2,
  Globe,
  Loader2,
  MessageSquare,
  PlayCircle,
  Plus,
  Search,
  Settings2,
  Shield,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Trophy,
  Users,
  Users2,
  X,
  ShieldCheck,
} from "lucide-react";
import { toast } from "sonner";
import { CompliancePanel } from "../compliance/CompliancePanel";
import type {
  QACInteraction,
  QACStats,
  ViolationsStats,
} from "./_components/types";
import { SEV, CAT_COLOR, ScoreGauge, RiskBar } from "./_components/scoring";
import { InteractionRow } from "./_components/InteractionRow";
import { QACRulesManager } from "./_components/QACRulesManager";
import { QACIntegrationsPanel } from "./_components/QACIntegrationsPanel";
import { QACDocsPanel } from "./_components/QACDocsPanel";

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

  const agentStats = useMemo(() => {
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
      <div className="flex items-start gap-4">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#111] shrink-0">
          <ShieldAlert className="h-5 w-5 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-[#111]">
            QA Center
          </h1>
          <p className="text-sm text-[#6b6b6b]">
            100% QA coverage for call center interactions — AI-powered scoring,
            compliance flags, and agent coaching
          </p>
        </div>
        {s && criticalFlags + highFlags > 0 && (
          <div className="flex items-center gap-2 rounded-xl bg-red-50 border border-red-100 px-3 py-2 shrink-0">
            <AlertTriangle className="h-4 w-4 text-red-600" />
            <span className="text-sm font-semibold text-red-700">
              {criticalFlags + highFlags} high-risk flag
              {criticalFlags + highFlags !== 1 ? "s" : ""}
            </span>
          </div>
        )}
        <Link
          href="/qa-center/customers"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#555] hover:border-[#111] hover:text-[#111] transition-colors shrink-0"
        >
          <Users className="h-3.5 w-3.5" />
          Customers
        </Link>
        <Link
          href="/qa-center/agents"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#555] hover:border-[#111] hover:text-[#111] transition-colors shrink-0"
        >
          <Users2 className="h-3.5 w-3.5" />
          Agents
        </Link>
        <Link
          href="/qa-center/coaching"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#555] hover:border-[#111] hover:text-[#111] transition-colors shrink-0"
        >
          <MessageSquare className="h-3.5 w-3.5" />
          Coaching
        </Link>
        <Link
          href="/qa-center/leaderboard"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#555] hover:border-[#111] hover:text-[#111] transition-colors shrink-0"
        >
          <Trophy className="h-3.5 w-3.5" />
          Leaderboard
        </Link>
        <Link
          href="/qa-center/audit"
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#e0e0e0] px-3 py-1.5 text-xs font-medium text-[#555] hover:border-[#111] hover:text-[#111] transition-colors shrink-0"
        >
          <Shield className="h-3.5 w-3.5" />
          Audit Log
        </Link>
      </div>

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
                    {s?.complianceRate !== null &&
                    s?.complianceRate !== undefined
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
                className={
                  criticalFlags + highFlags > 0 ? "border-red-200" : ""
                }
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
                  <p className="text-[10px] text-[#9b9b9b]">
                    awaiting QA review
                  </p>
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
                  {(["critical", "high", "medium", "low"] as const).map(
                    (sev) => {
                      const count = s?.flagsBySeverity[sev] ?? 0;
                      const total = s?.totalFlags ?? 0;
                      const pct =
                        total > 0 ? Math.round((count / total) * 100) : 0;
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
                    },
                  )}
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
                          <span className="text-xs text-white/80">
                            críticas
                          </span>
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
                  <Plus className="h-3.5 w-3.5 mr-1.5" /> Upload First
                  Interaction
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
        </TabsContent>

        {/* ── INTERACTIONS ───────────────────────────────────────────── */}
        <TabsContent value="interactions" className="pt-4 space-y-3">
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
                void fetchAll(
                  filterAgent,
                  e.target.value,
                  filterRange,
                  filterRisk,
                );
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
                {totalCount > interactions.length
                  ? ` of ${totalCount}`
                  : ""}{" "}
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
                        Upload a call center transcript to start 100% QA
                        coverage.
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
        </TabsContent>

        {/* ── NEW EVALUATION ─────────────────────────────────────────── */}
        <TabsContent value="new" className="pt-4">
          <Card>
            <CardHeader>
              <CardTitle>New Interaction Evaluation</CardTitle>
              <CardDescription>
                Paste the transcript of a human agent interaction. The AI
                auditor will score it across 5 dimensions, flag violations with
                regulation references, and generate coaching notes.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>
                    Agent Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. Maria González"
                    value={agentName}
                    onChange={(e) => setAgentName(e.target.value)}
                  />
                  <p className="text-xs text-[#9b9b9b]">
                    Name of the human call center agent
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Agent ID{" "}
                    <span className="text-[#9b9b9b] font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    placeholder="e.g. EMP-0042"
                    value={agentId}
                    onChange={(e) => setAgentId(e.target.value)}
                  />
                  <p className="text-xs text-[#9b9b9b]">
                    Internal HR or CRM identifier
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label>Channel</Label>
                  <Select value={channel} onValueChange={setChannel}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="call">Phone Call</SelectItem>
                      <SelectItem value="chat">Live Chat</SelectItem>
                      <SelectItem value="email">Email</SelectItem>
                      <SelectItem value="sms">SMS</SelectItem>
                      <SelectItem value="social">Social Media</SelectItem>
                      <SelectItem value="other">Other</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>
                    Duration (minutes){" "}
                    <span className="text-[#9b9b9b] font-normal">
                      (optional)
                    </span>
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    placeholder="e.g. 8"
                    value={durationMin}
                    onChange={(e) => setDurationMin(e.target.value)}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label>
                  Transcript <span className="text-red-500">*</span>
                </Label>
                <Textarea
                  rows={16}
                  placeholder={`Agent: Thank you for calling collections, this is Maria. May I speak with John Smith?\nCustomer: This is John.\nAgent: Hi John, I'm calling regarding your account ending in 4521 with ABC Collections...\n...`}
                  value={transcript}
                  onChange={(e) => setTranscript(e.target.value)}
                  className="font-mono text-xs resize-none"
                />
                <p className="text-xs text-[#9b9b9b]">
                  {transcript.length} chars — the AI processes up to 8,000
                  characters
                </p>
              </div>

              <div className="flex items-start gap-3 rounded-xl bg-[#f8f8f8] border border-[#efefef] p-3.5">
                <ShieldAlert className="h-4 w-4 text-[#9b9b9b] shrink-0 mt-0.5" />
                <div>
                  <p className="text-xs text-[#555] font-medium mb-0.5">
                    AI auditor uses your active QA Rules
                  </p>
                  <p className="text-xs text-[#9b9b9b]">
                    Configure rules in the QA Rules tab to customize what gets
                    flagged — required disclosures, prohibited phrases, quality
                    criteria, regulation references (FDCPA, TCPA, GDPR…).
                  </p>
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <Button
                  onClick={handleSubmit}
                  disabled={
                    submitting ||
                    !agentName.trim() ||
                    transcript.trim().length < 20
                  }
                  className="gap-2"
                >
                  {submitting ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Uploading &amp; Analyzing…
                    </>
                  ) : (
                    <>
                      <PlayCircle className="h-4 w-4" />
                      Upload &amp; Analyze
                    </>
                  )}
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAgentName("");
                    setAgentId("");
                    setTranscript("");
                    setDurationMin("");
                    setChannel("call");
                  }}
                  disabled={submitting}
                >
                  Clear
                </Button>
              </div>
            </CardContent>
          </Card>
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
