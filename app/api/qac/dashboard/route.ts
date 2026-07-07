/**
 * QA Center — Enterprise Dashboard Metrics
 *
 * Returns comprehensive aggregated metrics for the QA Center dashboard:
 * call volumes, dimension scores, compliance rates, violation breakdowns,
 * agent leaderboard & risk rankings, recent critical flags, 30-day trends,
 * and risk distribution.
 *
 * Always uses the admin client (bypasses RLS) because aggregations run across
 * the full workspace data set — workspace isolation is enforced here in code.
 * The pure aggregation logic lives in _lib/aggregate; shapes in _lib/types.
 */

import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type {
  DashboardMetrics,
  EvalRow,
  FlagRow,
  InteractionWithEvals,
  FlagWithRelations,
  InteractionDayRow,
  RiskRow,
} from "./_lib/types";
import {
  computeAvgScores,
  computeComplianceRate,
  computeViolations,
  buildAgentMap,
  computeLeaderboard,
  computeTopRiskAgents,
  computeRecentViolations,
  computeCallsByDay,
  computeRiskDistribution,
} from "./_lib/aggregate";

export async function GET() {
  // ── Resolve workspace from authenticated user ────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: wsRaw, error: wsErr } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", user.id)
    .single();

  if (wsErr || !wsRaw) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  const ws = wsRaw as { id: string };

  const workspaceId = ws.id;
  const thirtyDaysAgo = new Date(
    Date.now() - 30 * 24 * 60 * 60 * 1000,
  ).toISOString();

  // ── Parallel data fetches (allSettled so a single failure doesn't crash all) ─
  const settled = await Promise.allSettled([
    // 1. Total call count
    admin
      .from("qac_interactions")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId),

    // 2. Analyzed call count
    admin
      .from("qac_interactions")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("status", "analyzed"),

    // 3. Pending call count (pending + failed)
    admin
      .from("qac_interactions")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .in("status", ["pending", "failed"]),

    // 4. All evaluations — scores for aggregation
    admin
      .from("qac_evaluations")
      .select(
        `
        id,
        interaction_id,
        overall_score,
        compliance_score,
        sales_score,
        soft_skills_score,
        conversation_score
      `,
      )
      .eq("workspace_id", workspaceId),

    // 5. All flags — severity + type breakdown
    admin
      .from("qac_flags")
      .select("id, severity, violation_type, category")
      .eq("workspace_id", workspaceId),

    // 6. Interactions last 30 days — for daily trend + risk distribution
    admin
      .from("qac_interactions")
      .select("id, agent_name, agent_id, risk_level, created_at, status")
      .eq("workspace_id", workspaceId)
      .gte("created_at", thirtyDaysAgo)
      .order("created_at", { ascending: false }),

    // 7. Recent critical/high flags with joined interaction data
    admin
      .from("qac_flags")
      .select(
        `
        id,
        label,
        severity,
        category,
        violation_type,
        regulation,
        transcript_fragment,
        coaching_note,
        suggested_correction,
        created_at,
        qac_evaluations!inner (
          interaction_id,
          qac_interactions!inner ( agent_name )
        )
      `,
      )
      .eq("workspace_id", workspaceId)
      .in("severity", ["critical", "high"])
      .order("created_at", { ascending: false })
      .limit(10),

    // 8. All interactions with evaluations for agent leaderboard
    admin
      .from("qac_interactions")
      .select(
        `
        id,
        agent_name,
        agent_id,
        qac_evaluations (
          overall_score,
          compliance_score,
          risk_score
        )
      `,
      )
      .eq("workspace_id", workspaceId)
      .not("qac_evaluations", "is", null),
  ]);

  const [s0, s1, s2, s3, s4, s5, s6, s7] = settled;
  const val = <T>(
    r: PromiseSettledResult<{
      data: T | null;
      count?: number | null;
      error: unknown;
    }>,
  ) =>
    r.status === "fulfilled"
      ? r.value
      : { data: null as T | null, count: null as number | null, error: null };

  const countTotal = val(s0!);
  const countAnalyzed = val(s1!);
  const countPending = val(s2!);
  const evalsResult = val(s3!);
  const flagsResult = val(s4!);
  const interactionsRecentResult = val(s5!);
  const flagsRecentResult = val(s6!);
  const interactionsAllResult = val(s7!);

  // ── Aggregate (pure) ───────────────────────────────────────────────────────
  const evals = (evalsResult.data ?? []) as EvalRow[];
  const allFlags = (flagsResult.data ?? []) as FlagRow[];
  const interactionsAll = (interactionsAllResult.data ??
    []) as unknown as InteractionWithEvals[];
  const recentFlagsRaw = (flagsRecentResult.data ??
    []) as unknown as FlagWithRelations[];
  const recentInteractions = (interactionsRecentResult.data ??
    []) as InteractionDayRow[];

  const agentMap = buildAgentMap(interactionsAll);
  const { violationsBySeverity, violationsByType } =
    computeViolations(allFlags);

  // ── Risk distribution (across ALL interactions, not just 30 days) ─────────
  const { data: riskData } = await admin
    .from("qac_interactions")
    .select("risk_level")
    .eq("workspace_id", workspaceId);
  const riskRows = (riskData ?? []) as RiskRow[];

  // ── Assemble response ──────────────────────────────────────────────────────
  const metrics: DashboardMetrics = {
    totalCalls: countTotal.count ?? 0,
    analyzedCalls: countAnalyzed.count ?? 0,
    pendingCalls: countPending.count ?? 0,
    avgScores: computeAvgScores(evals),
    complianceRate: computeComplianceRate(evals),
    totalViolations: allFlags.length,
    violationsBySeverity,
    violationsByType,
    topRiskAgents: computeTopRiskAgents(agentMap),
    agentLeaderboard: computeLeaderboard(agentMap),
    recentViolations: computeRecentViolations(recentFlagsRaw),
    callsByDay: computeCallsByDay(recentInteractions, evals),
    riskDistribution: computeRiskDistribution(riskRows),
  };

  return NextResponse.json(metrics);
}
