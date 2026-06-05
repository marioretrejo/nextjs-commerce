'use client';

import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Skeleton } from '@/components/ui/skeleton';
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpDown,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Medal,
  ShieldAlert,
  TrendingDown,
  TrendingUp,
  Trophy,
  User,
} from 'lucide-react';

// ─── Types ────────────────────────────────────────────────────────────────────

interface AgentLeaderboardEntry {
  name: string;
  interactions: number;
  avg_overall: number;
  avg_risk: number;
  avg_compliance: number;
  avg_sales?: number;
  avg_soft_skills?: number;
  compliance_rate: number;
  total_flags: number;
  critical_flags: number;
  high_flags: number;
}

interface DashboardData {
  totalInteractions: number;
  analyzedInteractions: number;
  pendingInteractions: number;
  avgOverallScore: number | null;
  avgRiskScore: number | null;
  complianceRate: number | null;
  totalFlags: number;
  flagsBySeverity: { low: number; medium: number; high: number; critical: number };
  flagsByCategory: Record<string, number>;
  topRiskAgents: { name: string; interactions: number; avg_risk: number }[];
  agentLeaderboard?: AgentLeaderboardEntry[];
}

type SortKey = 'name' | 'interactions' | 'avg_overall' | 'avg_risk' | 'compliance_rate' | 'avg_sales' | 'avg_soft_skills' | 'avg_compliance';
type SortDir = 'asc' | 'desc';
type DateRange = '7d' | '30d' | '90d';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function scoreColor(score: number): string {
  if (score >= 80) return 'text-green-600';
  if (score >= 60) return 'text-yellow-600';
  if (score >= 40) return 'text-orange-600';
  return 'text-red-600';
}

function scoreBg(score: number): string {
  if (score >= 80) return 'bg-green-50 text-green-700 border-green-100';
  if (score >= 60) return 'bg-yellow-50 text-yellow-800 border-yellow-100';
  if (score >= 40) return 'bg-orange-50 text-orange-800 border-orange-100';
  return 'bg-red-50 text-red-800 border-red-100';
}

function riskBg(score: number): string {
  if (score < 20) return 'bg-green-50 text-green-700 border-green-100';
  if (score < 45) return 'bg-yellow-50 text-yellow-800 border-yellow-100';
  if (score < 70) return 'bg-orange-50 text-orange-800 border-orange-100';
  return 'bg-red-50 text-red-800 border-red-100';
}

function riskLabel(score: number): string {
  if (score < 20) return 'Low';
  if (score < 45) return 'Medium';
  if (score < 70) return 'High';
  return 'Critical';
}

