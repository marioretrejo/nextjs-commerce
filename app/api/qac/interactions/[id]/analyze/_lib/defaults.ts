import type {
  ComplianceResult,
  SalesResult,
  SoftSkillsResult,
  ConversationResult,
  SummaryResult,
  CoachingResult,
} from "./types";

// ─── Defaults (used when a parallel call fails) ───────────────────────────────

export const defaultCompliance = (): ComplianceResult => ({
  violations: [],
  score: 70,
});
export const defaultSales = (): SalesResult => ({
  objection_handling: 70,
  closing_ability: 70,
  discovery_quality: 70,
  overall: 70,
  key_sales_moments: [],
});
export const defaultSoftSkills = (): SoftSkillsResult => ({
  empathy: 70,
  active_listening: 70,
  professionalism: 70,
  tone: "neutral",
  overall: 70,
});
export const defaultConversation = (): ConversationResult => ({
  engagement: 70,
  flow: 70,
  interruptions_count: 0,
  dead_air_count: 0,
  overall: 70,
});
export const defaultSummary = (): SummaryResult => ({
  summary: "Analysis unavailable.",
  customer_intent: "Unknown",
  outcome: "other",
  objections: [],
  key_moments: [],
  sentiment_timeline: [],
  overall_sentiment: "neutral",
});
export const defaultCoaching = (): CoachingResult => ({
  strengths: [],
  weaknesses: [],
  opportunities: [],
  recommended_training: [],
  coaching_plan: "Coaching unavailable.",
  priority_score: 0,
});

// ─── Score calculation ────────────────────────────────────────────────────────

export function calcOverallScore(
  c: number,
  s: number,
  sk: number,
  cv: number,
): number {
  return Math.round(c * 0.4 + s * 0.25 + sk * 0.2 + cv * 0.15);
}

export function calcRiskLevel(
  overall: number,
): "critical" | "high" | "medium" | "low" {
  if (overall < 50) return "critical";
  if (overall < 65) return "high";
  if (overall < 80) return "medium";
  return "low";
}
