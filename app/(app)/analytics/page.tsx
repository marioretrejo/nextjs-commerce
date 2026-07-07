"use client";

import { useState, useEffect, useCallback } from "react";
import type { Call, Agent } from "@/lib/supabase/types";
import { Phone, Clock, TrendingUp, Target, DollarSign } from "lucide-react";
import Link from "next/link";
import {
  format,
  subDays,
  startOfDay,
  eachDayOfInterval,
  eachWeekOfInterval,
  endOfWeek,
} from "date-fns";
import {
  type DateRange,
  type AgentRow,
  type DailyBar,
  type WeeklyLine,
  formatDuration,
} from "./_components/types";
import { MetricCards, type MetricCard } from "./_components/MetricCards";
import { CallsCharts } from "./_components/CallsCharts";
import { SentimentBreakdown } from "./_components/SentimentBreakdown";
import { AgentComparison } from "./_components/AgentComparison";

export default function AnalyticsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [agentFilter, setAgentFilter] = useState<string>("all");
  const [workspaceId, setWorkspaceId] = useState("");

  useEffect(() => {
    fetch("/api/admin/workspace-id")
      .then((r) => r.json())
      .then((d: { workspace_id: string }) =>
        setWorkspaceId(d.workspace_id ?? ""),
      )
      .catch(() => setLoading(false));
  }, []);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
    const since = subDays(new Date(), days).toISOString();
    const callParams = new URLSearchParams({
      workspace_id: workspaceId,
      since,
      limit: "1000",
    });
    if (agentFilter !== "all") callParams.set("agent_id", agentFilter);

    const [callsRes, agentsRes] = await Promise.all([
      fetch(`/api/calls?${callParams.toString()}`),
      fetch(`/api/agents?workspace_id=${workspaceId}`),
    ]);

    if (callsRes.ok) {
      // /api/calls returns { data: Call[], total, page, limit }
      const d = (await callsRes.json()) as { data: Call[] };
      setCalls(d.data ?? []);
    }
    if (agentsRes.ok) {
      // /api/agents returns Agent[] directly
      const d = (await agentsRes.json()) as Agent[];
      setAgents(Array.isArray(d) ? d : []);
    }
    setLoading(false);
  }, [dateRange, agentFilter, workspaceId]);

  useEffect(() => {
    if (workspaceId) fetchData();
  }, [fetchData, workspaceId]);

  // Metrics
  const totalCalls = calls.length;
  const avgDuration =
    totalCalls > 0
      ? calls.reduce((s, c) => s + c.duration_seconds, 0) / totalCalls
      : 0;
  const contacted = calls.filter((c) => c.duration_seconds > 0).length;
  const contactRate = totalCalls > 0 ? (contacted / totalCalls) * 100 : 0;
  const converted = calls.filter((c) => c.outcome === "converted").length;
  const conversionRate = totalCalls > 0 ? (converted / totalCalls) * 100 : 0;

  // Sentiment breakdown
  const analyzedCalls = calls.filter((c) => c.sentiment != null);
  const sentimentCounts = {
    positive: analyzedCalls.filter((c) => c.sentiment === "positive").length,
    neutral: analyzedCalls.filter((c) => c.sentiment === "neutral").length,
    negative: analyzedCalls.filter((c) => c.sentiment === "negative").length,
  };
  const sentimentTotal = analyzedCalls.length;

  // Bar chart: calls per day
  const days = dateRange === "7d" ? 7 : dateRange === "30d" ? 30 : 90;
  const dayInterval = eachDayOfInterval({
    start: subDays(new Date(), days - 1),
    end: new Date(),
  });
  const dailyData: DailyBar[] = dayInterval.map((day) => {
    const key = format(day, "yyyy-MM-dd");
    const count = calls.filter((c) => c.created_at.startsWith(key)).length;
    return { date: format(day, days <= 7 ? "EEE" : "MMM d"), calls: count };
  });

  // Line chart: conversion rate per week
  const weekStarts = eachWeekOfInterval(
    { start: subDays(new Date(), days - 1), end: new Date() },
    { weekStartsOn: 1 },
  );
  const weeklyData: WeeklyLine[] = weekStarts.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekCalls = calls.filter((c) => {
      const d = new Date(c.created_at);
      return d >= startOfDay(weekStart) && d <= weekEnd;
    });
    const rate =
      weekCalls.length > 0
        ? (weekCalls.filter((c) => c.outcome === "converted").length /
            weekCalls.length) *
          100
        : 0;
    return {
      week: format(weekStart, "MMM d"),
      rate: Math.round(rate * 10) / 10,
    };
  });

  // Agent comparison
  const agentRows: AgentRow[] = agents
    .map((agent) => {
      const agentCalls = calls.filter((c) => c.agent_id === agent.id);
      const agentConverted = agentCalls.filter(
        (c) => c.outcome === "converted",
      ).length;
      const qaScores = agentCalls
        .filter((c) => c.qa_score != null)
        .map((c) => c.qa_score as number);
      const avgQA =
        qaScores.length > 0
          ? qaScores.reduce((s, v) => s + v, 0) / qaScores.length
          : 0;
      return {
        id: agent.id,
        name: agent.name,
        calls: agentCalls.length,
        converted: agentConverted,
        avgQA: Math.round(avgQA),
      };
    })
    .filter((r) => r.calls > 0)
    .sort((a, b) => b.calls - a.calls);

  const metricCards: MetricCard[] = [
    {
      label: "Total Calls",
      value: totalCalls.toLocaleString(),
      icon: <Phone className="w-5 h-5" />,
      sub: `Last ${days} days`,
    },
    {
      label: "Avg Duration",
      value: formatDuration(avgDuration),
      icon: <Clock className="w-5 h-5" />,
      sub: "Per call",
    },
    {
      label: "Contact Rate",
      value: `${contactRate.toFixed(1)}%`,
      icon: <Target className="w-5 h-5" />,
      sub: "Calls > 0s",
    },
    {
      label: "Conversion Rate",
      value: `${conversionRate.toFixed(1)}%`,
      icon: <TrendingUp className="w-5 h-5" />,
      sub: "Converted calls",
    },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">
            Analytics
          </h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">
            Performance metrics and trends for your AI voice agents.
          </p>
          <div className="flex gap-2 mt-2">
            <span className="inline-flex items-center rounded-md border border-[#0a0a0a] bg-[#0a0a0a] text-white px-3 py-1 text-xs font-medium">
              Performance
            </span>
            <Link
              href="/analytics/costs"
              className="inline-flex items-center gap-1 rounded-md border border-[#e0e0e0] px-3 py-1 text-xs font-medium text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors"
            >
              <DollarSign className="h-3 w-3" /> Cost Analytics
            </Link>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <select
            value={agentFilter}
            onChange={(e) => setAgentFilter(e.target.value)}
            className="h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
          >
            <option value="all">All Agents</option>
            {agents.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
          <select
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value as DateRange)}
            className="h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm text-[#0a0a0a] focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
          >
            <option value="7d">Last 7 days</option>
            <option value="30d">Last 30 days</option>
            <option value="90d">Last 90 days</option>
          </select>
        </div>
      </div>

      {/* Metric cards */}
      <MetricCards loading={loading} cards={metricCards} />

      {/* Charts row */}
      <CallsCharts
        loading={loading}
        dailyData={dailyData}
        weeklyData={weeklyData}
      />

      {/* Sentiment breakdown */}
      <SentimentBreakdown
        loading={loading}
        counts={sentimentCounts}
        total={sentimentTotal}
        totalCalls={totalCalls}
      />

      {/* Agent comparison table */}
      <AgentComparison loading={loading} rows={agentRows} />
    </div>
  );
}
