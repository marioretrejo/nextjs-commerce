export interface AgentMetrics {
  call_count: number;
  avg_score: number;
  avg_compliance: number;
  avg_sales: number;
  avg_soft_skills: number;
  avg_risk: number;
  last_call_at: string | null;
  improvement_trend: "up" | "down" | "stable";
}

export interface Agent {
  id: string;
  agent_id: string;
  name: string;
  email: string | null;
  team: string | null;
  role: string | null;
  hire_date: string | null;
  is_active: boolean;
  created_at: string;
  metrics: AgentMetrics;
}

export interface CreateAgentForm {
  agent_id: string;
  name: string;
  email: string;
  team: string;
  role: string;
  hire_date: string;
}
