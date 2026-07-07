export interface CoachingDetail {
  id: string;
  agent_id: string | null;
  priority_score: number;
  strengths: string[] | null;
  weaknesses: string[] | null;
  recommended_training: string[] | null;
  coaching_plan: string | null;
  created_at: string;
  agent_profile: {
    id: string;
    name: string;
    email: string | null;
    team: string | null;
    role: string | null;
  } | null;
  qac_interactions: {
    id: string;
    agent_name: string;
    channel: string;
    duration_s: number | null;
    created_at: string;
    risk_level: string | null;
    customer_name: string | null;
    review_status: string;
    qac_evaluations: Array<{
      overall_score: number | null;
      compliance_score: number | null;
      sales_score: number | null;
      soft_skills_score: number | null;
      summary: string | null;
      coaching_summary: string | null;
    }>;
  } | null;
}

export type Interaction = NonNullable<CoachingDetail["qac_interactions"]>;
export type Evaluation = Interaction["qac_evaluations"][number];
