-- QA Roles and Permissions: RBAC for QA Center
-- Fine-grained access control for QA features and data

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

  -- Permissions as array
  permissions qa_permission[] DEFAULT ARRAY[]::qa_permission[],

  -- Is this a system role that cannot be deleted?
  is_system boolean DEFAULT false,

  -- Color for UI
  color text DEFAULT '#6B7280',

  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(workspace_id, name)
);

CREATE INDEX idx_qa_roles_workspace ON qa_roles(workspace_id);

-- User role assignments
CREATE TABLE qa_user_roles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role_id uuid NOT NULL REFERENCES qa_roles(id) ON DELETE CASCADE,

  -- When was this role assigned?
  assigned_at timestamp with time zone DEFAULT now(),
  assigned_by uuid REFERENCES auth.users(id),

  -- Expiration (optional, for temporary roles)
  expires_at timestamp with time zone,

  metadata jsonb DEFAULT '{}',
  UNIQUE(workspace_id, user_id, role_id)
);

CREATE INDEX idx_qa_user_roles_workspace ON qa_user_roles(workspace_id);
CREATE INDEX idx_qa_user_roles_user ON qa_user_roles(user_id);
CREATE INDEX idx_qa_user_roles_role ON qa_user_roles(role_id);
CREATE INDEX idx_qa_user_roles_expires ON qa_user_roles(expires_at) WHERE expires_at IS NOT NULL;

-- Audit log for role changes
CREATE TABLE qa_roles_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  role_id uuid REFERENCES qa_roles(id) ON DELETE SET NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,

  action text NOT NULL, -- 'role_created', 'role_updated', 'role_deleted', 'user_assigned', 'user_removed'
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
