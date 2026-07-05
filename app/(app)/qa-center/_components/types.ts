/** Shared types for the QA Center page and its panels. */

export interface QACFlag {
  id: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  label: string;
  transcript_fragment?: string;
  regulation?: string;
  coaching_note?: string;
  timestamp_s?: number;
}

export interface QACEvaluation {
  id: string;
  overall_score: number;
  risk_score: number;
  tone: string;
  summary: string;
  criteria_scores: {
    opening: number;
    compliance: number;
    objection_handling: number;
    closing: number;
    empathy: number;
  };
  rules_applied: number;
  evaluated_at: string;
  qac_flags: QACFlag[];
}

export interface QACInteraction {
  id: string;
  agent_name: string;
  agent_id: string | null;
  channel: string;
  duration_s: number | null;
  status: "pending" | "analyzing" | "analyzed" | "failed";
  created_at: string;
  qac_evaluations: QACEvaluation[];
}

export interface QACRule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  regulation: string | null;
  is_active: boolean;
  created_at: string;
}

export interface QACStats {
  totalInteractions: number;
  analyzedInteractions: number;
  pendingInteractions: number;
  avgOverallScore: number | null;
  avgRiskScore: number | null;
  complianceRate: number | null;
  totalFlags: number;
  flagsBySeverity: {
    low: number;
    medium: number;
    high: number;
    critical: number;
  };
  flagsByCategory: {
    compliance: number;
    quality: number;
    disclosure: number;
    prohibited: number;
    coaching: number;
  };
  topRiskAgents: { name: string; interactions: number; avg_risk: number }[];
}

export interface ViolationsStats {
  total: number;
  critical: number;
  warning: number;
  topRules: { rule_name: string; count: number }[];
  topAgents: { agent_name: string; count: number }[];
}
