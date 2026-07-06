import type { FormData } from "./types";

export const CRITERIA_KEYS = [
  "compliance",
  "sales",
  "soft_skills",
  "conversation",
] as const;
export type CriteriaKey = (typeof CRITERIA_KEYS)[number];

export const CRITERIA_LABELS: Record<CriteriaKey, string> = {
  compliance: "Compliance",
  sales: "Ventas",
  soft_skills: "Habilidades Sociales",
  conversation: "Conversación",
};

export const DEFAULT_FORM: FormData = {
  name: "",
  slug: "",
  description: "",
  qa_prompt: "",
  compliance: 40,
  sales: 25,
  soft_skills: 20,
  conversation: 15,
  critical_criteria: [],
  is_active: true,
};
