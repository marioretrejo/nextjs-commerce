-- QA Center v2 Phase 1 - ALL MIGRATIONS COMBINED
-- Execute this file as a single transaction in Supabase SQL Editor
-- URL: https://supabase.com/dashboard/project/blyzfuwwxwpuihrjdpuh/sql/new

-- ============================================================================
-- MIGRATION 076: Customer Journeys
-- ============================================================================

CREATE TABLE qa_customer_journeys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_phone text NOT NULL,
  contact_name text,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  department text,
  first_call_at timestamp with time zone,
  last_call_at timestamp with time zone,
  total_calls integer DEFAULT 0,
  final_outcome text,
  final_score numeric(5, 2),
  journey_summary text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(workspace_id, contact_phone, agent_id, COALESCE(department, '')),
  CONSTRAINT valid_phone CHECK (contact_phone ~ '^\+?[0-9\s\-\(\)]{7,}$')
);

CREATE INDEX idx_qa_journeys_workspace ON qa_customer_journeys(workspace_id);
CREATE INDEX idx_qa_journeys_phone ON qa_customer_journeys(workspace_id, contact_phone);
CREATE INDEX idx_qa_journeys_agent ON qa_customer_journeys(workspace_id, agent_id);
CREATE INDEX idx_qa_journeys_department ON qa_customer_journeys(workspace_id, department);
CREATE INDEX idx_qa_journeys_updated ON qa_customer_journeys(updated_at DESC);

CREATE TABLE qa_journey_calls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  journey_id uuid NOT NULL REFERENCES qa_customer_journeys(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  sequence_index integer NOT NULL,
  role_in_journey text NOT NULL,
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(journey_id, call_id),
  CONSTRAINT valid_role CHECK (
    role_in_journey IN ('first_touch', 'follow_up', 'closing_call', 'support_call', 'other')
  )
);

CREATE INDEX idx_qa_journey_calls_journey ON qa_journey_calls(journey_id);
CREATE INDEX idx_qa_journey_calls_call ON qa_journey_calls(call_id);

CREATE OR REPLACE FUNCTION update_journey_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE qa_customer_journeys
  SET updated_at = now()
  WHERE id = NEW.journey_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_journey_call_update
AFTER INSERT OR UPDATE ON qa_journey_calls
FOR EACH ROW
EXECUTE FUNCTION update_journey_timestamps();

-- ============================================================================
-- MIGRATION 077: Departments
-- ============================================================================

CREATE TABLE qa_departments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  department_type text DEFAULT 'other',
  scoring_prompt text NOT NULL DEFAULT 'You are an expert QA analyst. Score the call based on professional communication, empathy, and outcome achievement.',
  compliance_prompt text,
  coaching_prompt text,
  forbidden_terms_prompt text,
  scoring_weights jsonb DEFAULT '{"communication": 0.25, "empathy": 0.25, "outcome": 0.3, "compliance": 0.2}'::jsonb,
  telegram_alert_enabled boolean DEFAULT false,
  telegram_chat_id text,
  critical_score_threshold numeric(5, 2) DEFAULT 40,
  high_risk_keywords_enabled boolean DEFAULT true,
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

CREATE TABLE qa_department_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  department_id uuid NOT NULL REFERENCES qa_departments(id) ON DELETE CASCADE,
  changed_by uuid REFERENCES auth.users(id),
  changes jsonb NOT NULL,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_qa_department_audit_dept ON qa_department_audit(department_id);
CREATE INDEX idx_qa_department_audit_date ON qa_department_audit(created_at DESC);

-- ============================================================================
-- MIGRATION 078: Forbidden Rules
-- ============================================================================

