-- Migration 038: Compliance QA feature flag + QA tables
-- Adds has_compliance_qa entitlement flag to workspaces (Phase 2)
-- Creates qa_evaluations and compliance_violations tables (Phase 3)

-- ── Phase 2: Entitlement flag ─────────────────────────────────────────────────
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS has_compliance_qa BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN workspaces.has_compliance_qa IS
  'Upsell entitlement: enables real-time Compliance & QA module. Controlled by superadmin only.';

-- ── Phase 3: QA Evaluations ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS qa_evaluations (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  call_id          UUID REFERENCES calls(id) ON DELETE SET NULL,
  risk_score       NUMERIC(4,1)  NOT NULL DEFAULT 0 CHECK (risk_score >= 0 AND risk_score <= 100),
  analysis         JSONB         NOT NULL DEFAULT '{}',
  -- analysis shape: { summary, sentiment, tone, topics[], scores: { opening, compliance, objection_handling, closing } }
  evaluated_at     TIMESTAMPTZ   NOT NULL DEFAULT NOW(),
  created_at       TIMESTAMPTZ   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qa_evaluations_workspace_idx ON qa_evaluations(workspace_id);
CREATE INDEX IF NOT EXISTS qa_evaluations_call_idx      ON qa_evaluations(call_id);
CREATE INDEX IF NOT EXISTS qa_evaluations_risk_idx      ON qa_evaluations(risk_score DESC);

-- ── Phase 3: Compliance Violations ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliance_violations (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  qa_evaluation_id    UUID NOT NULL REFERENCES qa_evaluations(id) ON DELETE CASCADE,
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_name           TEXT NOT NULL,           -- e.g. 'TCPA_DNC_MENTION', 'GDPR_DATA_REQUEST'
  severity            TEXT NOT NULL CHECK (severity IN ('low','medium','high','critical')),
  transcript_fragment TEXT,                    -- exact quote from transcript where violation occurred
  regulation          TEXT,                    -- e.g. 'TCPA', 'GDPR', 'FTC'
  remediation_note    TEXT,                    -- suggested fix for coaching
  occurred_at_second  INT,                     -- timestamp within call (seconds)
  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_violations_evaluation_idx  ON compliance_violations(qa_evaluation_id);
CREATE INDEX IF NOT EXISTS compliance_violations_workspace_idx   ON compliance_violations(workspace_id);
CREATE INDEX IF NOT EXISTS compliance_violations_severity_idx    ON compliance_violations(severity);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE qa_evaluations      ENABLE ROW LEVEL SECURITY;
ALTER TABLE compliance_violations ENABLE ROW LEVEL SECURITY;

-- Workspace members can read their own QA data
CREATE POLICY "workspace_read_qa_evaluations"
  ON qa_evaluations FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_read_compliance_violations"
  ON compliance_violations FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
