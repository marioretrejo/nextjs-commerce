// QA Center type definitions and constants

export type AlertSeverity = "low" | "medium" | "high" | "critical";
export type RuleMatchType = "keyword" | "semantic" | "regex" | "combined";
export type DepartmentType =
  | "conversión"
  | "retención"
  | "soporte"
  | "ventas"
  | "cobros"
  | "compliance"
  | "other";
export type JourneyOutcome =
  | "converted"
  | "pending"
  | "rejected"
  | "callback_requested"
  | "abandoned";
export type RoleInJourney =
  | "first_touch"
  | "follow_up"
  | "closing_call"
  | "support_call"
  | "other";

export const ROLE_DESCRIPTIONS: Record<string, string> = {
  first_touch: "Initial contact with customer",
  follow_up: "Subsequent call in journey",
  closing_call: "Call that resulted in conversion or final outcome",
  support_call: "Support or technical assistance",
  other: "Other type of call",
};

export const SEVERITY_COLORS = {
  low: "#10B981", // green
  medium: "#F59E0B", // amber
  high: "#EF4444", // red
  critical: "#991B1B", // dark red
};

export const DEPARTMENT_DEFAULTS: Record<
  DepartmentType,
  Partial<{
    scoring_prompt: string;
    compliance_prompt: string;
    coaching_prompt: string;
    critical_score_threshold: number;
  }>
> = {
  conversión: {
    scoring_prompt:
      "Evaluate the call for conversion effectiveness. Score based on qualification, engagement, objection handling, and closing technique.",
    compliance_prompt:
      "Detect any illegal promises, misrepresentations, or pressure tactics. Flag guaranteed returns, unrealistic expectations.",
    critical_score_threshold: 40,
  },
  retención: {
    scoring_prompt:
      "Evaluate customer retention effectiveness. Score based on empathy, problem-solving, relationship building, and retention technique.",
    compliance_prompt:
      "Detect inappropriate pressure to stay or excessive incentive offers.",
    critical_score_threshold: 50,
  },
  soporte: {
    scoring_prompt:
      "Evaluate technical support quality. Score based on issue resolution, clarity of explanation, and customer satisfaction indicators.",
    compliance_prompt: "Detect rude or dismissive behavior toward customers.",
    critical_score_threshold: 45,
  },
  ventas: {
    scoring_prompt:
      "Evaluate sales effectiveness. Score based on needs discovery, product fit, value communication, and closing.",
    compliance_prompt:
      "Detect pressure selling, misleading claims, or incomplete disclosures.",
    critical_score_threshold: 35,
  },
  cobros: {
    scoring_prompt:
      "Evaluate collection call quality. Score based on professionalism, negotiation, and ethical collection practices.",
    compliance_prompt: "Detect harassment, threats, or FDCPA violations.",
    critical_score_threshold: 30,
  },
  compliance: {
    scoring_prompt:
      "Evaluate compliance adherence. Score based on required disclosures, documentation, and policy adherence.",
    compliance_prompt:
      "Detect missing disclaimers, improper recordings, or regulatory violations.",
    critical_score_threshold: 25,
  },
  other: {
    scoring_prompt:
      "Score this call based on professional communication, customer satisfaction, and business outcome.",
    critical_score_threshold: 40,
  },
};

export interface ScoringWeights {
  communication: number; // 0.0-1.0
  empathy: number;
  outcome: number;
  compliance: number;
}

export const DEFAULT_SCORING_WEIGHTS: ScoringWeights = {
  communication: 0.25,
  empathy: 0.25,
  outcome: 0.3,
  compliance: 0.2,
};