function ScoreCell({ score }: { score: number | undefined }) {
  if (score === undefined || isNaN(score)) {
    return <span className="text-xs text-[#9b9b9b]">—</span>;
  }
  const rounded = Math.round(score);
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-semibold ${scoreBg(rounded)}`}>
      {rounded}
    </span>
  );
}

// ─── Podium Card ──────────────────────────────────────────────────────────────

interface PodiumProps {
  agent: AgentLeaderboardEntry;
  rank: 1 | 2 | 3;
}

function PodiumCard({ agent, rank }: PodiumProps) {
  const configs = {
    1: {
      height: 'h-40',
      podiumH: 'h-16',
      podiumBg: 'bg-gradient-to-b from-yellow-400 to-yellow-500',
      ring: 'ring-4 ring-yellow-400 ring-offset-2',
      bg: 'bg-gradient-to-b from-yellow-50 to-white',
      border: 'border-yellow-200',
      icon: <Trophy className="h-5 w-5 text-yellow-500" />,
      label: '🥇 1st Place',
      textColor: 'text-yellow-700',
      avatarBg: 'bg-yellow-100 text-yellow-800',
    },
    2: {
      height: 'h-36',
      podiumH: 'h-12',
      podiumBg: 'bg-gradient-to-b from-gray-300 to-gray-400',
      ring: 'ring-2 ring-gray-300 ring-offset-2',
      bg: 'bg-gradient-to-b from-gray-50 to-white',
      border: 'border-gray-200',
      icon: <Medal className="h-5 w-5 text-gray-400" />,
      label: '🥈 2nd Place',
      textColor: 'text-gray-600',
      avatarBg: 'bg-gray-100 text-gray-700',
    },
    3: {
      height: 'h-32',
      podiumH: 'h-10',
      podiumBg: 'bg-gradient-to-b from-orange-300 to-orange-400',
      ring: 'ring-2 ring-orange-300 ring-offset-2',
      bg: 'bg-gradient-to-b from-orange-50 to-white',
      border: 'border-orange-200',
      icon: <Medal className="h-5 w-5 text-orange-400" />,
      label: '🥉 3rd Place',
      textColor: 'text-orange-600',
      avatarBg: 'bg-orange-100 text-orange-800',
    },
  };

  const cfg = configs[rank];

  return (
    <Card className={`border ${cfg.border} overflow-hidden ${cfg.bg}`}>
      <CardContent className="pt-5 pb-4 flex flex-col items-center text-center gap-3">
        {/* Avatar */}
        <div className={`h-12 w-12 rounded-full flex items-center justify-center text-lg font-bold ${cfg.avatarBg} ${cfg.ring}`}>
          {agent.name.charAt(0).toUpperCase()}
        </div>

        {/* Name & rank */}
        <div>
          <p className="font-bold text-[#111] text-base leading-tight">{agent.name}</p>
          <p className={`text-xs font-semibold mt-0.5 ${cfg.textColor}`}>{cfg.label}</p>
        </div>

        {/* Score */}
        <div className="flex flex-col items-center gap-0.5">
          <span className={`text-3xl font-black ${scoreColor(Math.round(agent.avg_overall))}`}>
            {Math.round(agent.avg_overall)}
          </span>
          <span className="text-[10px] text-[#9b9b9b] uppercase tracking-wider">Avg Score</span>
        </div>

        {/* Stats row */}
        <div className="w-full grid grid-cols-2 gap-2 pt-1 border-t border-[#f0f0f0]">
          <div className="text-center">
            <p className="text-sm font-bold text-[#111]">{agent.interactions}</p>
            <p className="text-[10px] text-[#9b9b9b]">Calls</p>
          </div>
          <div className="text-center">
            <p className={`text-sm font-bold ${
              agent.compliance_rate >= 80 ? 'text-green-600' :
              agent.compliance_rate >= 60 ? 'text-yellow-600' : 'text-red-600'
            }`}>
              {Math.round(agent.compliance_rate)}%
            </p>
            <p className="text-[10px] text-[#9b9b9b]">Compliance</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Sort header cell ─────────────────────────────────────────────────────────

function SortTh({
  label,
  sortKey,
  currentKey,
  direction,
  onSort,
  className = '',
}: {
  label: string;
  sortKey: SortKey;
  currentKey: SortKey;
  direction: SortDir;
  onSort: (key: SortKey) => void;
  className?: string;
}) {
  const active = currentKey === sortKey;
  return (
    <th
      className={`px-4 py-2.5 text-left cursor-pointer select-none hover:bg-[#f8f8f8] transition-colors ${className}`}
      onClick={() => onSort(sortKey)}
    >
      <div className="flex items-center gap-1.5">
        <span className={`text-[10px] font-bold uppercase tracking-wider ${active ? 'text-[#111]' : 'text-[#9b9b9b]'}`}>
          {label}
        </span>
        {active ? (
          direction === 'desc'
            ? <ChevronDown className="h-3 w-3 text-[#555]" />
            : <ChevronUp className="h-3 w-3 text-[#555]" />
        ) : (
          <ArrowUpDown className="h-3 w-3 text-[#d0d0d0]" />
        )}
      </div>
    </th>
  );
}

// ─── Loading Skeleton ─────────────────────────────────────────────────────────

function LeaderboardSkeleton() {
  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <Skeleton className="h-9 w-64" />
        <Skeleton className="h-9 w-56" />
      </div>
      <div className="grid grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => <Skeleton key={i} className="h-52 rounded-xl" />)}
      </div>
      <Skeleton className="h-80 rounded-xl" />
      <Skeleton className="h-48 rounded-xl" />
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>('30d');
  const [sortKey, setSortKey] = useState<SortKey>('avg_overall');
  const [sortDir, setSortDir] = useState<SortDir>('desc');

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/qac/stats?range=${dateRange}`);
      if (!res.ok) throw new Error('Failed to load leaderboard data');
      const json = await res.json() as DashboardData;
      setData(json);
    } catch {
      toast.error('Failed to load leaderboard data');
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir(d => d === 'desc' ? 'asc' : 'desc');
    } else {
      setSortKey(key);
      setSortDir('desc');
    }
  }

  if (loading) return <LeaderboardSkeleton />;

  // Build leaderboard from available data
  const rawLeaderboard: AgentLeaderboardEntry[] = data?.agentLeaderboard?.length
    ? data.agentLeaderboard
    : (data?.topRiskAgents ?? []).map(a => ({
        name:            a.name,
        interactions:    a.interactions,
        avg_overall:     Math.max(0, 100 - a.avg_risk),
        avg_risk:        a.avg_risk,
        avg_compliance:  Math.max(0, 100 - a.avg_risk),
        avg_sales:       undefined,
        avg_soft_skills: undefined,
        compliance_rate: a.avg_risk < 30 ? 100 : Math.max(0, 100 - a.avg_risk),
        total_flags:     0,
        critical_flags:  0,
        high_flags:      0,
      }));

  // Sort
  const sorted = [...rawLeaderboard].sort((a, b) => {
    let av: number;
    let bv: number;
    if (sortKey === 'name') {
      return sortDir === 'asc'
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    av = (a[sortKey as keyof AgentLeaderboardEntry] as number | undefined) ?? 0;
    bv = (b[sortKey as keyof AgentLeaderboardEntry] as number | undefined) ?? 0;
    return sortDir === 'desc' ? bv - av : av - bv;
  });

  const top3 = sorted
    .filter(a => a.avg_overall > 0)
    .slice(0, 3) as (AgentLeaderboardEntry & { rank?: 1 | 2 | 3 })[];

  // Most flagged agents
  const mostFlagged = [...rawLeaderboard]
    .sort((a, b) => b.total_flags - a.total_flags)
    .slice(0, 10);

  const dateRangeLabels: Record<DateRange, string> = {
    '7d':  'Last 7 days',
    '30d': 'Last 30 days',
    '90d': 'Last 90 days',
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button asChild variant="ghost" size="sm" className="gap-1.5 text-[#6b6b6b] hover:text-[#111] -ml-2">
          <Link href="/qa-center">
            <ArrowLeft className="h-4 w-4" />
            Back
          </Link>
        </Button>

        <div className="flex items-center gap-3 min-w-0 flex-1">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#111] shrink-0">
            <Trophy className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-[#111] leading-tight">Agent Performance</h1>
            <p className="text-xs text-[#6b6b6b]">QA leaderboard across all analyzed interactions</p>
          </div>
        </div>

        {/* Date range filter */}
        <div className="flex items-center rounded-lg border border-[#efefef] p-0.5 gap-0.5 bg-white">
          {(['7d', '30d', '90d'] as DateRange[]).map(r => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                dateRange === r
                  ? 'bg-[#111] text-white'
                  : 'text-[#6b6b6b] hover:text-[#111] hover:bg-[#f5f5f5]'
              }`}
            >
              {dateRangeLabels[r]}
            </button>
          ))}
        </div>
      </div>

      {/* ── Empty state ─────────────────────────────────────────────────── */}
      {rawLeaderboard.length === 0 && (
        <Card className="border-dashed">
          <CardContent className="py-16 text-center space-y-3">
            <Trophy className="h-10 w-10 text-[#e0e0e0] mx-auto" />
            <p className="font-semibold text-[#555]">No agent data yet</p>
            <p className="text-sm text-[#9b9b9b] max-w-xs mx-auto">
              Analyze some interactions in QA Center to populate the leaderboard.
            </p>
            <Button asChild size="sm" variant="outline">
              <Link href="/qa-center">Go to QA Center</Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {rawLeaderboard.length > 0 && (
        <>
          {/* ── Top 3 Podium ─────────────────────────────────────────────── */}
          {top3.length >= 1 && (
            <div>
              <p className="text-[10px] font-bold text-[#9b9b9b] uppercase tracking-widest mb-3">
                Top Performers
              </p>
              <div className={`grid gap-4 ${
                top3.length === 1 ? 'grid-cols-1 max-w-xs' :
                top3.length === 2 ? 'grid-cols-2 max-w-lg' :
                'grid-cols-3'
              }`}>
                {/* For 3 agents: show 2nd, 1st, 3rd (podium order) */}
                {top3.length === 3 ? (
                  <>
                    <PodiumCard agent={top3[1]!} rank={2} />
                    <PodiumCard agent={top3[0]!} rank={1} />
                    <PodiumCard agent={top3[2]!} rank={3} />
                  </>
                ) : (
                  top3.map((agent, i) => (
                    <PodiumCard key={agent.name} agent={agent} rank={(i + 1) as 1 | 2 | 3} />
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Full Rankings Table ───────────────────────────────────────── */}
          <Card className="border-[#efefef]">
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Full Rankings</CardTitle>
                  <CardDescription className="mt-0.5">
                    {sorted.length} agent{sorted.length !== 1 ? 's' : ''} · Click column headers to sort
                  </CardDescription>
                </div>
                {data && (
                  <div className="flex items-center gap-4 text-xs text-[#9b9b9b]">
                    <span>
                      <span className="font-semibold text-[#111]">{data.analyzedInteractions}</span> analyzed
                    </span>
                    {data.complianceRate !== null && (
                      <span>
                        <span className={`font-semibold ${scoreColor(data.complianceRate)}`}>
                          {data.complianceRate}%
                        </span> compliance
                      </span>
                    )}
                  </div>
                )}
              </div>
            </CardHeader>
            <CardContent className="p-0 mt-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                      <th className="px-4 py-2.5 text-left w-10">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#9b9b9b]">Rank</span>
                      </th>
                      <SortTh label="Agent" sortKey="name" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                      <SortTh label="Calls" sortKey="interactions" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                      <SortTh label="Overall" sortKey="avg_overall" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                      <SortTh label="Compliance" sortKey="avg_compliance" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                      <SortTh label="Sales" sortKey="avg_sales" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                      <SortTh label="Soft Skills" sortKey="avg_soft_skills" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                      <SortTh label="Comp. Rate" sortKey="compliance_rate" currentKey={sortKey} direction={sortDir} onSort={handleSort} />
                      <th className="px-4 py-2.5 text-left">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#9b9b9b]">Risk Level</span>
                      </th>
                      <th className="px-4 py-2.5 text-right w-20">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#9b9b9b]">Actions</span>
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#f5f5f5]">
                    {sorted.map((agent, idx) => {
                      const rank = idx + 1;
                      const riskScore = agent.avg_risk ?? Math.round(100 - agent.avg_overall);
                      return (
                        <tr
                          key={agent.name}
                          className="hover:bg-[#fafafa] transition-colors"
                        >
                          {/* Rank */}
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${
                              rank === 1 ? 'text-yellow-600' :
                              rank === 2 ? 'text-gray-500' :
                              rank === 3 ? 'text-orange-500' :
                              'text-[#9b9b9b]'
                            }`}>
                              {rank === 1 ? '🥇' : rank === 2 ? '🥈' : rank === 3 ? '🥉' : `#${rank}`}
                            </span>
                          </td>

                          {/* Agent name */}
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2.5">
                              <div className="h-7 w-7 rounded-full bg-[#f0f0f0] flex items-center justify-center text-xs font-bold text-[#6b6b6b] shrink-0">
                                {agent.name.charAt(0).toUpperCase()}
                              </div>
                              <span className="text-sm font-semibold text-[#111] truncate max-w-[140px]">
                                {agent.name}
                              </span>
                            </div>
                          </td>

                          {/* Calls */}
                          <td className="px-4 py-3">
                            <span className="text-sm text-[#555]">{agent.interactions}</span>
                          </td>

                          {/* Overall */}
                          <td className="px-4 py-3">
                            <ScoreCell score={agent.avg_overall} />
                          </td>

                          {/* Compliance score */}
                          <td className="px-4 py-3">
                            <ScoreCell score={agent.avg_compliance} />
                          </td>

                          {/* Sales */}
                          <td className="px-4 py-3">
                            <ScoreCell score={agent.avg_sales} />
                          </td>

                          {/* Soft Skills */}
                          <td className="px-4 py-3">
                            <ScoreCell score={agent.avg_soft_skills} />
                          </td>

                          {/* Compliance Rate */}
                          <td className="px-4 py-3">
                            <span className={`text-sm font-semibold ${
                              agent.compliance_rate >= 80 ? 'text-green-600' :
                              agent.compliance_rate >= 60 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {Math.round(agent.compliance_rate)}%
                            </span>
                          </td>

                          {/* Risk badge */}
                          <td className="px-4 py-3">
                            <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-semibold ${riskBg(riskScore)}`}>
                              <span className={`h-1.5 w-1.5 rounded-full ${
                                riskScore < 20 ? 'bg-green-500' :
                                riskScore < 45 ? 'bg-yellow-500' :
                                riskScore < 70 ? 'bg-orange-500' : 'bg-red-500'
                              }`} />
                              {riskLabel(riskScore)}
                            </span>
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right">
                            <Button
                              asChild
                              variant="ghost"
                              size="sm"
                              className="h-7 w-7 p-0 text-[#9b9b9b] hover:text-[#111]"
                            >
                              <Link href={`/qa-center?agent=${encodeURIComponent(agent.name)}`}>
                                <ExternalLink className="h-3.5 w-3.5" />
                              </Link>
                            </Button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </CardContent>
          </Card>

          {/* ── Most Flagged Agents ───────────────────────────────────────── */}
          {mostFlagged.some(a => a.total_flags > 0) && (
            <Card className="border-[#efefef]">
              <CardHeader className="pb-3">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="h-4 w-4 text-red-500" />
                  <CardTitle className="text-base">Most Flagged Agents</CardTitle>
                </div>
                <CardDescription>Agents with the highest number of compliance and quality violations</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-[#f0f0f0] bg-[#fafafa]">
                        {['Agent', 'Total Violations', 'Critical', 'High', 'Compliance Rate', 'Trend'].map(h => (
                          <th key={h} className="px-4 py-2.5 text-left">
                            <span className="text-[10px] font-bold uppercase tracking-wider text-[#9b9b9b]">{h}</span>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#f5f5f5]">
                      {mostFlagged.filter(a => a.total_flags > 0).map(agent => (
                        <tr key={agent.name} className="hover:bg-[#fafafa] transition-colors">
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <User className="h-3.5 w-3.5 text-[#9b9b9b]" />
                              <span className="text-sm font-medium text-[#111]">{agent.name}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-bold ${
                              agent.total_flags > 10 ? 'text-red-600' :
                              agent.total_flags > 5 ? 'text-orange-600' :
                              'text-[#555]'
                            }`}>
                              {agent.total_flags}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {agent.critical_flags > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-red-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                                {agent.critical_flags}
                              </span>
                            ) : (
                              <span className="text-xs text-[#c0c0c0]">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            {agent.high_flags > 0 ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold text-orange-600">
                                <span className="h-1.5 w-1.5 rounded-full bg-orange-500" />
                                {agent.high_flags}
                              </span>
                            ) : (
                              <span className="text-xs text-[#c0c0c0]">0</span>
                            )}
                          </td>
                          <td className="px-4 py-3">
                            <span className={`text-sm font-semibold ${
                              agent.compliance_rate >= 80 ? 'text-green-600' :
                              agent.compliance_rate >= 60 ? 'text-yellow-600' :
                              'text-red-600'
                            }`}>
                              {Math.round(agent.compliance_rate)}%
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            {agent.compliance_rate >= 80 ? (
                              <span className="flex items-center gap-1 text-xs text-green-600 font-medium">
                                <TrendingUp className="h-3.5 w-3.5" /> Good
                              </span>
                            ) : agent.compliance_rate >= 60 ? (
                              <span className="flex items-center gap-1 text-xs text-yellow-600 font-medium">
                                <TrendingDown className="h-3.5 w-3.5" /> Review
                              </span>
                            ) : (
                              <span className="flex items-center gap-1 text-xs text-red-600 font-medium">
                                <AlertTriangle className="h-3.5 w-3.5" /> Urgent
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

          {/* ── Summary stats strip ───────────────────────────────────────── */}
          {data && (
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                {
                  value: data.analyzedInteractions,
                  label: 'Calls Analyzed',
                  color: 'text-[#111]',
                },
                {
                  value: data.avgOverallScore !== null ? `${data.avgOverallScore}` : '—',
                  label: 'Avg QA Score',
                  color: data.avgOverallScore !== null ? scoreColor(data.avgOverallScore) : 'text-[#9b9b9b]',
                },
                {
                  value: data.complianceRate !== null ? `${data.complianceRate}%` : '—',
                  label: 'Compliance Rate',
                  color: data.complianceRate !== null ? scoreColor(data.complianceRate) : 'text-[#9b9b9b]',
                },
                {
                  value: (data.flagsBySeverity.critical + data.flagsBySeverity.high),
                  label: 'High-Risk Flags',
                  color: (data.flagsBySeverity.critical + data.flagsBySeverity.high) > 0 ? 'text-red-600' : 'text-green-600',
                },
              ].map(stat => (
                <Card key={stat.label} className="border-[#efefef]">
                  <CardContent className="pt-4 pb-3">
                    <p className={`text-2xl font-black ${stat.color}`}>{stat.value}</p>
                    <p className="text-xs text-[#6b6b6b] mt-0.5">{stat.label}</p>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
