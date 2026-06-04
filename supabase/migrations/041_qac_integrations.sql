-- Migration 041: QA Center Integrations
-- Each workspace gets a webhook_token for receiving call recordings from
-- external platforms (Twilio, Genesys, NICE, etc.) automatically.

CREATE TABLE IF NOT EXISTS qac_integrations (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID         NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  webhook_token         UUID         NOT NULL DEFAULT gen_random_uuid(),
  -- Twilio credentials (optional — needed to download protected recordings)
  twilio_account_sid    TEXT,
  twilio_auth_token     TEXT,
  -- Behavior settings
  auto_analyze          BOOLEAN      NOT NULL DEFAULT TRUE,
  agent_name_field      TEXT         NOT NULL DEFAULT 'To',  -- 'To', 'From', or 'CallSid'
  is_active             BOOLEAN      NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE UNIQUE INDEX IF NOT EXISTS qac_integrations_token_idx ON qac_integrations(webhook_token);
CREATE INDEX        IF NOT EXISTS qac_integrations_ws_idx    ON qac_integrations(workspace_id);

ALTER TABLE qac_integrations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "qac_integrations_owner"
  ON qac_integrations FOR ALL
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

CREATE OR REPLACE FUNCTION qac_integrations_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER qac_integrations_updated_at_trigger
  BEFORE UPDATE ON qac_integrations
  FOR EACH ROW EXECUTE FUNCTION qac_integrations_updated_at();
