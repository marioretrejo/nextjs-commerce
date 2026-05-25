-- Automation rules for call outcomes
CREATE TABLE IF NOT EXISTS automation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id UUID NOT NULL REFERENCES agents(id) ON DELETE CASCADE,
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  trigger_outcome TEXT NOT NULL, -- 'converted', 'no_answer', 'voicemail', 'rejected', 'transferred', 'any'
  action_type TEXT NOT NULL,     -- 'webhook', 'tag_contact', 'send_sms', 'notify_team', 'add_to_campaign'
  action_config JSONB NOT NULL DEFAULT '{}',
  enabled BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE automation_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace members can manage automation_rules"
  ON automation_rules
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );
