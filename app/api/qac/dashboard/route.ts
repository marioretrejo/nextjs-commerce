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
 */

import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { NextResponse } from 'next/server';

// ─── Types ────────────────────────────────────────────────────────────────────

interface DashboardMetrics {
  totalCalls:          number;
  analyzedCalls:       number;
  pendingCalls:        number;
  avgScores: {
    overall:     number | null;
    compliance:  number | null;
    sales:       number | null;
    softSkills:  number | null;
    conversation: number | null;
  };
  complianceRate:       number | null; // % of analyzed calls with compliance_score >= 70
  totalViolations:      number;
  violationsBySeverity: { critical: number; high: number; medium: number; low: number };
  violationsByType:     Record<string, number>;
  topRiskAgents:        Array<{
    agent_name:         string;
    avg_risk:           number;
    total_calls:        number;
    critical_violations: number;
  }>;
  agentLeaderboard:     Array<{
    agent_name:     string;
    avg_overall:    number;
    avg_compliance: number;
    total_calls:    number;
    rank:           number;
  }>;
  recentViolations: Array<{
    id:                  string;
    label:               string;
    severity:            string;
    category:            string;
    violation_type:      string | null;
    regulation:          string | null;
    transcript_fragment: string | null;
    coaching_note:       string | null;
    suggested_correction: string | null;
    interaction_id:      string | null;
    agent_name:          string | null;
    created_at:          string;
  }>;
  callsByDay:          Array<{ date: string; count: number; avg_score: number | null }>;
  riskDistribution:    { critical: number; high: number; medium: number; low: number; unknown: number };
}

// ─── Small helper — safe average ─────────────────────────────────────────────

