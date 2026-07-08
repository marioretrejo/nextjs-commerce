export const QAC_PROVIDER_TYPES = [
  "squaretalk",
  "twilio",
  "aircall",
  "ringcentral",
  "generic",
] as const;

export type QacProviderType = (typeof QAC_PROVIDER_TYPES)[number];

export const QAC_ANALYSIS_STATUSES = [
  "pending_cdr",
  "pending_audio",
  "audio_ready",
  "transcribing",
  "transcribed",
  "analyzing",
  "analyzed",
  "not_evaluable",
  "failed_audio",
  "failed_transcription",
  "failed_analysis",
  "manual_review_required",
] as const;

export type QacAnalysisStatus = (typeof QAC_ANALYSIS_STATUSES)[number];

export const QAC_REVIEW_STATUSES = [
  "pending_review",
  "in_review",
  "reviewed",
  "approved",
  "disputed",
] as const;

export type QacReviewStatus = (typeof QAC_REVIEW_STATUSES)[number];

export type JsonRecord = Record<string, unknown>;

export interface NormalizedCdrCall {
  provider: string;
  external_call_id: string | null;
  agent_name: string | null;
  agent_extension: string | null;
  external_agent_id: string | null;
  agent_email: string | null;
  department_name: string | null;
  caller_id: string | null;
  prospect_id: string | null;
  recording_url: string | null;
  recording_base64: string | null;
  transcript: string | null;
  duration_seconds: number | null;
  direction: "inbound" | "outbound" | "internal" | "unknown" | null;
  disposition: string | null;
  call_started_at: string | null;
  call_ended_at: string | null;
  raw_payload: JsonRecord;
}

export interface QacCriterion {
  id: string;
  category: string;
  name: string;
  description: string | null;
  weight: number;
  is_critical: boolean;
  applicability_rule: string | null;
  pass_definition: string | null;
  partial_definition: string | null;
  fail_definition: string | null;
  na_definition: string | null;
  examples_json: unknown;
  sort_order: number;
}

export interface QacCriterionResultInput {
  criterion_id: string;
  applicable: boolean;
  result: "pass" | "partial" | "fail" | "n/a";
  score: number | null;
  reason: string | null;
  evidence_json: unknown[];
}

export interface QacScoreResult {
  overallScore: number | null;
  notEvaluable: boolean;
  applicableWeight: number;
  earnedPoints: number;
  results: QacCriterionResultInput[];
}
