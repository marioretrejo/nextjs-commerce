-- Migration 040: Call Center QA — cc_interactions table
-- Stores human call-center agent conversations for compliance analysis.
-- Separate from AI voice agent calls (calls table / analyze-call job).

CREATE TABLE IF NOT EXISTS cc_interactions (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  agent_name    TEXT         NOT NULL,
  channel       TEXT         NOT NULL DEFAULT 'call'
                CHECK (channel IN ('call', 'chat', 'email', 'social', 'other')),
  transcript    TEXT         NOT NULL,
  duration_s    INT,
  status        TEXT         NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'analyzing', 'analyzed', 'failed')),
  metadata      JSONB        NOT NULL DEFAULT '{}',
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cc_interactions_workspace_idx ON cc_interactions(workspace_id);
CREATE INDEX IF NOT EXISTS cc_interactions_status_idx    ON cc_interactions(workspace_id, status);
CREATE INDEX IF NOT EXISTS cc_interactions_created_idx   ON cc_interactions(workspace_id, created_at DESC);

ALTER TABLE cc_interactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_read_cc_interactions"
  ON cc_interactions FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Link qa_evaluations to cc_interactions (nullable — either call_id or cc_interaction_id is set)
ALTER TABLE qa_evaluations
  ADD COLUMN IF NOT EXISTS cc_interaction_id UUID REFERENCES cc_interactions(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS qa_evaluations_cc_idx ON qa_evaluations(cc_interaction_id);
