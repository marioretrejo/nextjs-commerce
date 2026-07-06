export interface AssistAlert {
  id: string;
  type: "danger" | "warning" | "info" | "opportunity";
  message: string;
  action_suggestion?: string;
  timestamp: Date;
}

export interface AssistResponse {
  alerts: {
    type: "danger" | "warning" | "info" | "opportunity";
    message: string;
    action_suggestion?: string;
  }[];
  suggested_response?: string;
  compliance_risk: "none" | "low" | "medium" | "high";
  coaching_tip?: string;
  key_topics?: string[];
}

export type ComplianceRisk = "none" | "low" | "medium" | "high";