CREATE TABLE qa_forbidden_rules (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  department_id uuid REFERENCES qa_departments(id) ON DELETE SET NULL,
  name text NOT NULL,
  description text,
  severity text NOT NULL DEFAULT 'medium',
  match_type text NOT NULL DEFAULT 'keyword',
  patterns text[] NOT NULL DEFAULT '{}',
  interpretation_prompt text,
  alert_enabled boolean DEFAULT true,
  auto_block_enabled boolean DEFAULT false,
  action_on_trigger text DEFAULT 'notify_qa_manager',
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

-- ============================================================================
-- MIGRATION 079: Alerts
-- ============================================================================

CREATE TABLE qa_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  journey_id uuid REFERENCES qa_customer_journeys(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  department_id uuid REFERENCES qa_departments(id) ON DELETE SET NULL,
  rule_id uuid REFERENCES qa_forbidden_rules(id) ON DELETE SET NULL,
  severity text NOT NULL DEFAULT 'medium',
  title text NOT NULL,
  summary text NOT NULL,
  transcript_excerpt text,
  timestamp_seconds integer,
  timestamp_label text,
  status text NOT NULL DEFAULT 'open',
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at timestamp with time zone,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamp with time zone,
  resolution_notes text,
  telegram_sent boolean DEFAULT false,
  telegram_message_id text,
  telegram_retry_count integer DEFAULT 0,
  telegram_last_retry_at timestamp with time zone,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_status CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  CONSTRAINT valid_timestamp CHECK (timestamp_seconds IS NULL OR timestamp_seconds >= 0)
);

CREATE INDEX idx_qa_alerts_workspace ON qa_alerts(workspace_id);
CREATE INDEX idx_qa_alerts_call ON qa_alerts(call_id);
CREATE INDEX idx_qa_alerts_journey ON qa_alerts(journey_id);
CREATE INDEX idx_qa_alerts_agent ON qa_alerts(agent_id);
CREATE INDEX idx_qa_alerts_department ON qa_alerts(department_id);
CREATE INDEX idx_qa_alerts_status ON qa_alerts(workspace_id, status);
CREATE INDEX idx_qa_alerts_severity ON qa_alerts(workspace_id, severity);
CREATE INDEX idx_qa_alerts_created ON qa_alerts(created_at DESC);

CREATE TABLE qa_alerts_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES qa_alerts(id) ON DELETE CASCADE,
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  changes jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_qa_alerts_audit_alert ON qa_alerts_audit(alert_id);
CREATE INDEX idx_qa_alerts_audit_action ON qa_alerts_audit(action);

CREATE TABLE qa_alerts_telegram_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES qa_alerts(id) ON DELETE CASCADE,
  chat_id text NOT NULL,
  message_json text NOT NULL,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  status text DEFAULT 'pending',
  error_message text,
  next_retry_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_telegram_queue_status ON qa_alerts_telegram_queue(status, next_retry_at);
CREATE INDEX idx_telegram_queue_alert ON qa_alerts_telegram_queue(alert_id);

-- ============================================================================
-- MIGRATION 080: Transcript Segments
-- ============================================================================

CREATE TABLE qa_transcript_segments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  speaker text NOT NULL,
  text text NOT NULL,
  start_seconds numeric(10, 2) NOT NULL,
  end_seconds numeric(10, 2) NOT NULL,
  confidence numeric(3, 2),
  language text,
  is_key_moment boolean DEFAULT false,
  key_moment_label text,
  embedding vector(1536),
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_times CHECK (start_seconds < end_seconds),
  CONSTRAINT valid_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX idx_transcript_segments_call ON qa_transcript_segments(call_id);
CREATE INDEX idx_transcript_segments_workspace ON qa_transcript_segments(workspace_id);
CREATE INDEX idx_transcript_segments_speaker ON qa_transcript_segments(speaker);
CREATE INDEX idx_transcript_segments_key_moment ON qa_transcript_segments(call_id, is_key_moment) WHERE is_key_moment = true;
CREATE INDEX idx_transcript_segments_start_time ON qa_transcript_segments(call_id, start_seconds);
CREATE INDEX idx_transcript_segments_content ON qa_transcript_segments USING GIN (to_tsvector('spanish', text));

CREATE TABLE qa_call_transcript_summary (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id uuid NOT NULL UNIQUE REFERENCES calls(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  total_segments integer DEFAULT 0,
  duration_seconds numeric(10, 2),
  language text DEFAULT 'en',
  agent_turn_count integer DEFAULT 0,
  customer_turn_count integer DEFAULT 0,
  agent_avg_turn_length numeric(10, 2),
  customer_avg_turn_length numeric(10, 2),
  key_moments_count integer DEFAULT 0,
  key_moments_types text[],
  first_agent_line_at numeric(10, 2),
  last_customer_line_at numeric(10, 2),
  has_embedding boolean DEFAULT false,
  embeddings_updated_at timestamp with time zone,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_transcript_summary_workspace ON qa_call_transcript_summary(workspace_id);
CREATE INDEX idx_transcript_summary_language ON qa_call_transcript_summary(language);

-- ============================================================================
-- MIGRATION 081: Roles and Permissions
-- ============================================================================

CREATE TYPE qa_permission AS ENUM (
  'view_qa_center',
  'view_all_calls',
  'view_team_calls',
  'view_own_calls',
  'view_scores',
  'export_reports',
  'manage_qa_rules',
  'manage_departments',
  'manage_forbidden_rules',
  'manage_roles',
  'acknowledge_alerts',
  'resolve_alerts',
  'configure_telegram'
);

CREATE TABLE qa_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  permissions qa_permission[] DEFAULT ARRAY[]::qa_permission[],
  is_system boolean DEFAULT false,
  color text DEFAULT '#6B7280',
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(workspace_id, name)
);

CREATE INDEX idx_qa_roles_workspace ON qa_roles(workspace_id);

CREATE TABLE qa_user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES qa_roles(id) ON DELETE CASCADE,
  assigned_at timestamp with time zone DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),
  expires_at timestamp with time zone,
  metadata jsonb DEFAULT '{}',
  UNIQUE(workspace_id, user_id, role_id)
);

