export interface Interaction {
  id: string;
  agent_name: string | null;
  channel: string | null;
  duration_s: number | null;
  created_at: string;
  risk_level: string | null;
  review_status: string | null;
  qac_evaluations: { overall_score: number | null }[] | null;
}

export interface JourneyEntry {
  id: string;
  thread_id: string | null;
  interaction_id: string | null;
  sequence_number: number;
  intent_at_call: string | null;
  sentiment_at_call: string | null;
  key_topics: string[] | null;
  unresolved_items: string[] | null;
  created_at: string;
}

export interface Insight {
  id: string;
  thread_id: string | null;
  insight_type: string | null;
  content: string;
  confidence: number | null;
  generated_at: string;
  expires_at: string | null;
}

export interface CustomerScores {
  health_score: number;
  call_quality_score: number | null;
  sentiment_trend: "improving" | "stable" | "declining" | "unknown";
  unresolved_pressure: number;
  engagement_score: number;
  customer_risk: "low" | "medium" | "high" | "critical";
}

export interface Commitment {
  id: string;
  committed_by: "agent" | "customer";
  commitment_text: string;
  due_date: string | null;
  status: "pending" | "fulfilled" | "missed" | "cancelled";
  fulfilled_at: string | null;
  created_at: string;
}

export interface CustomerDetail {
  id: string;
  display_name: string;
  canonical_phone: string | null;
  canonical_email: string | null;
  total_calls: number;
  lifetime_sentiment: string | null;
  first_seen_at: string;
  last_seen_at: string;
  notes: string | null;
  recent_interactions: Interaction[];
  journey: JourneyEntry[];
  insights: Insight[];
  commitments: Commitment[];
  scores: CustomerScores;
}
