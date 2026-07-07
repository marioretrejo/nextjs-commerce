import type { createAdminClient } from "@/lib/supabase/admin";

export type Admin = ReturnType<typeof createAdminClient>;

// ─── Diarized transcript type (mirrors webhooks/[token]/route.ts) ─────────────

export interface DiarizedTranscript {
  provider: "deepgram";
  model: "nova-3";
  language: string;
  utterances: Array<{
    speaker: string;
    speaker_type: "unknown";
    text: string;
    start_ms: number;
    end_ms: number;
    confidence: number;
  }>;
}

// ─── Dimension result types ───────────────────────────────────────────────────

export interface ComplianceResult {
  violations: Array<{
    type:
      | "promise"
      | "misleading"
      | "unauthorized_claim"
      | "missing_disclosure"
      | "prohibited_word"
      | "risk_statement";
    severity: "low" | "medium" | "high" | "critical";
    speaker: "agent" | "customer" | "unknown" | null;
    timestamp_s: number | null;
    snippet: string;
    regulation: string | null;
    explanation: string;
    suggested_correction: string;
  }>;
  score: number; // 0-100 higher = better (few / no violations)
}

export interface SalesResult {
  objection_handling: number;
  closing_ability: number;
  discovery_quality: number;
  overall: number;
  key_sales_moments: string[];
}

export interface SoftSkillsResult {
  empathy: number;
  active_listening: number;
  professionalism: number;
  tone: "positive" | "neutral" | "negative";
  overall: number;
}

export interface ConversationResult {
  engagement: number;
  flow: number;
  interruptions_count: number;
  dead_air_count: number;
  overall: number;
}

export interface SummaryResult {
  summary: string;
  customer_intent: string;
  outcome: string;
  objections: string[];
  key_moments: string[];
  sentiment_timeline: Array<{
    at_percent: number;
    sentiment: "positive" | "neutral" | "negative";
    note: string;
  }>;
  overall_sentiment: "positive" | "neutral" | "negative";
}

export interface CoachingResult {
  strengths: string[];
  weaknesses: string[];
  opportunities: string[];
  recommended_training: string[];
  coaching_plan: string;
  priority_score: number;
}

export interface CommitmentItem {
  committed_by: "agent" | "customer";
  text: string;
  due_date: string | null;
}

export interface CommitmentsResult {
  items: CommitmentItem[];
}

// ─── Rule types ───────────────────────────────────────────────────────────────

export interface QACRule {
  name: string;
  description: string;
  category: string;
  severity: string;
  regulation: string | null;
}

export interface ViolationRule {
  id: string;
  name: string;
  description: string;
  alert_severity: string;
  examples: unknown;
  counter_examples: unknown;
}

export interface ViolationResultItem {
  rule_name: string;
  fragment: string;
  timestamp_seconds: number | null;
  severity: "critical" | "warning";
  confidence: number;
  explanation: string;
}

export interface ViolationResult {
  violations: ViolationResultItem[];
}

// ─── Interaction row ──────────────────────────────────────────────────────────

export type InteractionRow = {
  id: string;
  workspace_id: string;
  transcript: string;
  diarized_transcript: unknown;
  status: string;
  agent_id: string | null;
  agent_name: string;
  customer_id: string | null;
  department_id: string | null;
};