CREATE INDEX idx_qa_user_roles_workspace ON qa_user_roles(workspace_id);
CREATE INDEX idx_qa_user_roles_user ON qa_user_roles(user_id);
CREATE INDEX idx_qa_user_roles_role ON qa_user_roles(role_id);
CREATE INDEX idx_qa_user_roles_expires ON qa_user_roles(expires_at) WHERE expires_at IS NOT NULL;

CREATE TABLE qa_roles_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role_id uuid REFERENCES qa_roles(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  action text NOT NULL,
  actor_id uuid REFERENCES auth.users(id),
  changes jsonb,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_qa_roles_audit_workspace ON qa_roles_audit(workspace_id);
CREATE INDEX idx_qa_roles_audit_action ON qa_roles_audit(action);

-- Insert default system roles
INSERT INTO qa_roles (workspace_id, name, description, is_system, permissions, color)
SELECT
  id,
  'Owner/Admin',
  'Full access to QA Center',
  true,
  ARRAY['view_qa_center', 'view_all_calls', 'view_scores', 'export_reports', 'manage_qa_rules', 'manage_departments', 'manage_forbidden_rules', 'manage_roles', 'acknowledge_alerts', 'resolve_alerts', 'configure_telegram']::qa_permission[],
  '#EF4444'
FROM workspaces
ON CONFLICT (workspace_id, name) DO NOTHING;

INSERT INTO qa_roles (workspace_id, name, description, is_system, permissions, color)
SELECT
  id,
  'QA Manager',
  'Manage QA rules, departments, and alerts',
  true,
  ARRAY['view_qa_center', 'view_all_calls', 'view_scores', 'manage_qa_rules', 'manage_departments', 'manage_forbidden_rules', 'acknowledge_alerts', 'resolve_alerts', 'configure_telegram']::qa_permission[],
  '#F59E0B'
FROM workspaces
ON CONFLICT (workspace_id, name) DO NOTHING;

INSERT INTO qa_roles (workspace_id, name, description, is_system, permissions, color)
SELECT
  id,
  'Supervisor',
  'View team calls and acknowledge alerts',
  true,
  ARRAY['view_qa_center', 'view_team_calls', 'view_scores', 'acknowledge_alerts', 'resolve_alerts']::qa_permission[],
  '#10B981'
FROM workspaces
ON CONFLICT (workspace_id, name) DO NOTHING;

INSERT INTO qa_roles (workspace_id, name, description, is_system, permissions, color)
SELECT
  id,
  'Agent',
  'View own calls and scores',
  true,
  ARRAY['view_qa_center', 'view_own_calls', 'view_scores']::qa_permission[],
  '#3B82F6'
FROM workspaces
ON CONFLICT (workspace_id, name) DO NOTHING;

INSERT INTO qa_roles (workspace_id, name, description, is_system, permissions, color)
SELECT
  id,
  'Viewer',
  'Read-only access to QA Center',
  true,
  ARRAY['view_qa_center', 'view_all_calls', 'view_scores', 'export_reports']::qa_permission[],
  '#6B7280'
FROM workspaces
ON CONFLICT (workspace_id, name) DO NOTHING;

-- ============================================================================
-- VERIFICATION QUERIES
-- ============================================================================

-- Verify all tables created
SELECT COUNT(*) as tables_count FROM information_schema.tables
WHERE table_schema = 'public' AND table_name LIKE 'qa_%';

-- Verify system roles created
SELECT COUNT(*) as roles_count FROM qa_roles WHERE is_system = true;

-- Success message
SELECT 'Phase 1 Migrations Completed Successfully!' as status;
