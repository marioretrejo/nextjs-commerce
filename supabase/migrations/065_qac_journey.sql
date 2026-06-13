-- Migration 065: QA Center Phase 2B — Customer Journey + Follow-Up Commitments
--
-- Creates:
--   · qac_customer_journey          — per-call entry in a customer's journey
--   · qac_follow_up_commitments     — explicit commitments detected by the LLM
--
-- Design rules:
--   · qac_customer_journey.interaction_id is UNIQUE — one call = one journey entry
--   · ON DELETE CASCADE from qac_interactions: journey entry removed if call removed
--   · ON DELETE SET NULL for thread_id: journey persists even if thread is deleted
--   · qac_follow_up_commitments: interaction-scoped, customer-linked when available
--   · workspace_id NOT NULL on both tables — enforced at column AND RLS level
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. qac_customer_journey ───────────────────────────────────────────────────
-- One record per interaction that has been linked to a known customer.
-- Captures the state of the customer at the moment of each call:
-- intent, sentiment, open topics, and unresolved items.
-- Append-only — no updated_at (rows are created once, not updated).

CREATE TABLE IF NOT EXISTS qac_customer_journey (
  id                UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID         NOT NULL REFERENCES workspaces(id)       ON DELETE CASCADE,
  customer_id       UUID         NOT NULL REFERENCES qac_customers(id)    ON DELETE CASCADE,
  thread_id         UUID         REFERENCES qac_call_threads(id)          ON DELETE SET NULL,
  interaction_id    UUID         NOT NULL REFERENCES qac_interactions(id) ON DELETE CASCADE,
  sequence_number   INT          NOT NULL DEFAULT 1,  -- ordinal position within the thread
  intent_at_call    TEXT,        -- what the customer wanted in THIS call
  sentiment_at_call TEXT         CHECK (sentiment_at_call IN ('positive', 'neutral', 'negative')),
  key_topics        TEXT[]       NOT NULL DEFAULT '{}',   -- main subjects discussed
  unresolved_items  TEXT[]       NOT NULL DEFAULT '{}',   -- open items at call end
  created_at        TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- Enforces: one call belongs to at most one customer journey entry
  CONSTRAINT qac_customer_journey_interaction_unique
    UNIQUE (interaction_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS qac_customer_journey_customer_idx
  ON qac_customer_journey(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS qac_customer_journey_thread_idx
  ON qac_customer_journey(thread_id, sequence_number)
  WHERE thread_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS qac_customer_journey_workspace_idx
  ON qac_customer_journey(workspace_id, created_at DESC);

-- RLS
ALTER TABLE qac_customer_journey ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qac_customer_journey_select" ON qac_customer_journey;
CREATE POLICY "qac_customer_journey_select"
  ON qac_customer_journey FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "qac_customer_journey_insert" ON qac_customer_journey;
CREATE POLICY "qac_customer_journey_insert"
  ON qac_customer_journey FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "qac_customer_journey_update" ON qac_customer_journey;
CREATE POLICY "qac_customer_journey_update"
  ON qac_customer_journey FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "qac_customer_journey_delete" ON qac_customer_journey;
CREATE POLICY "qac_customer_journey_delete"
  ON qac_customer_journey FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );


-- ── 2. qac_follow_up_commitments ─────────────────────────────────────────────
-- Explicit commitments made during a call: promises by the agent or customer.
-- Detected by the LLM during analysis; status updated as calls come in.
-- Examples: "te llamo el martes", "mando el contrato hoy", "lo pienso y aviso".

CREATE TABLE IF NOT EXISTS qac_follow_up_commitments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID        NOT NULL REFERENCES workspaces(id)       ON DELETE CASCADE,
  interaction_id   UUID        NOT NULL REFERENCES qac_interactions(id) ON DELETE CASCADE,
  customer_id      UUID        REFERENCES qac_customers(id)             ON DELETE SET NULL,
  committed_by     TEXT        NOT NULL
    CHECK (committed_by IN ('agent', 'customer')),
  commitment_text  TEXT        NOT NULL
    CHECK (char_length(commitment_text) >= 1 AND char_length(commitment_text) <= 1000),
  due_date         DATE,       -- promised date (null if no specific date mentioned)
  status           TEXT        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'fulfilled', 'missed', 'cancelled')),
  fulfilled_at     TIMESTAMPTZ,
  verified_in_call UUID        REFERENCES qac_interactions(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS qac_follow_up_commitments_interaction_idx
  ON qac_follow_up_commitments(interaction_id);

CREATE INDEX IF NOT EXISTS qac_follow_up_commitments_customer_idx
  ON qac_follow_up_commitments(customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS qac_follow_up_commitments_workspace_status_idx
  ON qac_follow_up_commitments(workspace_id, status, due_date)
  WHERE status = 'pending';

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION qac_follow_up_commitments_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS qac_follow_up_commitments_updated_at_trigger
  ON qac_follow_up_commitments;
CREATE TRIGGER qac_follow_up_commitments_updated_at_trigger
  BEFORE UPDATE ON qac_follow_up_commitments
  FOR EACH ROW EXECUTE FUNCTION qac_follow_up_commitments_set_updated_at();

-- RLS
ALTER TABLE qac_follow_up_commitments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qac_follow_up_commitments_select" ON qac_follow_up_commitments;
CREATE POLICY "qac_follow_up_commitments_select"
  ON qac_follow_up_commitments FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "qac_follow_up_commitments_insert" ON qac_follow_up_commitments;
CREATE POLICY "qac_follow_up_commitments_insert"
  ON qac_follow_up_commitments FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "qac_follow_up_commitments_update" ON qac_follow_up_commitments;
CREATE POLICY "qac_follow_up_commitments_update"
  ON qac_follow_up_commitments FOR UPDATE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  )
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );

DROP POLICY IF EXISTS "qac_follow_up_commitments_delete" ON qac_follow_up_commitments;
CREATE POLICY "qac_follow_up_commitments_delete"
  ON qac_follow_up_commitments FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
