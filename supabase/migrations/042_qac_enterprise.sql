-- Migration 042: QA Center Enterprise Extensions
-- Adds enterprise-grade columns to existing qac_* tables and creates three new
-- tables: qac_agent_profiles, qac_coaching_reports, qac_audit_logs.

-- ── Extend qac_interactions ────────────────────────────────────────────────────
ALTER TABLE qac_interactions ADD COLUMN IF NOT EXISTS campaign_id       TEXT;
ALTER TABLE qac_interactions ADD COLUMN IF NOT EXISTS customer_phone    TEXT;
ALTER TABLE qac_interactions ADD COLUMN IF NOT EXISTS customer_name     TEXT;
ALTER TABLE qac_interactions ADD COLUMN IF NOT EXISTS direction         TEXT NOT NULL DEFAULT 'inbound'
  CHECK (direction IN ('inbound', 'outbound'));
ALTER TABLE qac_interactions ADD COLUMN IF NOT EXISTS outcome           TEXT;
ALTER TABLE qac_interactions ADD COLUMN IF NOT EXISTS risk_level        TEXT NOT NULL DEFAULT 'unknown'
  CHECK (risk_level IN ('critical', 'high', 'medium', 'low', 'unknown'));
ALTER TABLE qac_interactions ADD COLUMN IF NOT EXISTS language          TEXT NOT NULL DEFAULT 'en';
ALTER TABLE qac_interactions ADD COLUMN IF NOT EXISTS overall_sentiment TEXT
  CHECK (overall_sentiment IN ('positive', 'neutral', 'negative'));

-- Indexes on new qac_interactions columns
CREATE INDEX IF NOT EXISTS qac_interactions_campaign_idx     ON qac_interactions(workspace_id, campaign_id)
  WHERE campaign_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS qac_interactions_risk_level_idx   ON qac_interactions(workspace_id, risk_level);
CREATE INDEX IF NOT EXISTS qac_interactions_direction_idx    ON qac_interactions(workspace_id, direction);
CREATE INDEX IF NOT EXISTS qac_interactions_language_idx     ON qac_interactions(workspace_id, language);

-- ── Extend qac_evaluations ─────────────────────────────────────────────────────
ALTER TABLE qac_evaluations ADD COLUMN IF NOT EXISTS compliance_score      INTEGER
  CHECK (compliance_score IS NULL OR (compliance_score >= 0 AND compliance_score <= 100));
ALTER TABLE qac_evaluations ADD COLUMN IF NOT EXISTS sales_score           INTEGER
  CHECK (sales_score IS NULL OR (sales_score >= 0 AND sales_score <= 100));
ALTER TABLE qac_evaluations ADD COLUMN IF NOT EXISTS soft_skills_score     INTEGER
  CHECK (soft_skills_score IS NULL OR (soft_skills_score >= 0 AND soft_skills_score <= 100));
ALTER TABLE qac_evaluations ADD COLUMN IF NOT EXISTS conversation_score    INTEGER
  CHECK (conversation_score IS NULL OR (conversation_score >= 0 AND conversation_score <= 100));
ALTER TABLE qac_evaluations ADD COLUMN IF NOT EXISTS coaching_summary      TEXT;
ALTER TABLE qac_evaluations ADD COLUMN IF NOT EXISTS strengths             JSONB NOT NULL DEFAULT '[]';
ALTER TABLE qac_evaluations ADD COLUMN IF NOT EXISTS weaknesses            JSONB NOT NULL DEFAULT '[]';
ALTER TABLE qac_evaluations ADD COLUMN IF NOT EXISTS opportunities         JSONB NOT NULL DEFAULT '[]';
ALTER TABLE qac_evaluations ADD COLUMN IF NOT EXISTS recommended_training  JSONB NOT NULL DEFAULT '[]';
ALTER TABLE qac_evaluations ADD COLUMN IF NOT EXISTS sentiment_timeline    JSONB NOT NULL DEFAULT '[]';
ALTER TABLE qac_evaluations ADD COLUMN IF NOT EXISTS key_moments           JSONB NOT NULL DEFAULT '[]';
ALTER TABLE qac_evaluations ADD COLUMN IF NOT EXISTS customer_intent       TEXT;
ALTER TABLE qac_evaluations ADD COLUMN IF NOT EXISTS call_outcome          TEXT;
ALTER TABLE qac_evaluations ADD COLUMN IF NOT EXISTS objections            JSONB NOT NULL DEFAULT '[]';

-- Indexes on new qac_evaluations columns
CREATE INDEX IF NOT EXISTS qac_evaluations_compliance_idx  ON qac_evaluations(workspace_id, compliance_score DESC)
  WHERE compliance_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS qac_evaluations_sales_idx       ON qac_evaluations(workspace_id, sales_score DESC)
  WHERE sales_score IS NOT NULL;

-- ── Extend qac_flags ───────────────────────────────────────────────────────────
ALTER TABLE qac_flags ADD COLUMN IF NOT EXISTS violation_type       TEXT
  CHECK (violation_type IN (
    'promise', 'misleading', 'unauthorized_claim',
    'missing_disclosure', 'prohibited_word', 'risk_statement'
  ));
