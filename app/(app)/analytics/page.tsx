'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import type { Call, Agent } from '@/lib/supabase/types';
import { Phone, Clock, TrendingUp, Target, Bot, DollarSign, Smile, Meh, Frown } from 'lucide-react';
import Link from 'next/link';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  LineChart,
  Line,
} from 'recharts';
import { format, subDays, startOfDay, eachDayOfInterval, eachWeekOfInterval, startOfWeek, endOfWeek } from 'date-fns';

type DateRange = '7d' | '30d' | '90d';

interface AgentRow {
  id: string;
  name: string;
  calls: number;
  converted: number;
  avgQA: number;
}

interface DailyBar {
  date: string;
  calls: number;
}

interface WeeklyLine {
  week: string;
  rate: number;
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

export default function AnalyticsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [agentFilter, setAgentFilter] = useState<string>('all');
  const [workspaceId, setWorkspaceId] = useState('');

  useEffect(() => {
    fetch('/api/admin/workspace-id')
      .then((r) => r.json())
      .then((d: { workspace_id: string }) => setWorkspaceId(d.workspace_id ?? ''))
      .catch(() => setLoading(false));
  }, []);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const since = subDays(new Date(), days).toISOString();
    const callParams = new URLSearchParams({ workspace_id: workspaceId, since, limit: '1000' });
    if (agentFilter !== 'all') callParams.set('agent_id', agentFilter);

    const [callsRes, agentsRes] = await Promise.all([
      fetch(`/api/calls?${callParams.toString()}`),
      fetch(`/api/agents?workspace_id=${workspaceId}`),
    ]);

    if (callsRes.ok) {
      // /api/calls returns { data: Call[], total, page, limit }
      const d = await callsRes.json() as { data: Call[] };
      setCalls(d.data ?? []);
    }
    if (agentsRes.ok) {
      // /api/agents returns Agent[] directly
      const d = await agentsRes.json() as Agent[];
      setAgents(Array.isArray(d) ? d : []);
    }
    setLoading(false);
  }, [dateRange, agentFilter, workspaceId]);

  useEffect(() => { if (workspaceId) fetchData(); }, [fetchData, workspaceId]);

  // Metrics
  const totalCalls = calls.length;
  const avgDuration = totalCalls > 0
    ? calls.reduce((s, c) => s + c.duration_seconds, 0) / totalCalls
    : 0;
  const contacted = calls.filter(c => c.duration_seconds > 0).length;
  const contactRate = totalCalls > 0 ? (contacted / totalCalls) * 100 : 0;
  const converted = calls.filter(c => c.outcome === 'converted').length;
  const conversionRate = totalCalls > 0 ? (converted / totalCalls) * 100 : 0;

  // Sentiment breakdown
  const analyzedCalls = calls.filter(c => c.sentiment != null);
  const sentimentCounts = {
    positive: analyzedCalls.filter(c => c.sentiment === 'positive').length,
    neutral:  analyzedCalls.filter(c => c.sentiment === 'neutral').length,
    negative: analyzedCalls.filter(c => c.sentiment === 'negative').length,
  };
  const sentimentTotal = analyzedCalls.length;

  // Bar chart: calls per day
  const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
  const dayInterval = eachDayOfInterval({ start: subDays(new Date(), days - 1), end: new Date() });
  const dailyData: DailyBar[] = dayInterval.map((day) => {
    const key = format(day, 'yyyy-MM-dd');
    const count = calls.filter(c => c.created_at.startsWith(key)).length;
    return { date: format(day, days <= 7 ? 'EEE' : 'MMM d'), calls: count };
  });

  // Line chart: conversion rate per week
  const weekStarts = eachWeekOfInterval(
    { start: subDays(new Date(), days - 1), end: new Date() },
    { weekStartsOn: 1 }
  );
  const weeklyData: WeeklyLine[] = weekStarts.map((weekStart) => {
    const weekEnd = endOfWeek(weekStart, { weekStartsOn: 1 });
    const weekCalls = calls.filter(c => {
      const d = new Date(c.created_at);
      return d >= startOfDay(weekStart) && d <= weekEnd;
    });
    const rate = weekCalls.length > 0
      ? (weekCalls.filter(c => c.outcome === 'converted').length / weekCalls.length) * 100
      : 0;
    return { week: format(weekStart, 'MMM d'), rate: Math.round(rate * 10) / 10 };
  });

  // Agent comparison
  const agentRows: AgentRow[] = agents.map((agent) => {
    const agentCalls = calls.filter(c => c.agent_id === agent.id);
    const agentConverted = agentCalls.filter(c => c.outcome === 'converted').length;
    const qaScores = agentCalls.filter(c => c.qa_score != null).map(c => c.qa_score as number);
    const avgQA = qaScores.length > 0 ? qaScores.reduce((s, v) => s + v, 0) / qaScores.length : 0;
    return {
      id: agent.id,
      name: agent.name,
      calls: agentCalls.length,
      converted: agentConverted,
      avgQA: Math.round(avgQA),
    };
  }).filter(r => r.calls > 0).sort((a, b) => b.calls - a.calls);

  const metricCards = [
    { label: 'Total Calls',       value: totalCalls.toLocaleString(),           icon: <Phone className="w-5 h-5" />,     sub: `Last ${days} days` },
    { label: 'Avg Duration',      value: formatDuration(avgDuration),            icon: <Clock className="w-5 h-5" />,     sub: 'Per call' },
    { label: 'Contact Rate',      value: `${contactRate.toFixed(1)}%`,           icon: <Target className="w-5 h-5" />,    sub: 'Calls > 0s' },
    { label: 'Conversion Rate',   value: `${conversionRate.toFixed(1)}%`,        icon: <TrendingUp className="w-5 h-5" />, sub: 'Converted calls' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Analytics</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">Performance metrics and trends for your AI voice agents.</p>
          <div className="flex gap-2 mt-2">
            <span className="inline-flex items-center rounded-md border border-[#0a0a0a] bg-[#0a0a0a] text-white px-3 py-1 text-xs font-medium">Performance</span>
            <Link href="/analytics/costs" className="inline-flex items-center gap-1 rounded-md border border-[#e0e0e0] px-3 py-1 text-xs font-medium text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors">
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
            {agents.map(a => (
              <option key={a.id} value={a.id}>{a.name}</option>
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
      <div className="grid grid-cols-4 gap-4 mb-6">
        {metricCards.map((m) => (
          <Card key={m.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-[#6b6b6b]">{m.label}</p>
                <span className="text-[#6b6b6b]">{m.icon}</span>
              </div>
              {loading ? (
                <div className="h-8 w-20 bg-[#f5f5f5] rounded animate-pulse" />
              ) : (
                <p className="text-3xl font-bold text-[#0a0a0a]">{m.value}</p>
              )}
              <p className="text-xs text-[#6b6b6b] mt-1">{m.sub}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        {/* Bar chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Calls per Day</CardTitle>
            <CardDescription>Total calls made each day</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-52 bg-[#f5f5f5] rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b6b6b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b6b6b' }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12 }}
                  />
                  <Bar dataKey="calls" fill="#0a0a0a" radius={[3, 3, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        {/* Line chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Conversion Rate per Week</CardTitle>
            <CardDescription>Weekly conversion trend (%)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="h-52 bg-[#f5f5f5] rounded animate-pulse" />
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={weeklyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="week" tick={{ fontSize: 11, fill: '#6b6b6b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b6b6b' }} unit="%" />
                  <Tooltip
                    contentStyle={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12 }}
                    formatter={(v: number) => [`${v}%`, 'Rate']}
                  />
                  <Line
                    type="monotone"
                    dataKey="rate"
                    stroke="#0a0a0a"
                    strokeWidth={2}
                    dot={{ fill: '#0a0a0a', r: 3 }}
                    activeDot={{ r: 5 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Sentiment breakdown */}
      <Card className="mb-6">
        <CardHeader className="pb-2">
          <CardTitle className="text-base">Sentiment Breakdown</CardTitle>
          <CardDescription>AI-analyzed call sentiment from post-call intelligence</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-20 bg-[#f5f5f5] rounded animate-pulse" />
          ) : sentimentTotal === 0 ? (
            <p className="text-sm text-[#6b6b6b] py-4 text-center">No analyzed calls yet — sentiment is extracted automatically after each call.</p>
          ) : (
            <div className="space-y-3">
              {[
                { key: 'positive' as const, label: 'Positive', icon: <Smile className="w-4 h-4 text-green-600" />, color: 'bg-green-500' },
                { key: 'neutral'  as const, label: 'Neutral',  icon: <Meh  className="w-4 h-4 text-yellow-600" />, color: 'bg-yellow-400' },
                { key: 'negative' as const, label: 'Negative', icon: <Frown className="w-4 h-4 text-red-500" />,  color: 'bg-red-500' },
              ].map(({ key, label, icon, color }) => {
                const count = sentimentCounts[key];
                const pct   = sentimentTotal > 0 ? Math.round((count / sentimentTotal) * 100) : 0;
                return (
                  <div key={key} className="flex items-center gap-3">
                    {icon}
                    <span className="w-16 text-sm text-[#6b6b6b]">{label}</span>
                    <div className="flex-1 h-2 rounded-full bg-[#f5f5f5] overflow-hidden">
                      <div className={`h-full rounded-full ${color} transition-all`} style={{ width: `${pct}%` }} />
                    </div>
                    <span className="w-16 text-right text-sm font-medium text-[#0a0a0a]">{count.toLocaleString()} ({pct}%)</span>
                  </div>
                );
              })}
              <p className="text-xs text-[#6b6b6b] pt-1">{sentimentTotal.toLocaleString()} of {totalCalls.toLocaleString()} calls analyzed</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Agent comparison table */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Bot className="w-4 h-4" />
            Agent Comparison
          </CardTitle>
          <CardDescription>Performance breakdown by agent</CardDescription>
        </CardHeader>
        <CardContent className="p-0">
          {loading ? (
            <div className="p-5 space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 bg-[#f5f5f5] rounded animate-pulse" />
              ))}
            </div>
          ) : agentRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#6b6b6b]">
              No data available for the selected period.
            </div>
          ) : (
            <>
              <div className="grid grid-cols-4 gap-3 px-5 py-3 border-b border-[#e0e0e0] text-xs font-medium text-[#6b6b6b] uppercase tracking-wide">
                <span>Agent</span>
                <span className="text-right">Calls</span>
                <span className="text-right">Conversion</span>
                <span className="text-right">Avg QA</span>
              </div>
              <div className="divide-y divide-[#e0e0e0]">
                {agentRows.map((row) => {
                  const rate = row.calls > 0 ? ((row.converted / row.calls) * 100).toFixed(1) : '0.0';
                  return (
                    <div
                      key={row.id}
                      className="grid grid-cols-4 gap-3 px-5 py-3 text-sm items-center hover:bg-[#f5f5f5]"
                    >
                      <span className="font-medium text-[#0a0a0a]">{row.name}</span>
                      <span className="text-right text-[#6b6b6b]">{row.calls.toLocaleString()}</span>
                      <span className="text-right text-[#0a0a0a] font-medium">{rate}%</span>
                      <span className="text-right text-[#6b6b6b]">
                        {row.avgQA > 0 ? `${row.avgQA}%` : '—'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
