-- Migration 039: Compliance Rules (per-workspace QA rule definitions)

CREATE TABLE IF NOT EXISTS compliance_rules (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID        NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  rule_name     TEXT        NOT NULL,
  description   TEXT        NOT NULL,
  category      TEXT        NOT NULL DEFAULT 'general'
                CHECK (category IN ('disclosure', 'prohibited', 'required', 'quality', 'general')),
  severity      TEXT        NOT NULL DEFAULT 'medium'
                CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  is_active     BOOLEAN     NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS compliance_rules_workspace_idx  ON compliance_rules(workspace_id);
CREATE INDEX IF NOT EXISTS compliance_rules_active_idx     ON compliance_rules(workspace_id, is_active);

ALTER TABLE compliance_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_read_compliance_rules"
  ON compliance_rules FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

CREATE POLICY "workspace_write_compliance_rules"
  ON compliance_rules FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ language 'plpgsql';

CREATE TRIGGER compliance_rules_updated_at
  BEFORE UPDATE ON compliance_rules
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();
