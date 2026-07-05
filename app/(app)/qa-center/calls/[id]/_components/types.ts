/** Shared types for the call-review page and its panels. */

export interface QACFlag {
  id: string;
  category: string;
  severity: "low" | "medium" | "high" | "critical";
  label: string;
  transcript_fragment?: string | null;
  regulation?: string | null;
  coaching_note?: string | null;
  timestamp_s?: number | null;
  suggested_correction?: string | null;
  violation_type?: string | null;
}

export interface CriteriaScores {
  opening: number;
  compliance: number;
  objection_handling: number;
  closing: number;
  empathy: number;
}

export interface KeyMoment {
  timestamp_pct?: number;
  timestamp_s?: number;
  type: string;
  description: string;
}

export interface SentimentPoint {
  position: number;
  sentiment: "positive" | "neutral" | "negative";
  label?: string;
}

export interface CoachingInsights {
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  recommended_training?: string[];
  coaching_plan?: string;
}

export interface QACEvaluation {
  id: string;
  overall_score: number;
  risk_score: number;
  tone: string;
  summary: string;
  criteria_scores: CriteriaScores;
  rules_applied: number;
  evaluated_at: string;
  key_moments?: KeyMoment[];
  sentiment_timeline?: SentimentPoint[];
  coaching_insights?: CoachingInsights;
  qac_flags: QACFlag[];
}

export interface QACInteraction {
  id: string;
  agent_name: string;
  agent_id: string | null;
  channel: string;
  direction?: string | null;
  duration_s: number | null;
  status: "pending" | "analyzing" | "analyzed" | "failed";
  created_at: string;
  language?: string | null;
  customer_id?: string | null;
  customer_name?: string | null;
  campaign?: string | null;
  transcript?: string | null;
  diarized_transcript?: unknown;
  audio_url?: string | null;
  metadata?: Record<string, unknown>;
  review_status: string;
  reviewer_notes?: string | null;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  approved_by?: string | null;
  approved_at?: string | null;
  qac_evaluations: QACEvaluation[];
}

export interface ComplianceViolation {
  id: string;
  severity: "critical" | "warning";
  rule_name: string;
  fragment: string | null;
  confidence: number | null;
  is_false_positive: boolean;
  created_at: string;
}

export interface QACComment {
  id: string;
  comment: string;
  user_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface QACAuditLog {
  id: string;
  action: string;
  entity_type: string;
  entity_id: string | null;
  details: Record<string, unknown> | null;
  user_id: string | null;
  created_at: string;
}

export interface QACDiarizedTranscriptSegment {
  speaker?: string | null;
  text?: string | null;
  start_ms?: number | null;
  end_ms?: number | null;
  confidence?: number | null;
}