ALTER TABLE qac_flags ADD COLUMN IF NOT EXISTS suggested_correction TEXT;
ALTER TABLE qac_flags ADD COLUMN IF NOT EXISTS start_ms             INTEGER;
ALTER TABLE qac_flags ADD COLUMN IF NOT EXISTS end_ms               INTEGER;

-- Index on violation_type for reporting
CREATE INDEX IF NOT EXISTS qac_flags_violation_type_idx ON qac_flags(workspace_id, violation_type)
  WHERE violation_type IS NOT NULL;
CREATE INDEX IF NOT EXISTS qac_flags_timestamp_ms_idx   ON qac_flags(evaluation_id, start_ms)
  WHERE start_ms IS NOT NULL;

-- ── qac_agent_profiles ─────────────────────────────────────────────────────────
-- Stores the canonical HR/CRM profile for each human call-center agent so that
-- evaluations and coaching reports can be linked by stable agent_id.
CREATE TABLE IF NOT EXISTS qac_agent_profiles (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_id     TEXT        NOT NULL,  -- external HR/CRM identifier
  name         TEXT        NOT NULL,
  email        TEXT,
  team         TEXT,
  role         TEXT,
  hire_date    DATE,
  is_active    BOOLEAN     NOT NULL DEFAULT TRUE,
  metadata     JSONB,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, agent_id)
);

CREATE INDEX IF NOT EXISTS qac_agent_profiles_workspace_idx ON qac_agent_profiles(workspace_id);
CREATE INDEX IF NOT EXISTS qac_agent_profiles_active_idx    ON qac_agent_profiles(workspace_id, is_active);
CREATE INDEX IF NOT EXISTS qac_agent_profiles_team_idx      ON qac_agent_profiles(workspace_id, team)
  WHERE team IS NOT NULL;

ALTER TABLE qac_agent_profiles ENABLE ROW LEVEL SECURITY;

-- Workspace members can read profiles; owners/admins can manage them.
CREATE POLICY "qac_agent_profiles_read"
  ON qac_agent_profiles FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "qac_agent_profiles_write"
  ON qac_agent_profiles FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── qac_coaching_reports ──────────────────────────────────────────────────────
-- One coaching report per interaction — generated by the AI after the full
-- parallel analysis pipeline completes.
CREATE TABLE IF NOT EXISTS qac_coaching_reports (
  id                   UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id         UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  interaction_id       UUID        NOT NULL REFERENCES qac_interactions(id) ON DELETE CASCADE,
  agent_id             TEXT,
  strengths            JSONB       NOT NULL DEFAULT '[]',
  weaknesses           JSONB       NOT NULL DEFAULT '[]',
  opportunities        JSONB       NOT NULL DEFAULT '[]',
  recommended_training JSONB       NOT NULL DEFAULT '[]',
  coaching_plan        TEXT,
  priority_score       INTEGER     NOT NULL DEFAULT 0
    CHECK (priority_score >= 0 AND priority_score <= 100),
  created_at           TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qac_coaching_reports_workspace_idx      ON qac_coaching_reports(workspace_id);
CREATE INDEX IF NOT EXISTS qac_coaching_reports_interaction_idx    ON qac_coaching_reports(interaction_id);
CREATE INDEX IF NOT EXISTS qac_coaching_reports_agent_idx          ON qac_coaching_reports(workspace_id, agent_id)
  WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS qac_coaching_reports_priority_idx       ON qac_coaching_reports(workspace_id, priority_score DESC);

ALTER TABLE qac_coaching_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qac_coaching_reports_read"
  ON qac_coaching_reports FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "qac_coaching_reports_write"
  ON qac_coaching_reports FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- ── qac_audit_logs ────────────────────────────────────────────────────────────
-- Immutable append-only log of user actions on QA Center entities.
-- Useful for SOC-2 / HIPAA audit trails.
CREATE TABLE IF NOT EXISTS qac_audit_logs (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  user_id      UUID        REFERENCES auth.users(id),
  action       TEXT        NOT NULL,   -- e.g. 'analyze', 'delete', 'export', 'update_rule'
  entity_type  TEXT        NOT NULL,   -- e.g. 'interaction', 'evaluation', 'rule', 'flag'
  entity_id    TEXT,
  details      JSONB,
  ip_address   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qac_audit_logs_workspace_idx    ON qac_audit_logs(workspace_id, created_at DESC);
CREATE INDEX IF NOT EXISTS qac_audit_logs_user_idx         ON qac_audit_logs(user_id, created_at DESC)
  WHERE user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS qac_audit_logs_entity_idx       ON qac_audit_logs(workspace_id, entity_type, entity_id)
  WHERE entity_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS qac_audit_logs_action_idx       ON qac_audit_logs(workspace_id, action);

ALTER TABLE qac_audit_logs ENABLE ROW LEVEL SECURITY;

-- Audit logs are read-only for workspace members; writes go through service role only.
CREATE POLICY "qac_audit_logs_read"
  ON qac_audit_logs FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Intentionally no INSERT/UPDATE/DELETE policy for regular users.
-- All writes must go through the service-role admin client.
