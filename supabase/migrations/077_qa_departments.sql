-- QA Departments: Configure QA by department with custom prompts and rules
-- Each department can have different scoring logic, compliance rules, and alert thresholds

CREATE TABLE qa_departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,

  -- Department type: 'conversión', 'retención', 'soporte', 'ventas', 'cobros', 'compliance', 'other'
  department_type text DEFAULT 'other',

  -- Scoring prompt: Claude analyzes calls using this department-specific prompt
  scoring_prompt text NOT NULL DEFAULT 'You are an expert QA analyst. Score the call based on professional communication, empathy, and outcome achievement.',

  -- Compliance prompt: Detect violations specific to this department
  compliance_prompt text,

  -- Coaching prompt: Generate personalized coaching recommendations
  coaching_prompt text,

  -- Forbidden terms/patterns detection prompt
  forbidden_terms_prompt text,

  -- Scoring weights (JSON): customize how different factors affect the score
  -- { "communication": 0.25, "empathy": 0.25, "outcome": 0.3, "compliance": 0.2 }
  scoring_weights jsonb DEFAULT '{"communication": 0.25, "empathy": 0.25, "outcome": 0.3, "compliance": 0.2}'::jsonb,

  -- Alert settings
  telegram_alert_enabled boolean DEFAULT false,
  telegram_chat_id text,

  -- Risk thresholds
  critical_score_threshold numeric(5, 2) DEFAULT 40, -- Score below this = critical alert
  high_risk_keywords_enabled boolean DEFAULT true,

  -- Custom metadata
  metadata jsonb DEFAULT '{}',

  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(workspace_id, name),
  CONSTRAINT valid_telegram_id CHECK (
    (telegram_alert_enabled = false) OR (telegram_chat_id IS NOT NULL)
  )
);

CREATE INDEX idx_qa_departments_workspace ON qa_departments(workspace_id);
CREATE INDEX idx_qa_departments_type ON qa_departments(workspace_id, department_type);

-- Audit log for department changes
CREATE TABLE qa_department_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid NOT NULL REFERENCES qa_departments(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id),
  changes jsonb NOT NULL, -- { "field": "scoring_weights", "old": {...}, "new": {...} }
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_qa_department_audit_dept ON qa_department_audit(department_id);
CREATE INDEX idx_qa_department_audit_date ON qa_department_audit(created_at DESC);
