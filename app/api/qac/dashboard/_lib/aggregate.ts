import type {
  DashboardMetrics,
  EvalRow,
  FlagRow,
  InteractionWithEvals,
  AgentAccum,
  FlagWithRelations,
  InteractionDayRow,
  RiskRow,
} from "./types";

// ─── Small helper — safe average ─────────────────────────────────────────────
export function avg(nums: number[]): number | null {
  if (nums.length === 0) return null;
  return Math.round(nums.reduce((a, b) => a + b, 0) / nums.length);
}

// ── Evaluation aggregates ──────────────────────────────────────────────────
export function computeAvgScores(
  evals: EvalRow[],
): DashboardMetrics["avgScores"] {
  return {
    overall: avg(evals.map((e) => Number(e.overall_score))),
    compliance: avg(
      evals
        .filter((e) => e.compliance_score != null)
        .map((e) => Number(e.compliance_score)),
    ),
    sales: avg(
      evals
        .filter((e) => e.sales_score != null)
        .map((e) => Number(e.sales_score)),
    ),
    softSkills: avg(
      evals
        .filter((e) => e.soft_skills_score != null)
        .map((e) => Number(e.soft_skills_score)),
    ),
    conversation: avg(
      evals
        .filter((e) => e.conversation_score != null)
        .map((e) => Number(e.conversation_score)),
    ),
  };
}

export function computeComplianceRate(evals: EvalRow[]): number | null {
  const evalsWithCompliance = evals.filter((e) => e.compliance_score != null);
  return evalsWithCompliance.length > 0
    ? Math.round(
        (evalsWithCompliance.filter((e) => Number(e.compliance_score) >= 70)
          .length /
          evalsWithCompliance.length) *
          100,
      )
    : null;
}

// ── Flag aggregates ────────────────────────────────────────────────────────
export function computeViolations(allFlags: FlagRow[]): {
  violationsBySeverity: DashboardMetrics["violationsBySeverity"];
  violationsByType: Record<string, number>;
} {
  const violationsBySeverity = {
    critical: allFlags.filter((f) => f.severity === "critical").length,
    high: allFlags.filter((f) => f.severity === "high").length,
    medium: allFlags.filter((f) => f.severity === "medium").length,
    low: allFlags.filter((f) => f.severity === "low").length,
  };

  const violationsByType: Record<string, number> = {};
  for (const f of allFlags) {
    const t = f.violation_type ?? f.category ?? "unknown";
    violationsByType[t] = (violationsByType[t] ?? 0) + 1;
  }

  return { violationsBySeverity, violationsByType };
}

// ── Agent accumulator (feeds both leaderboard & risk ranking) ──────────────
export function buildAgentMap(
  interactionsAll: InteractionWithEvals[],
): Record<string, AgentAccum> {
  const agentMap: Record<string, AgentAccum> = {};

  for (const interaction of interactionsAll) {
    const name = interaction.agent_name ?? "Unknown";
    if (!agentMap[name]) {
      agentMap[name] = {
        name,
        total_calls: 0,
        overall_sum: 0,
        overall_count: 0,
        compliance_sum: 0,
        compliance_count: 0,
        risk_sum: 0,
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

  return agentMap;
}

// Agent leaderboard — sorted by avg_overall DESC
export function computeLeaderboard(
  agentMap: Record<string, AgentAccum>,
): DashboardMetrics["agentLeaderboard"] {
  return Object.values(agentMap)
    .filter((a) => a.overall_count > 0)
    .map((a) => ({
      agent_name: a.name,
      avg_overall: Math.round(a.overall_sum / a.overall_count),
      avg_compliance:
        a.compliance_count > 0
          ? Math.round(a.compliance_sum / a.compliance_count)
          : 0,
      total_calls: a.total_calls,
      rank: 0, // filled below
    }))
    .sort((x, y) => y.avg_overall - x.avg_overall)
    .map((a, idx) => ({ ...a, rank: idx + 1 }));
}

// Top risk agents — sorted by avg_risk DESC.
// critical_violations is 0: the minimal flag query carries no evaluation_id, so
// per-agent critical counts can't be joined here (matches prior behavior).
export function computeTopRiskAgents(
  agentMap: Record<string, AgentAccum>,
): DashboardMetrics["topRiskAgents"] {
  return Object.values(agentMap)
    .filter((a) => a.total_calls > 0)
    .map((a) => ({
      agent_name: a.name,
      avg_risk:
        a.overall_count > 0 ? Math.round(a.risk_sum / a.overall_count) : 0,
      total_calls: a.total_calls,
      critical_violations: 0,
    }))
    .sort((x, y) => y.avg_risk - x.avg_risk)
    .slice(0, 10);
}

// ── Recent critical/high violations ────────────────────────────────────────
export function computeRecentViolations(
  recentFlagsRaw: FlagWithRelations[],
): DashboardMetrics["recentViolations"] {
  return recentFlagsRaw.map((f) => ({
    id: f.id,
    label: f.label,
    severity: f.severity,
    category: f.category,
    violation_type: f.violation_type,
    regulation: f.regulation,
    transcript_fragment: f.transcript_fragment,
    coaching_note: f.coaching_note,
    suggested_correction: f.suggested_correction,
    interaction_id: f.qac_evaluations?.interaction_id ?? null,
    agent_name: f.qac_evaluations?.qac_interactions?.agent_name ?? null,
    created_at: f.created_at,
  }));
}

// ── 30-day daily trend ─────────────────────────────────────────────────────
export function computeCallsByDay(
  recentInteractions: InteractionDayRow[],
  evals: EvalRow[],
): DashboardMetrics["callsByDay"] {
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

  return Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({
      date,
      count: v.count,
      avg_score:
        v.scores.length > 0
          ? Math.round(v.scores.reduce((a, b) => a + b, 0) / v.scores.length)
          : null,
    }));
}

// ── Risk distribution (across ALL interactions) ────────────────────────────
export function computeRiskDistribution(
  riskRows: RiskRow[],
): DashboardMetrics["riskDistribution"] {
  return {
    critical: riskRows.filter((r) => r.risk_level === "critical").length,
    high: riskRows.filter((r) => r.risk_level === "high").length,
    medium: riskRows.filter((r) => r.risk_level === "medium").length,
    low: riskRows.filter((r) => r.risk_level === "low").length,
    unknown: riskRows.filter((r) => r.risk_level === "unknown" || !r.risk_level)
      .length,
  };
}
