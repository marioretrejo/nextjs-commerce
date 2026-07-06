export interface ScoringRubric {
  compliance: number;
  sales: number;
  soft_skills: number;
  conversation: number;
}

export interface Department {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  qa_prompt: string | null;
  scoring_rubric: ScoringRubric;
  critical_criteria: string[];
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Extension {
  id: string;
  agent_extension: string;
  agent_name: string | null;
  created_at: string;
}

export interface FormData {
  name: string;
  slug: string;
  description: string;
  qa_prompt: string;
  compliance: number;
  sales: number;
  soft_skills: number;
  conversation: number;
  critical_criteria: string[];
  is_active: boolean;
}
