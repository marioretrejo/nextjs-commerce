// ─── Dashboard response shape ────────────────────────────────────────────────

export interface DashboardMetrics {
  totalCalls: number;
  analyzedCalls: number;
  pendingCalls: number;
  avgScores: {
    overall: number | null;
    compliance: number | null;
    sales: number | null;
    softSkills: number | null;
    conversation: number | null;
  };
  complianceRate: number | null; // % of analyzed calls with compliance_score >= 70
  totalViolations: number;
  violationsBySeverity: {
    critical: number;
    high: number;
    medium: number;
    low: number;
  };
  violationsByType: Record<string, number>;
  topRiskAgents: Array<{
    agent_name: string;
    avg_risk: number;
    total_calls: number;
    critical_violations: number;
  }>;
  agentLeaderboard: Array<{
    agent_name: string;
    avg_overall: number;
    avg_compliance: number;
    total_calls: number;
    rank: number;
  }>;
  recentViolations: Array<{
    id: string;
    label: string;
    severity: string;
    category: string;
    violation_type: string | null;
    regulation: string | null;
    transcript_fragment: string | null;
    coaching_note: string | null;
    suggested_correction: string | null;
    interaction_id: string | null;
    agent_name: string | null;
    created_at: string;
  }>;
  callsByDay: Array<{ date: string; count: number; avg_score: number | null }>;
  riskDistribution: {
    critical: number;
    high: number;
    medium: number;
    low: number;
    unknown: number;
  };
}

// ─── Row shapes returned by the parallel Supabase queries ────────────────────

export type EvalRow = {
  id: string;
  interaction_id: string;
  overall_score: number;
  compliance_score: number | null;
  sales_score: number | null;
  soft_skills_score: number | null;
  conversation_score: number | null;
};

export type FlagRow = {
  id: string;
  severity: string;
  violation_type: string | null;
  category: string;
};

export type InteractionWithEvals = {
  id: string;
  agent_name: string;
  agent_id: string | null;
  qac_evaluations: Array<{
    overall_score: number;
    compliance_score: number | null;
    risk_score: number;
  }> | null;
};

export type AgentAccum = {
  name: string;
  total_calls: number;
  overall_sum: number;
  overall_count: number;
  compliance_sum: number;
  compliance_count: number;
  risk_sum: number;
};

export type FlagWithRelations = {
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

export type InteractionDayRow = {
  id: string;
  agent_name: string;
  risk_level: string;
  created_at: string;
  status: string;
};

export type RiskRow = { risk_level: string };
