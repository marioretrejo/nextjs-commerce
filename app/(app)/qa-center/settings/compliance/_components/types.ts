/** Compliance-rule types + empty-form factory. */

export interface QACRule {
  id: string;
  name: string;
  description: string;
  category: string;
  severity: string;
  regulation: string | null;
  scope: string;
  department_id: string | null;
  alert_severity: string;
  examples: string[];
  counter_examples: string[];
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface Department {
  id: string;
  name: string;
  slug: string;
  is_active: boolean;
}

export interface RuleFormState {
  name: string;
  description: string;
  category: string;
  severity: string;
  regulation: string;
  alert_severity: string;
  examples: string[];
  counter_examples: string[];
  is_active: boolean;
}

export const emptyForm = (): RuleFormState => ({
  name: "",
  description: "",
  category: "compliance",
  severity: "medium",
  regulation: "",
  alert_severity: "warning",
  examples: [],
  counter_examples: [],
  is_active: true,
});
