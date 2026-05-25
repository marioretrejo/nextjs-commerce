-- Migration 012: BYOT telephony providers + agent FK

CREATE TABLE IF NOT EXISTS telephony_providers (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  type              TEXT NOT NULL CHECK (type IN ('twilio','telnyx','sip_trunk','voip_ms','vonage','custom_sip')),
  is_platform_default BOOLEAN NOT NULL DEFAULT FALSE,
  credentials       JSONB NOT NULL DEFAULT '{}',
  outbound_number   TEXT,
  status            TEXT NOT NULL DEFAULT 'disconnected' CHECK (status IN ('active','testing','error','disconnected')),
  last_tested_at    TIMESTAMP WITH TIME ZONE,
  test_result       JSONB,
  created_at        TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE telephony_providers ENABLE ROW LEVEL SECURITY;

-- Superadmin-only: no client RLS policies — clients never see this table
CREATE POLICY "superadmin_all_telephony_providers"
  ON telephony_providers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM users WHERE id = auth.uid() AND is_superadmin = TRUE
    )
  );

-- Add telephony_provider_id to agents (nullable FK)
ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS telephony_provider_id UUID REFERENCES telephony_providers(id) ON DELETE SET NULL;

-- Add internal_provider to calls (superadmin visible only, never returned to clients)
ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS internal_provider TEXT,
  ADD COLUMN IF NOT EXISTS routing_data       JSONB,
  ADD COLUMN IF NOT EXISTS provider_cost      DECIMAL(10,4);
