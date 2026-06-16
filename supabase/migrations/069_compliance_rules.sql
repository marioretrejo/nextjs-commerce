-- Migration 069: QA Center — Compliance Rules v2 + Violations Table
--
-- Extends qac_rules with:
--   scope          — global (all calls) vs department (specific dept)
--   department_id  — FK to qac_departments when scope='department'
--   alert_severity — critical | warning (distinct from existing severity col)
--   examples       — JSONB array of violation examples
--   counter_examples — JSONB array of counter-examples (not a violation)
--   sort_order     — UI ordering
--
-- Creates qac_compliance_violations:
--   Per-call structured violation log tied to specific user-defined rules.
--   Separate from qac_flags (which tracks general AI compliance flags).
--
-- All changes are additive — no DROP, no destructive ALTER.
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Extend qac_rules ──────────────────────────────────────────────────────────

ALTER TABLE qac_rules
  ADD COLUMN IF NOT EXISTS scope TEXT NOT NULL DEFAULT 'department'
    CHECK (scope IN ('global', 'department')),
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES qac_departments(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS alert_severity TEXT NOT NULL DEFAULT 'warning'
    CHECK (alert_severity IN ('critical', 'warning')),
  ADD COLUMN IF NOT EXISTS examples JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS counter_examples JSONB NOT NULL DEFAULT '[]',
  ADD COLUMN IF NOT EXISTS sort_order INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS qac_rules_scope_ws_active_idx
  ON qac_rules(workspace_id, scope, is_active);

CREATE INDEX IF NOT EXISTS qac_rules_dept_id_idx
  ON qac_rules(workspace_id, department_id)
  WHERE department_id IS NOT NULL;

-- ── qac_compliance_violations ─────────────────────────────────────────────────
-- One row per rule violation detected in an interaction.
-- Populated by the analyze pipeline after each Groq violations call.

CREATE TABLE IF NOT EXISTS qac_compliance_violations (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  interaction_id    UUID        NOT NULL REFERENCES qac_interactions(id) ON DELETE CASCADE,
  workspace_id      UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  department_id     UUID        REFERENCES qac_departments(id) ON DELETE SET NULL,
  rule_id           UUID        REFERENCES qac_rules(id) ON DELETE SET NULL,
  rule_name         TEXT        NOT NULL,
  fragment          TEXT        NOT NULL,
  timestamp_seconds INTEGER,
  severity          TEXT        NOT NULL CHECK (severity IN ('critical', 'warning')),
  confidence        FLOAT       NOT NULL,
  explanation       TEXT,
  is_false_positive BOOLEAN     NOT NULL DEFAULT false,
  reviewed_by       UUID        REFERENCES users(id) ON DELETE SET NULL,
  reviewed_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS qac_violations_interaction_idx
  ON qac_compliance_violations(interaction_id);

CREATE INDEX IF NOT EXISTS qac_violations_workspace_created_idx
  ON qac_compliance_violations(workspace_id, created_at DESC)
  WHERE is_false_positive = false;

CREATE INDEX IF NOT EXISTS qac_violations_severity_idx
  ON qac_compliance_violations(workspace_id, severity, created_at DESC)
  WHERE is_false_positive = false;

ALTER TABLE qac_compliance_violations ENABLE ROW LEVEL SECURITY;

-- Workspace members and owners can read violations
CREATE POLICY "qac_violations_read"
  ON qac_compliance_violations FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
      UNION
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );

-- Only owners/admins can update (mark false positive)
CREATE POLICY "qac_violations_write"
  ON qac_compliance_violations FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
      UNION
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );
