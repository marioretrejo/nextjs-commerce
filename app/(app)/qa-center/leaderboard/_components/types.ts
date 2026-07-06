export interface AgentLeaderboardEntry {
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

export interface DashboardData {
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
  flagsByCategory: Record<string, number>;
  topRiskAgents: { name: string; interactions: number; avg_risk: number }[];
  agentLeaderboard?: AgentLeaderboardEntry[];
}

export type SortKey =
  | "name"
  | "interactions"
  | "avg_overall"
  | "avg_risk"
  | "compliance_rate"
  | "avg_sales"
  | "avg_soft_skills"
  | "avg_compliance";
export type SortDir = "asc" | "desc";
export type DateRange = "7d" | "30d" | "90d";
