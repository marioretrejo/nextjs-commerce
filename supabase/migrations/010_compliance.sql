-- DNC (Do Not Call) list
CREATE TABLE IF NOT EXISTS dnc_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  phone TEXT NOT NULL,
  reason TEXT,
  added_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(workspace_id, phone)
);

ALTER TABLE dnc_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage dnc_entries"
  ON dnc_entries
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Compliance settings per workspace
CREATE TABLE IF NOT EXISTS compliance_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL UNIQUE REFERENCES workspaces(id) ON DELETE CASCADE,
  -- Calling hours (global override)
  calling_hours_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  calling_hours_start TIME NOT NULL DEFAULT '09:00',
  calling_hours_end TIME NOT NULL DEFAULT '20:00',
  calling_days TEXT[] NOT NULL DEFAULT '{"mon","tue","wed","thu","fri"}',
  -- Data retention
  call_recording_retention_days INT NOT NULL DEFAULT 90,
  transcript_retention_days INT NOT NULL DEFAULT 365,
  -- Consent
  require_consent BOOLEAN NOT NULL DEFAULT FALSE,
  consent_message TEXT,
  -- TCPA / GDPR flags
  tcpa_compliance_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  gdpr_compliance_enabled BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE compliance_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage compliance_settings"
  ON compliance_settings
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