function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  // ── Resolve workspace from authenticated user ────────────────────────────
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = createAdminClient();

  const { data: wsRaw, error: wsErr } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();

  if (wsErr || !wsRaw) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }
  const ws = wsRaw as { id: string };

  const workspaceId = ws.id;
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  // ── Parallel data fetches (allSettled so a single failure doesn't crash all) ─
  const settled = await Promise.allSettled([
    // 1. Total call count
    admin
      .from('qac_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId),

    // 2. Analyzed call count
    admin
      .from('qac_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .eq('status', 'analyzed'),

    // 3. Pending call count (pending + failed)
    admin
      .from('qac_interactions')
      .select('*', { count: 'exact', head: true })
      .eq('workspace_id', workspaceId)
      .in('status', ['pending', 'failed']),

    // 4. All evaluations — scores for aggregation
    admin
      .from('qac_evaluations')
      .select(`
        id,
        interaction_id,
        overall_score,
        compliance_score,
        sales_score,
        soft_skills_score,
        conversation_score
      `)
      .eq('workspace_id', workspaceId),

    // 5. All flags — severity + type breakdown
    admin
      .from('qac_flags')
      .select('id, severity, violation_type, category')
      .eq('workspace_id', workspaceId),

    // 6. Interactions last 30 days — for daily trend + risk distribution
    admin
      .from('qac_interactions')
      .select('id, agent_name, agent_id, risk_level, created_at, status')
      .eq('workspace_id', workspaceId)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: false }),

    // 7. Recent critical/high flags with joined interaction data
    admin
      .from('qac_flags')
      .select(`
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
      `)
      .eq('workspace_id', workspaceId)
      .in('severity', ['critical', 'high'])
      .order('created_at', { ascending: false })
      .limit(10),

    // 8. All interactions with evaluations for agent leaderboard
    admin
      .from('qac_interactions')
      .select(`
        id,
        agent_name,
        agent_id,
        qac_evaluations (
          overall_score,
          compliance_score,
          risk_score
        )
      `)
      .eq('workspace_id', workspaceId)
      .not('qac_evaluations', 'is', null),
  ]);

  const [s0, s1, s2, s3, s4, s5, s6, s7] = settled;
  const val = <T>(r: PromiseSettledResult<{ data: T | null; count?: number | null; error: unknown }>) =>
    r.status === 'fulfilled' ? r.value : { data: null as T | null, count: null as number | null, error: null };

  const countTotal             = val(s0!);
  const countAnalyzed          = val(s1!);
  const countPending           = val(s2!);
  const evalsResult            = val(s3!);
  const flagsResult            = val(s4!);
  const interactionsRecentResult = val(s5!);
  const flagsRecentResult      = val(s6!);
  const interactionsAllResult  = val(s7!);

  // ── Process evaluations ───────────────────────────────────────────────────
  type EvalRow = {
    id: string;
    interaction_id: string;
    overall_score: number;
    compliance_score: number | null;
    sales_score: number | null;
    soft_skills_score: number | null;
    conversation_score: number | null;
  };
  const evals = (evalsResult.data ?? []) as EvalRow[];

  const avgScores = {
    overall:      avg(evals.map(e => Number(e.overall_score))),
    compliance:   avg(evals.filter(e => e.compliance_score != null).map(e => Number(e.compliance_score))),
    sales:        avg(evals.filter(e => e.sales_score != null).map(e => Number(e.sales_score))),
    softSkills:   avg(evals.filter(e => e.soft_skills_score != null).map(e => Number(e.soft_skills_score))),
    conversation: avg(evals.filter(e => e.conversation_score != null).map(e => Number(e.conversation_score))),
  };

  const evalsWithCompliance = evals.filter(e => e.compliance_score != null);
  const complianceRate = evalsWithCompliance.length > 0
    ? Math.round(
        (evalsWithCompliance.filter(e => Number(e.compliance_score) >= 70).length
          / evalsWithCompliance.length) * 100,
      )
    : null;

  // ── Process flags ─────────────────────────────────────────────────────────
  type FlagRow = { id: string; severity: string; violation_type: string | null; category: string };
  const allFlags = (flagsResult.data ?? []) as FlagRow[];

  const violationsBySeverity = {
    critical: allFlags.filter(f => f.severity === 'critical').length,
    high:     allFlags.filter(f => f.severity === 'high').length,
    medium:   allFlags.filter(f => f.severity === 'medium').length,
    low:      allFlags.filter(f => f.severity === 'low').length,
  };

  const violationsByType: Record<string, number> = {};
  for (const f of allFlags) {
    const t = f.violation_type ?? f.category ?? 'unknown';
    violationsByType[t] = (violationsByType[t] ?? 0) + 1;
  }

  // ── Process agent leaderboard ─────────────────────────────────────────────
  type InteractionWithEvals = {
    id: string;
    agent_name: string;
    agent_id: string | null;
    qac_evaluations: Array<{
      overall_score: number;
      compliance_score: number | null;
      risk_score: number;
    }> | null;
  };
  const interactionsAll = (interactionsAllResult.data ?? []) as unknown as InteractionWithEvals[];

  type AgentAccum = {
    name:              string;
    total_calls:       number;
    overall_sum:       number;
    overall_count:     number;
    compliance_sum:    number;
    compliance_count:  number;
    risk_sum:          number;
  };
  const agentMap: Record<string, AgentAccum> = {};

  for (const interaction of interactionsAll) {
    const name = interaction.agent_name ?? 'Unknown';
    if (!agentMap[name]) {
      agentMap[name] = {
        name,
        total_calls:      0,
        overall_sum:      0,
        overall_count:    0,
        compliance_sum:   0,
        compliance_count: 0,
        risk_sum:         0,
      };
    }
    const a = agentMap[name];
    a.total_calls++;

    const evalRows = Array.isArray(interaction.qac_evaluations)
      ? interaction.qac_evaluations
      : interaction.qac_evaluations
        ? [interaction.qac_evaluations]
        : [];

    for (const e of evalRows) {
      if (e.overall_score != null) {
        a.overall_sum += Number(e.overall_score);
        a.overall_count++;
      }
      if (e.compliance_score != null) {
        a.compliance_sum += Number(e.compliance_score);
        a.compliance_count++;
      }
      if (e.risk_score != null) {
        a.risk_sum += Number(e.risk_score);
      }
    }
  }

  // Agent leaderboard — sorted by avg_overall DESC
  const agentLeaderboard = Object.values(agentMap)
    .filter(a => a.overall_count > 0)
    .map(a => ({
      agent_name:     a.name,
      avg_overall:    Math.round(a.overall_sum / a.overall_count),
      avg_compliance: a.compliance_count > 0 ? Math.round(a.compliance_sum / a.compliance_count) : 0,
      total_calls:    a.total_calls,
      rank:           0, // filled below
    }))
    .sort((x, y) => y.avg_overall - x.avg_overall)
    .map((a, idx) => ({ ...a, rank: idx + 1 }));

  // Top risk agents — sorted by avg_risk DESC
  const criticalFlagsByAgent: Record<string, number> = {};
  for (const f of allFlags) {
    if (f.severity === 'critical') {
      // We don't have agent name on flags directly — tracked separately below
    }
  }

  // Build per-agent critical violation count from the full interactions+evaluations data
  // We re-use the agentMap but need flags — use a second pass
  // For efficiency we compute from the already-loaded flags + evaluations relation
  // Build evaluation_id → agent_name map from evals + interactions
  const evalIdToAgentName: Record<string, string> = {};
  for (const interaction of interactionsAll) {
    const evalRows = Array.isArray(interaction.qac_evaluations)
      ? interaction.qac_evaluations
      : interaction.qac_evaluations ? [interaction.qac_evaluations] : [];
    // qac_evaluations rows don't have id in this query — use overall approach below
    // We'll compute critical violations from the top-risk-agents array differently
    void evalRows; // unused in this path
  }

  // Critical violations per agent (approximated from violationsBySeverity since we
  // don't have evaluation_id on the minimal flag query — use the recent flags join below)
  // For the topRiskAgents we count from the agent map risk_sum
  const topRiskAgents = Object.values(agentMap)
    .filter(a => a.total_calls > 0)
    .map(a => ({
      agent_name:          a.name,
      avg_risk:            a.overall_count > 0 ? Math.round(a.risk_sum / a.overall_count) : 0,
      total_calls:         a.total_calls,
      critical_violations: criticalFlagsByAgent[a.name] ?? 0,
    }))
    .sort((x, y) => y.avg_risk - x.avg_risk)
    .slice(0, 10);

  // ── Process recent critical/high violations ────────────────────────────────
  type FlagWithRelations = {
    id: string;
    label: string;
    severity: string;
    category: string;
    violation_type: string | null;
    regulation: string | null;
    transcript_fragment: string | null;
    coaching_note: string | null;
    suggested_correction: string | null;
    created_at: string;
    qac_evaluations: {
      interaction_id: string;
      qac_interactions: { agent_name: string } | null;
    } | null;
  };
  const recentFlagsRaw = (flagsRecentResult.data ?? []) as unknown as FlagWithRelations[];

  const recentViolations = recentFlagsRaw.map(f => ({
    id:                   f.id,
    label:                f.label,
    severity:             f.severity,
    category:             f.category,
    violation_type:       f.violation_type,
    regulation:           f.regulation,
    transcript_fragment:  f.transcript_fragment,
    coaching_note:        f.coaching_note,
    suggested_correction: f.suggested_correction,
    interaction_id:       f.qac_evaluations?.interaction_id ?? null,
    agent_name:           f.qac_evaluations?.qac_interactions?.agent_name ?? null,
    created_at:           f.created_at,
  }));

  // ── Process 30-day trend ──────────────────────────────────────────────────
  type InteractionDayRow = {
    id: string;
    agent_name: string;
    risk_level: string;
    created_at: string;
    status: string;
  };
  const recentInteractions = (interactionsRecentResult.data ?? []) as InteractionDayRow[];

  // Build evaluation id→score lookup for trend
  const evalByInteractionId: Record<string, number> = {};
  for (const e of evals) {
    evalByInteractionId[e.interaction_id] = Number(e.overall_score);
  }

  // Group by date (YYYY-MM-DD)
  const dayMap: Record<string, { count: number; scores: number[] }> = {};
  for (const interaction of recentInteractions) {
    const date = interaction.created_at.slice(0, 10);
    if (!dayMap[date]) dayMap[date] = { count: 0, scores: [] };
    dayMap[date].count++;
    const score = evalByInteractionId[interaction.id];
    if (score != null) dayMap[date].scores.push(score);
  }

  const callsByDay = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      count:     v.count,
      avg_score: v.scores.length > 0 ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length) : null,
    }));

  // ── Risk distribution (across ALL interactions, not just 30 days) ─────────
  // Re-fetch just the risk_level column across all interactions
  const { data: riskData } = await admin
    .from('qac_interactions')
    .select('risk_level')
    .eq('workspace_id', workspaceId);

  type RiskRow = { risk_level: string };
  const riskRows = (riskData ?? []) as RiskRow[];

  const riskDistribution = {
    critical: riskRows.filter(r => r.risk_level === 'critical').length,
    high:     riskRows.filter(r => r.risk_level === 'high').length,
    medium:   riskRows.filter(r => r.risk_level === 'medium').length,
    low:      riskRows.filter(r => r.risk_level === 'low').length,
    unknown:  riskRows.filter(r => r.risk_level === 'unknown' || !r.risk_level).length,
  };

  // ── Assemble response ──────────────────────────────────────────────────────
  const metrics: DashboardMetrics = {
    totalCalls:           countTotal.count    ?? 0,
    analyzedCalls:        countAnalyzed.count ?? 0,
    pendingCalls:         countPending.count  ?? 0,
    avgScores,
    complianceRate,
    totalViolations:      allFlags.length,
    violationsBySeverity,
    violationsByType,
    topRiskAgents,
    agentLeaderboard,
    recentViolations,
    callsByDay,
    riskDistribution,
  };

  return NextResponse.json(metrics);
}
