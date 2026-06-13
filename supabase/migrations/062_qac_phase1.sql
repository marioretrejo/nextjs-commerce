-- Migration 062: QA Center Phase 1 — Review Workflow + Comment System
--
-- Tables verified as already existing (DO NOT recreate):
--   qac_agent_profiles   (migration 042)
--   qac_coaching_reports (migration 042)
--   qac_audit_logs       (migration 042)
--
-- qac_coaching_reports status field audit:
--   PROPOSED for future phase: ADD COLUMN status TEXT DEFAULT 'pending'
--     CHECK (status IN ('pending','acknowledged','in_progress','completed'))
--   NOT added here — requires product decision on workflow states.
--   Document stored in QA_CENTER_PLAN.txt.
--
-- This migration adds:
--   1. Review workflow columns to qac_interactions
--   2. qac_review_comments table
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Review workflow columns on qac_interactions ───────────────────────────

ALTER TABLE qac_interactions
  ADD COLUMN IF NOT EXISTS review_status  TEXT NOT NULL DEFAULT 'pending_review'
    CHECK (review_status IN (
      'pending_review',
      'in_review',
      'reviewed',
      'approved',
      'disputed'
    ));

ALTER TABLE qac_interactions
  ADD COLUMN IF NOT EXISTS reviewer_notes TEXT;

ALTER TABLE qac_interactions
  ADD COLUMN IF NOT EXISTS reviewed_by    UUID REFERENCES auth.users(id);

ALTER TABLE qac_interactions
  ADD COLUMN IF NOT EXISTS reviewed_at    TIMESTAMPTZ;

ALTER TABLE qac_interactions
  ADD COLUMN IF NOT EXISTS approved_by    UUID REFERENCES auth.users(id);

ALTER TABLE qac_interactions
  ADD COLUMN IF NOT EXISTS approved_at    TIMESTAMPTZ;

-- Index: fast lookup by review_status per workspace
CREATE INDEX IF NOT EXISTS qac_interactions_review_status_idx
  ON qac_interactions(workspace_id, review_status);

-- ── 2. qac_review_comments ───────────────────────────────────────────────────
-- QA supervisor comments on individual call interactions.
-- Multiple comments per interaction are allowed (threaded notes).

CREATE TABLE IF NOT EXISTS qac_review_comments (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID        NOT NULL REFERENCES workspaces(id)      ON DELETE CASCADE,
  interaction_id UUID        NOT NULL REFERENCES qac_interactions(id) ON DELETE CASCADE,
  user_id        UUID        REFERENCES auth.users(id),
  comment        TEXT        NOT NULL CHECK (char_length(comment) >= 1 AND char_length(comment) <= 2000),
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qac_review_comments_interaction_idx
  ON qac_review_comments(interaction_id, created_at);
CREATE INDEX IF NOT EXISTS qac_review_comments_workspace_idx
  ON qac_review_comments(workspace_id, created_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION qac_review_comments_updated_at()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER qac_review_comments_updated_at_trigger
  BEFORE UPDATE ON qac_review_comments
  FOR EACH ROW EXECUTE FUNCTION qac_review_comments_updated_at();

-- ── RLS for qac_review_comments ──────────────────────────────────────────────

ALTER TABLE qac_review_comments ENABLE ROW LEVEL SECURITY;

-- All workspace members can read comments
CREATE POLICY "qac_review_comments_read"
  ON qac_review_comments FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- All workspace members can insert comments (supervisor writes via API with admin client)
CREATE POLICY "qac_review_comments_insert"
  ON qac_review_comments FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

-- Authors can update their own comments; admins can update any
CREATE POLICY "qac_review_comments_update"
  ON qac_review_comments FOR UPDATE
  USING (
    user_id = auth.uid()
    OR workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
