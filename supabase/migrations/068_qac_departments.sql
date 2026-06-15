-- Migration 068: QA Center — Department-based QA Configuration
--
-- Adds per-department QA profiles so each call can be analyzed with
-- rules, prompts and scoring weights specific to the agent's department.
--
-- New tables:
--   qac_departments           — department profiles (prompt, rubric, criteria)
--   qac_department_extensions — extension-to-department fallback mapping
--
-- Modified table:
--   qac_interactions          — ADD COLUMN department_id (nullable FK)
--
-- No DROP. No destructive ALTER. department_id is nullable (backward compat).
-- ─────────────────────────────────────────────────────────────────────────────

-- ── qac_departments ───────────────────────────────────────────────────────────
-- One row per department per workspace. Stores the QA profile used when
-- analyzing calls from that department.

CREATE TABLE IF NOT EXISTS qac_departments (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name              TEXT        NOT NULL,
  slug              TEXT        NOT NULL,       -- url-safe id: "ventas", "soporte", etc.
  description       TEXT,
  -- Department-specific instructions injected into each Groq analysis prompt.
  -- When null, the global prompt is used unchanged (backward compat).
  qa_prompt         TEXT,
  -- Scoring weights for the four analysis dimensions (must sum to ~100).
  -- Default mirrors the hardcoded weights in the analyze route.
  scoring_rubric    JSONB       NOT NULL DEFAULT
    '{"compliance": 40, "sales": 25, "soft_skills": 20, "conversation": 15}'::jsonb,
  -- Dimensions that must pass for the call not to be flagged as critical.
  -- e.g. ["compliance"] means a low compliance score always triggers critical risk.
  critical_criteria JSONB       NOT NULL DEFAULT '[]'::jsonb,
  is_active         BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS qac_departments_ws_active_idx
  ON qac_departments(workspace_id, is_active);

CREATE INDEX IF NOT EXISTS qac_departments_ws_name_idx
  ON qac_departments(workspace_id, name);

ALTER TABLE qac_departments ENABLE ROW LEVEL SECURITY;

-- All workspace members can read department profiles
-- (needed by the analyze pipeline running under the service role anyway,
--  but also allows the UI to show department info to agents).
CREATE POLICY "qac_departments_read"
  ON qac_departments FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Only workspace owners and admins can create/edit/delete departments.
CREATE POLICY "qac_departments_write"
  ON qac_departments FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION qac_departments_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER qac_departments_updated_at_trigger
  BEFORE UPDATE ON qac_departments
  FOR EACH ROW EXECUTE FUNCTION qac_departments_updated_at();

-- ── qac_department_extensions ─────────────────────────────────────────────────
-- Maps a VoIP agent extension to a department.
-- Used as fallback when the provider's department field doesn't match
-- any qac_departments row directly.

CREATE TABLE IF NOT EXISTS qac_department_extensions (
  id              UUID  PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID  NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  department_id   UUID  NOT NULL REFERENCES qac_departments(id) ON DELETE CASCADE,
  agent_extension TEXT  NOT NULL,
  agent_name      TEXT,                -- optional display name for the extension
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, agent_extension)
);

CREATE INDEX IF NOT EXISTS qac_dept_extensions_ws_ext_idx
  ON qac_department_extensions(workspace_id, agent_extension);

CREATE INDEX IF NOT EXISTS qac_dept_extensions_dept_idx
  ON qac_department_extensions(department_id);

ALTER TABLE qac_department_extensions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qac_dept_extensions_read"
  ON qac_department_extensions FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "qac_dept_extensions_write"
  ON qac_department_extensions FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── qac_interactions: add department_id (nullable) ────────────────────────────
-- Links an interaction to the resolved qac_departments profile.
-- NULL means no department was resolved (legacy rows and calls with no
-- matching department use the global defaults — backward compatible).

ALTER TABLE qac_interactions
  ADD COLUMN IF NOT EXISTS department_id UUID REFERENCES qac_departments(id);

CREATE INDEX IF NOT EXISTS qac_interactions_dept_id_idx
  ON qac_interactions(workspace_id, department_id)
  WHERE department_id IS NOT NULL;
