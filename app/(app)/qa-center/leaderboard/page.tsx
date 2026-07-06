"use client";

import { useState, useEffect, useCallback } from "react";
import { toast } from "sonner";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trophy } from "lucide-react";
import type {
  AgentLeaderboardEntry,
  DashboardData,
  SortKey,
  SortDir,
  DateRange,
} from "./_components/types";
import { PodiumCard } from "./_components/PodiumCard";
import { LeaderboardSkeleton } from "./_components/LeaderboardSkeleton";
import { RankingsTable } from "./_components/RankingsTable";
import { MostFlaggedTable } from "./_components/MostFlaggedTable";
import { SummaryStrip } from "./_components/SummaryStrip";

export default function LeaderboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dateRange, setDateRange] = useState<DateRange>("30d");
  const [sortKey, setSortKey] = useState<SortKey>("avg_overall");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/qac/stats?range=${dateRange}`);
      if (!res.ok) throw new Error("Failed to load leaderboard data");
      const json = (await res.json()) as DashboardData;
      setData(json);
    } catch {
      toast.error("Failed to load leaderboard data");
    } finally {
      setLoading(false);
    }
  }, [dateRange]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortKey(key);
      setSortDir("desc");
    }
  }

  if (loading) return <LeaderboardSkeleton />;

  // Build leaderboard from available data
  const rawLeaderboard: AgentLeaderboardEntry[] = data?.agentLeaderboard?.length
    ? data.agentLeaderboard
    : (data?.topRiskAgents ?? []).map((a) => ({
        name: a.name,
        interactions: a.interactions,
        avg_overall: Math.max(0, 100 - a.avg_risk),
        avg_risk: a.avg_risk,
        avg_compliance: Math.max(0, 100 - a.avg_risk),
        avg_sales: undefined,
        avg_soft_skills: undefined,
        compliance_rate: a.avg_risk < 30 ? 100 : Math.max(0, 100 - a.avg_risk),
        total_flags: 0,
        critical_flags: 0,
        high_flags: 0,
      }));

  // Sort
  const sorted = [...rawLeaderboard].sort((a, b) => {
    let av: number;
    let bv: number;
    if (sortKey === "name") {
      return sortDir === "asc"
        ? a.name.localeCompare(b.name)
        : b.name.localeCompare(a.name);
    }
    av = (a[sortKey as keyof AgentLeaderboardEntry] as number | undefined) ?? 0;
    bv = (b[sortKey as keyof AgentLeaderboardEntry] as number | undefined) ?? 0;
    return sortDir === "desc" ? bv - av : av - bv;
  });

  const top3 = sorted
    .filter((a) => a.avg_overall > 0)
    .slice(0, 3) as (AgentLeaderboardEntry & { rank?: 1 | 2 | 3 })[];

  // Most flagged agents
  const mostFlagged = [...rawLeaderboard]
    .sort((a, b) => b.total_flags - a.total_flags)
    .slice(0, 10);

  const dateRangeLabels: Record<DateRange, string> = {
    "7d": "Last 7 days",
    "30d": "Last 30 days",
    "90d": "Last 90 days",
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center gap-4 flex-wrap">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="gap-1.5 text-[#6b6b6b] hover:text-[#111] -ml-2"
        >
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
            <h1 className="text-xl font-bold text-[#111] leading-tight">
              Agent Performance
            </h1>
            <p className="text-xs text-[#6b6b6b]">
              QA leaderboard across all analyzed interactions
            </p>
          </div>
        </div>

        {/* Date range filter */}
        <div className="flex items-center rounded-lg border border-[#efefef] p-0.5 gap-0.5 bg-white">
          {(["7d", "30d", "90d"] as DateRange[]).map((r) => (
            <button
              key={r}
              onClick={() => setDateRange(r)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                dateRange === r
                  ? "bg-[#111] text-white"
                  : "text-[#6b6b6b] hover:text-[#111] hover:bg-[#f5f5f5]"
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
              Analyze some interactions in QA Center to populate the
              leaderboard.
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
              <div
                className={`grid gap-4 ${
                  top3.length === 1
                    ? "grid-cols-1 max-w-xs"
                    : top3.length === 2
                      ? "grid-cols-2 max-w-lg"
                      : "grid-cols-3"
                }`}
              >
                {/* For 3 agents: show 2nd, 1st, 3rd (podium order) */}
                {top3.length === 3 ? (
                  <>
                    <PodiumCard agent={top3[1]!} rank={2} />
                    <PodiumCard agent={top3[0]!} rank={1} />
                    <PodiumCard agent={top3[2]!} rank={3} />
                  </>
                ) : (
                  top3.map((agent, i) => (
                    <PodiumCard
                      key={agent.name}
                      agent={agent}
                      rank={(i + 1) as 1 | 2 | 3}
                    />
                  ))
                )}
              </div>
            </div>
          )}

          {/* ── Full Rankings Table ───────────────────────────────────────── */}
          <RankingsTable
            sorted={sorted}
            sortKey={sortKey}
            sortDir={sortDir}
            onSort={handleSort}
            data={data}
          />

          {/* ── Most Flagged Agents ───────────────────────────────────────── */}
          {mostFlagged.some((a) => a.total_flags > 0) && (
            <MostFlaggedTable mostFlagged={mostFlagged} />
          )}

          {/* ── Summary stats strip ───────────────────────────────────────── */}
          {data && <SummaryStrip data={data} />}
        </>
      )}
    </div>
  );
}
