-- Migration 014: workspace_events audit log

CREATE TABLE IF NOT EXISTS workspace_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  event_type   TEXT NOT NULL CHECK (event_type IN (
    'minutes_reset', 'plan_upgraded', 'plan_downgraded',
    'limit_reached', 'minutes_adjusted'
  )),
  details      JSONB NOT NULL DEFAULT '{}',
  created_at   TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_workspace_events_workspace_id ON workspace_events(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_events_created_at   ON workspace_events(created_at DESC);

ALTER TABLE workspace_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_can_read_events"
  ON workspace_events FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );
