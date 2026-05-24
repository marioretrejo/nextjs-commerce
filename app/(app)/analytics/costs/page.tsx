'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { Call, Agent } from '@/lib/supabase/types';
import { DollarSign, TrendingUp, Phone, Target, BarChart2 } from 'lucide-react';
import Link from 'next/link';
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { format, subDays, eachDayOfInterval } from 'date-fns';

type DateRange = '7d' | '30d' | '90d';

export default function CostAnalyticsPage() {
  const [calls, setCalls] = useState<Call[]>([]);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [workspaceId, setWorkspaceId] = useState('');
  const [revenuePerConversion, setRevenuePerConversion] = useState('100');

  useEffect(() => {
    fetch('/api/admin/workspace-id')
      .then(r => r.json())
      .then((d: { workspace_id: string }) => setWorkspaceId(d.workspace_id ?? ''));
  }, []);

  const fetchData = useCallback(async () => {
    if (!workspaceId) return;
    setLoading(true);
    const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;
    const since = subDays(new Date(), days).toISOString();

    const [callsRes, agentsRes] = await Promise.all([
      fetch(`/api/calls?workspace_id=${workspaceId}&since=${since}&limit=1000`),
      fetch(`/api/agents?workspace_id=${workspaceId}`),
    ]);

    if (callsRes.ok) {
      const d = await callsRes.json() as { data: Call[] };
      setCalls(d.data ?? []);
    }
    if (agentsRes.ok) {
      const d = await agentsRes.json() as Agent[];
      setAgents(Array.isArray(d) ? d : []);
    }
    setLoading(false);
  }, [dateRange, workspaceId]);

  useEffect(() => { if (workspaceId) fetchData(); }, [fetchData, workspaceId]);

  const days = dateRange === '7d' ? 7 : dateRange === '30d' ? 30 : 90;

  const totalCost = calls.reduce((s, c) => s + (c.cost_usd ?? 0), 0);
  const avgCostPerCall = calls.length > 0 ? totalCost / calls.length : 0;
  const converted = calls.filter(c => c.outcome === 'converted').length;
  const costPerConversion = converted > 0 ? totalCost / converted : 0;

  const daysRemaining = new Date(new Date().getFullYear(), new Date().getMonth() + 1, 0).getDate() - new Date().getDate();
  const dailyAvg = days > 0 ? totalCost / days : 0;
  const monthlyProjection = totalCost + dailyAvg * daysRemaining;

  const revenue = Number(revenuePerConversion) * converted;
  const roi = totalCost > 0 ? ((revenue - totalCost) / totalCost) * 100 : 0;

  // Daily cost area chart
  const dayInterval = eachDayOfInterval({ start: subDays(new Date(), days - 1), end: new Date() });
  const dailyData = dayInterval.map(day => {
    const key = format(day, 'yyyy-MM-dd');
    const cost = calls.filter(c => c.created_at.startsWith(key)).reduce((s, c) => s + (c.cost_usd ?? 0), 0);
    return { date: format(day, days <= 7 ? 'EEE' : 'MMM d'), cost: Math.round(cost * 100) / 100 };
  });

  // Cost by agent
  const agentCosts = agents.map(agent => {
    const agentCalls = calls.filter(c => c.agent_id === agent.id);
    const cost = agentCalls.reduce((s, c) => s + (c.cost_usd ?? 0), 0);
    return { name: agent.name, cost: Math.round(cost * 100) / 100 };
  }).filter(a => a.cost > 0).sort((a, b) => b.cost - a.cost);

  // Cost by campaign (pie)
  const campaignCosts: Record<string, number> = {};
  calls.forEach(c => {
    const key = c.campaign_id ?? 'Direct';
    campaignCosts[key] = (campaignCosts[key] ?? 0) + (c.cost_usd ?? 0);
  });
  const pieData = Object.entries(campaignCosts)
    .map(([id, cost]) => ({ name: id.length > 12 ? id.slice(0, 12) + '…' : id, value: Math.round(cost * 100) / 100 }))
    .sort((a, b) => b.value - a.value)
    .slice(0, 6);

  const PIE_COLORS = ['#0a0a0a', '#3a3a3a', '#6b6b6b', '#9b9b9b', '#c0c0c0', '#e0e0e0'];

  const kpiCards = [
    { label: 'Total Spend', value: `$${totalCost.toFixed(2)}`, icon: <DollarSign className="w-5 h-5" />, sub: `Last ${days} days` },
    { label: 'Avg Cost / Call', value: `$${avgCostPerCall.toFixed(3)}`, icon: <Phone className="w-5 h-5" />, sub: 'Per completed call' },
    { label: 'Cost / Conversion', value: costPerConversion > 0 ? `$${costPerConversion.toFixed(2)}` : '—', icon: <Target className="w-5 h-5" />, sub: `${converted} conversions` },
    { label: 'Monthly Projection', value: `$${monthlyProjection.toFixed(2)}`, icon: <TrendingUp className="w-5 h-5" />, sub: 'Based on daily avg' },
  ];

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#0a0a0a]">Cost Analytics</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">ROI visibility and spend analysis for your AI voice agents.</p>
          <div className="flex gap-2 mt-2">
            <Link href="/analytics" className="inline-flex items-center gap-1 rounded-md border border-[#e0e0e0] px-3 py-1 text-xs font-medium text-[#6b6b6b] hover:border-[#0a0a0a] hover:text-[#0a0a0a] transition-colors">
              <BarChart2 className="h-3 w-3" /> Performance
            </Link>
            <span className="inline-flex items-center rounded-md border border-[#0a0a0a] bg-[#0a0a0a] text-white px-3 py-1 text-xs font-medium">Cost Analytics</span>
          </div>
        </div>
        <select
          value={dateRange}
          onChange={(e) => setDateRange(e.target.value as DateRange)}
          className="h-9 rounded-md border border-[#e0e0e0] bg-white px-3 text-sm focus:outline-none focus:ring-1 focus:ring-[#0a0a0a]"
        >
          <option value="7d">Last 7 days</option>
          <option value="30d">Last 30 days</option>
          <option value="90d">Last 90 days</option>
        </select>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-4 gap-4 mb-6">
        {kpiCards.map(m => (
          <Card key={m.label}>
            <CardContent className="p-5">
              <div className="flex items-start justify-between mb-3">
                <p className="text-sm text-[#6b6b6b]">{m.label}</p>
                <span className="text-[#6b6b6b]">{m.icon}</span>
              </div>
              {loading ? (
                <div className="h-8 w-24 bg-[#f5f5f5] rounded animate-pulse" />
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
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Daily Spend</CardTitle>
            <CardDescription>Cost trend over time (USD)</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <div className="h-52 bg-[#f5f5f5] rounded animate-pulse" /> : (
              <ResponsiveContainer width="100%" height={220}>
                <AreaChart data={dailyData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis dataKey="date" tick={{ fontSize: 11, fill: '#6b6b6b' }} />
                  <YAxis tick={{ fontSize: 11, fill: '#6b6b6b' }} tickFormatter={v => `$${v}`} />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(3)}`, 'Spend']} contentStyle={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12 }} />
                  <Area type="monotone" dataKey="cost" stroke="#0a0a0a" fill="#f5f5f5" strokeWidth={2} />
                </AreaChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cost by Agent</CardTitle>
            <CardDescription>Total spend per agent</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <div className="h-52 bg-[#f5f5f5] rounded animate-pulse" /> : agentCosts.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-[#6b6b6b]">No data</div>
            ) : (
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={agentCosts} layout="vertical" margin={{ top: 4, right: 8, left: 60, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e0e0e0" />
                  <XAxis type="number" tick={{ fontSize: 11, fill: '#6b6b6b' }} tickFormatter={v => `$${v}`} />
                  <YAxis dataKey="name" type="category" tick={{ fontSize: 11, fill: '#6b6b6b' }} width={55} />
                  <Tooltip formatter={(v: number) => [`$${v.toFixed(3)}`, 'Spend']} contentStyle={{ background: '#fff', border: '1px solid #e0e0e0', borderRadius: 6, fontSize: 12 }} />
                  <Bar dataKey="cost" fill="#0a0a0a" radius={[0, 3, 3, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Pie chart */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">Cost by Campaign</CardTitle>
            <CardDescription>Spend distribution across campaigns</CardDescription>
          </CardHeader>
          <CardContent>
            {loading ? <div className="h-52 bg-[#f5f5f5] rounded animate-pulse" /> : pieData.length === 0 ? (
              <div className="h-52 flex items-center justify-center text-sm text-[#6b6b6b]">No data</div>
            ) : (
              <div className="flex items-center gap-4">
                <ResponsiveContainer width="50%" height={200}>
                  <PieChart>
                    <Pie data={pieData} dataKey="value" cx="50%" cy="50%" innerRadius={50} outerRadius={80}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => [`$${v.toFixed(3)}`, 'Spend']} />
                  </PieChart>
                </ResponsiveContainer>
                <div className="flex-1 space-y-1">
                  {pieData.map((item, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      <span className="w-3 h-3 rounded-sm shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span className="truncate text-[#6b6b6b]">{item.name}</span>
                      <span className="ml-auto font-medium">${item.value.toFixed(2)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ROI Calculator */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base">ROI Calculator</CardTitle>
            <CardDescription>Estimate return on your AI calling investment</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label>Revenue per Conversion ($)</Label>
              <Input
                type="number"
                min="0"
                value={revenuePerConversion}
                onChange={e => setRevenuePerConversion(e.target.value)}
                className="max-w-xs"
              />
            </div>
            <div className="rounded-lg bg-[#f5f5f5] p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-[#6b6b6b]">Conversions</span>
                <span className="font-medium">{converted}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6b6b6b]">Total Revenue</span>
                <span className="font-medium">${revenue.toFixed(2)}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-[#6b6b6b]">Total Cost</span>
                <span className="font-medium">${totalCost.toFixed(2)}</span>
              </div>
              <div className="border-t border-[#e0e0e0] pt-2 flex justify-between">
                <span className="text-sm font-semibold">ROI</span>
                <span className={`text-sm font-bold ${roi >= 0 ? 'text-green-600' : 'text-red-500'}`}>
                  {roi >= 0 ? '+' : ''}{roi.toFixed(1)}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
