-- 048_call_cost_events: granular per-call cost tracking
-- Adds call_cost_events table and cost metadata columns to calls.
-- cost_usd already exists on calls (001_initial_schema.sql).

ALTER TABLE calls
  ADD COLUMN IF NOT EXISTS cost_breakdown jsonb,
  ADD COLUMN IF NOT EXISTS cost_status    text DEFAULT 'not_calculated'
    CONSTRAINT calls_cost_status_check
    CHECK (cost_status IN ('not_calculated', 'estimated', 'final', 'failed'));

CREATE TABLE IF NOT EXISTS call_cost_events (
  id             uuid         PRIMARY KEY DEFAULT gen_random_uuid(),
  call_id        uuid         REFERENCES calls(id) ON DELETE SET NULL,
  workspace_id   uuid         NOT NULL,
  agent_id       uuid,
  call_room      text         NOT NULL,
  provider       text         NOT NULL,
  cost_type      text         NOT NULL,
  quantity       numeric      NOT NULL,
  unit           text         NOT NULL,
  unit_cost_usd  numeric(10,8),
  total_cost_usd numeric(10,6),
  currency       text         NOT NULL DEFAULT 'usd',
  pricing_source text         NOT NULL DEFAULT 'unknown'
    CONSTRAINT call_cost_events_pricing_source_check
    CHECK (pricing_source IN ('configured', 'unknown')),
  metadata       jsonb        NOT NULL DEFAULT '{}',
  created_at     timestamptz  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_cost_events_call_id_idx
  ON call_cost_events(call_id)
  WHERE call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS call_cost_events_workspace_room_idx
  ON call_cost_events(workspace_id, call_room);

CREATE INDEX IF NOT EXISTS call_cost_events_workspace_created_idx
  ON call_cost_events(workspace_id, created_at DESC);

ALTER TABLE call_cost_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_members_read_call_costs"
  ON call_cost_events
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );
