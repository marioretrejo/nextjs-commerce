// QA Center scoring logic

import type { QADepartment, QAAlert } from "@/lib/supabase/types";
import { DEFAULT_SCORING_WEIGHTS, type ScoringWeights } from "./types";

/**
 * Calculate contextual score for a journey
 * Considers: individual call scores, sequence outcomes, final conversion
 */
export function calculateJourneyScore(
  individualScores: number[],
  hasPositiveOutcome: boolean,
  callCount: number
): number {
  if (individualScores.length === 0) return 0;

  // Base average of individual scores
  const avgScore = individualScores.reduce((a, b) => a + b) / individualScores.length;

  // Boost if journey had positive outcome
  const outcomeMultiplier = hasPositiveOutcome ? 1.15 : 1.0;

  // Reduce score if journey took too many attempts
  const attemptsMultiplier = callCount > 5 ? 0.9 : 1.0;

  // Final calculation
  const contextualScore = avgScore * outcomeMultiplier * attemptsMultiplier;

  return Math.min(100, Math.max(0, contextualScore));
}

/**
 * Calculate weighted score from multiple dimensions
 */
export function calculateWeightedScore(
  dimensions: {
    communication?: number; // 0-100
    empathy?: number;
    outcome?: number;
    compliance?: number;
  },
  weights: Partial<ScoringWeights> = DEFAULT_SCORING_WEIGHTS
): number {
  const w = { ...DEFAULT_SCORING_WEIGHTS, ...weights };
  const scores: number[] = [];
  const weights_: number[] = [];

  if (dimensions.communication !== undefined) {
    scores.push(dimensions.communication);
    weights_.push(w.communication);
  }
  if (dimensions.empathy !== undefined) {
    scores.push(dimensions.empathy);
    weights_.push(w.empathy);
  }
  if (dimensions.outcome !== undefined) {
    scores.push(dimensions.outcome);
    weights_.push(w.outcome);
  }
  if (dimensions.compliance !== undefined) {
    scores.push(dimensions.compliance);
    weights_.push(w.compliance);
  }

  if (scores.length === 0) return 0;

  const totalWeight = weights_.reduce((a, b) => a + b);
  const weightedSum = scores.reduce((sum, score, i) => sum + score * weights_[i], 0);

  return Math.round((weightedSum / totalWeight) * 100) / 100;
}

/**
 * Determine alert severity and actionability based on score
 */
export function getSeverityFromScore(score: number, threshold: number): string {
  if (score <= threshold) return "critical";
  if (score <= threshold + 10) return "high";
  if (score <= threshold + 20) return "medium";
  return "low";
}

/**
 * Check if a call should be flagged for review
 */
export function shouldFlagForReview(
  score: number | null,
  hasAlerts: boolean,
  complianceIssues: number
): boolean {
  if (!score) return hasAlerts || complianceIssues > 0;
  if (score < 50) return true;
  if (hasAlerts && score < 70) return true;
  if (complianceIssues > 1) return true;
  return false;
}

/**
 * Generate coaching recommendation based on score breakdown
 */
export function generateCoachingRecommendation(dimensions: {
  communication?: number;
  empathy?: number;
  outcome?: number;
  compliance?: number;
}): string[] {
  const recommendations: string[] = [];

  if ((dimensions.communication ?? 75) < 60) {
    recommendations.push("Focus on clear, concise communication");
    recommendations.push("Practice active listening and confirmation");
  }

  if ((dimensions.empathy ?? 75) < 60) {
    recommendations.push("Improve empathetic tone and customer understanding");
    recommendations.push("Acknowledge customer concerns before responding");
  }

  if ((dimensions.outcome ?? 75) < 60) {
    recommendations.push("Work on call closing and follow-up techniques");
    recommendations.push("Track customer objections and practice rebuttals");
  }

  if ((dimensions.compliance ?? 75) < 60) {
    recommendations.push("Review compliance requirements for your department");
    recommendations.push("Study required disclosures and regulatory guidelines");
  }

  if (recommendations.length === 0) {
    recommendations.push("Continue excellent work; maintain current performance");
  }

  return recommendations;
}

/**
 * Calculate agent scorecard summary
 */
export function calculateAgentScorecard(
  callScores: number[],
  journeyScores: (number | null)[],
  alertCount: number,
  criticalAlertCount: number
): {
  avgCallScore: number;
  avgJourneyScore: number;
  improvementTrend: "improving" | "stable" | "declining";
  riskLevel: "low" | "medium" | "high" | "critical";
  healthPercentage: number;
} {
  const avgCall = callScores.length > 0 ? callScores.reduce((a, b) => a + b) / callScores.length : 0;
  const validJourneyScores = journeyScores.filter((s) => s !== null && s !== undefined) as number[];
  const avgJourney = validJourneyScores.length > 0 ? validJourneyScores.reduce((a, b) => a + b) / validJourneyScores.length : 0;

  // Determine risk level
  let riskLevel: "low" | "medium" | "high" | "critical" = "low";
  if (criticalAlertCount > 0) riskLevel = "critical";
  else if (criticalAlertCount > 0 || alertCount > 10) riskLevel = "high";
  else if (alertCount > 5) riskLevel = "medium";

  // Health percentage (combination of score and alerts)
  const scoreHealth = (avgCall + avgJourney) / 2;
  const alertHealth = Math.max(0, 100 - alertCount * 3);
  const healthPercentage = (scoreHealth * 0.7 + alertHealth * 0.3);

  return {
    avgCallScore: Math.round(avgCall * 100) / 100,
    avgJourneyScore: Math.round(avgJourney * 100) / 100,
    improvementTrend: "stable",
    riskLevel,
    healthPercentage: Math.round(healthPercentage),
  };
}
