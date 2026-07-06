export interface AgentProfile {
  id: string;
  agent_id: string;
  name: string;
  email: string | null;
  team: string | null;
  role: string | null;
  hire_date: string | null;
  is_active: boolean;
  created_at: string;
  metrics: {
    call_count: number;
    avg_score: number;
    avg_compliance: number;
    avg_sales: number;
    avg_soft_skills: number;
    avg_risk: number;
    last_call_at: string | null;
    improvement_trend: "up" | "down" | "stable";
  };
  score_trend: Array<{ date: string; score: number }>;
  recent_calls: CallItem[];
  coaching_reports: CoachingItem[];
}

export interface CallItem {
  id: string;
  created_at: string;
  channel: string;
  duration_s: number | null;
  risk_level: string | null;
  review_status: string;
  overall_score: number | null;
  compliance_score: number | null;
  sales_score: number | null;
  soft_skills_score: number | null;
}

export interface CoachingItem {
  id: string;
  created_at: string;
  priority: string;
  strengths: string[] | null;
  improvements: string[] | null;
  qac_interactions?: { created_at: string; channel: string } | null;
}

export type Tab = "overview" | "calls" | "coaching" | "performance";
