-- QA Forbidden Rules: Detect violations using keywords, semantic matching, and regex
-- Detects both exact matches and interpretations (e.g., "guaranteed returns" vs "vas a ganar seguro")

CREATE TABLE qa_forbidden_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  department_id uuid REFERENCES qa_departments(id) ON DELETE SET NULL,

  name text NOT NULL,
  description text,

  -- Severity: low, medium, high, critical
  severity text NOT NULL DEFAULT 'medium',

  -- Detection method: 'keyword', 'semantic', 'regex', 'combined'
  match_type text NOT NULL DEFAULT 'keyword',

  -- Patterns: array of strings to match
  -- Examples: ["guaranteed", "without risk", "vas a ganar seguro", "dinero asegurado"]
  patterns text[] NOT NULL DEFAULT '{}',

  -- For semantic detection: Claude prompt to detect interpretations
  -- Example: "Detect if the agent promised guaranteed returns or guaranteed profits to the client"
  interpretation_prompt text,

  -- Alert settings
  alert_enabled boolean DEFAULT true,

  -- Auto-block call?: false = flag only, true = block call from processing
  auto_block_enabled boolean DEFAULT false,

  -- Workflow: cascade action if rule triggered
  -- e.g., 'notify_qa_manager', 'escalate', 'flag_for_review', 'stop_analysis'
  action_on_trigger text DEFAULT 'notify_qa_manager',

  -- Custom metadata (tags, notes, examples)
  metadata jsonb DEFAULT '{}',

  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_match_type CHECK (match_type IN ('keyword', 'semantic', 'regex', 'combined')),
  CONSTRAINT valid_action CHECK (
    action_on_trigger IN ('notify_qa_manager', 'escalate', 'flag_for_review', 'stop_analysis', 'suspend_agent')
  )
);

CREATE INDEX idx_qa_rules_workspace ON qa_forbidden_rules(workspace_id);
CREATE INDEX idx_qa_rules_department ON qa_forbidden_rules(department_id);
CREATE INDEX idx_qa_rules_active ON qa_forbidden_rules(workspace_id, is_active);
CREATE INDEX idx_qa_rules_severity ON qa_forbidden_rules(severity);

-- Rule version history for audit
CREATE TABLE qa_forbidden_rules_versions (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  rule_id uuid NOT NULL REFERENCES qa_forbidden_rules(id) ON DELETE CASCADE,
  version_number integer NOT NULL,
  patterns text[] NOT NULL,
  interpretation_prompt text,
  severity text NOT NULL,
  match_type text NOT NULL,
  changed_at timestamp with time zone DEFAULT now(),
  changed_by uuid REFERENCES auth.users(id)
);

CREATE INDEX idx_qa_rules_versions_rule ON qa_forbidden_rules_versions(rule_id);
