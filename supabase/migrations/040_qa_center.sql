-- Migration 040: QA Center — standalone module for call center QA
-- Completely independent from the existing compliance module (DNC, calling hours)
-- and from the AI voice agent analyze-call pipeline.
-- All tables prefixed with qac_ to make separation explicit.

-- ── QA Rules (what the AI auditor checks for) ─────────────────────────────────
-- Separate from compliance_rules. Richer: includes regulation reference and
-- explicit category mapping to the 100% QA scorecard dimensions.
CREATE TABLE IF NOT EXISTS qac_rules (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name          TEXT         NOT NULL,
  description   TEXT         NOT NULL,
  category      TEXT         NOT NULL DEFAULT 'quality'
                CHECK (category IN ('compliance', 'quality', 'disclosure', 'prohibited', 'coaching')),
  severity      TEXT         NOT NULL DEFAULT 'medium'
                CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  regulation    TEXT,        -- e.g. 'FDCPA', 'TCPA', 'GDPR', 'FTC', 'HIPAA', 'Internal Policy'
  is_active     BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qac_rules_workspace_idx ON qac_rules(workspace_id);
CREATE INDEX IF NOT EXISTS qac_rules_active_idx    ON qac_rules(workspace_id, is_active);

-- ── QA Interactions (human call center agent conversations) ───────────────────
CREATE TABLE IF NOT EXISTS qac_interactions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_name    TEXT         NOT NULL,
  agent_id      TEXT,        -- optional internal HR/CRM agent identifier
  channel       TEXT         NOT NULL DEFAULT 'call'
                CHECK (channel IN ('call', 'chat', 'email', 'sms', 'social', 'other')),
  transcript    TEXT         NOT NULL,
  audio_url     TEXT,        -- optional link to recording
  duration_s    INT,
  status        TEXT         NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'analyzing', 'analyzed', 'failed')),
  metadata      JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qac_interactions_workspace_idx ON qac_interactions(workspace_id);
CREATE INDEX IF NOT EXISTS qac_interactions_status_idx    ON qac_interactions(workspace_id, status);
CREATE INDEX IF NOT EXISTS qac_interactions_agent_idx     ON qac_interactions(workspace_id, agent_name);
CREATE INDEX IF NOT EXISTS qac_interactions_created_idx   ON qac_interactions(workspace_id, created_at DESC);

-- ── QA Evaluations (AI scorecard result for one interaction) ──────────────────
CREATE TABLE IF NOT EXISTS qac_evaluations (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  interaction_id   UUID         NOT NULL REFERENCES qac_interactions(id) ON DELETE CASCADE,
  overall_score    NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (overall_score >= 0 AND overall_score <= 100),
  risk_score       NUMERIC(4,1) NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  tone             TEXT,        -- 'professional' | 'neutral' | 'unprofessional' | 'aggressive' | 'friendly'
  summary          TEXT,
  -- criteria_scores: {opening, compliance, objection_handling, closing, empathy} each 0–100
  criteria_scores  JSONB        NOT NULL DEFAULT '{}',
  rules_applied    INT          NOT NULL DEFAULT 0,
  evaluated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qac_evaluations_workspace_idx     ON qac_evaluations(workspace_id);
CREATE INDEX IF NOT EXISTS qac_evaluations_interaction_idx   ON qac_evaluations(interaction_id);
CREATE INDEX IF NOT EXISTS qac_evaluations_overall_score_idx ON qac_evaluations(workspace_id, overall_score DESC);

-- ── QA Flags (specific issues detected per evaluation) ────────────────────────
CREATE TABLE IF NOT EXISTS qac_flags (
  id                   UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  evaluation_id        UUID         NOT NULL REFERENCES qac_evaluations(id) ON DELETE CASCADE,
  workspace_id         UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  category             TEXT         NOT NULL
                       CHECK (category IN ('compliance', 'quality', 'disclosure', 'prohibited', 'coaching')),
  severity             TEXT         NOT NULL
                       CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  label                TEXT         NOT NULL,   -- short name: 'Missing FDCPA Mini-Miranda', 'Aggressive tone', etc.
  transcript_fragment  TEXT,                    -- exact quote (≤80 words) from the transcript
  regulation           TEXT,                    -- 'FDCPA §807', 'TCPA', 'GDPR Art.13', etc.
  coaching_note        TEXT,                    -- actionable suggestion for the agent
  timestamp_s          INT,                     -- when in the call this occurred
  created_at           TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qac_flags_evaluation_idx ON qac_flags(evaluation_id);
CREATE INDEX IF NOT EXISTS qac_flags_workspace_idx  ON qac_flags(workspace_id);
CREATE INDEX IF NOT EXISTS qac_flags_severity_idx   ON qac_flags(workspace_id, severity);

-- ── Row Level Security ────────────────────────────────────────────────────────
ALTER TABLE qac_rules         ENABLE ROW LEVEL SECURITY;
ALTER TABLE qac_interactions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE qac_evaluations   ENABLE ROW LEVEL SECURITY;
ALTER TABLE qac_flags         ENABLE ROW LEVEL SECURITY;

-- Members of the workspace can read QA Center data
CREATE POLICY "qac_rules_read"         ON qac_rules         FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "qac_interactions_read"  ON qac_interactions  FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "qac_evaluations_read"   ON qac_evaluations   FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));
CREATE POLICY "qac_flags_read"         ON qac_flags         FOR SELECT
  USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()));

-- Auto-update updated_at on qac_rules
CREATE OR REPLACE FUNCTION qac_rules_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER qac_rules_updated_at_trigger
  BEFORE UPDATE ON qac_rules
  FOR EACH ROW EXECUTE FUNCTION qac_rules_updated_at();
