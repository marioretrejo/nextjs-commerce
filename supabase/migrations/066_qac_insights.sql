-- Migration 066: QA Center Phase 2B — Journey Insights + qac_interactions FK
--
-- Creates:
--   · qac_journey_insights          — LLM-generated insights per customer/thread
--
-- Modifies:
--   · qac_interactions               — ADD COLUMN customer_id (nullable FK)
--
-- Design rules:
--   · qac_journey_insights is append-only (no updated_at — rows are not mutated)
--   · expires_at allows stale insight invalidation without DELETE
--   · qac_interactions.customer_id is NULLABLE — historical rows keep NULL
--   · ON DELETE SET NULL on customer_id FK: if customer deleted, interaction
--     loses the link but is never deleted (call records are permanent)
--   · Partial index on qac_interactions.customer_id WHERE NOT NULL for efficiency
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. qac_journey_insights ───────────────────────────────────────────────────
-- Periodic LLM-synthesized insights about a customer's full journey.
-- One row per insight event (multiple types can exist per customer).
-- Append-only — not updated after creation; superseded insights get new rows.

CREATE TABLE IF NOT EXISTS qac_journey_insights (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID         NOT NULL REFERENCES workspaces(id)    ON DELETE CASCADE,
  customer_id      UUID         NOT NULL REFERENCES qac_customers(id) ON DELETE CASCADE,
  thread_id        UUID         REFERENCES qac_call_threads(id)       ON DELETE SET NULL,
  insight_type     TEXT         NOT NULL
    CHECK (insight_type IN (
      'journey_summary',
      'churn_risk',
      'upsell_signal',
      'complaint_pattern',
      'loyalty_signal'
    )),
  content          TEXT         NOT NULL CHECK (char_length(content) >= 1),
  confidence       NUMERIC(3,2) CHECK (confidence >= 0.00 AND confidence <= 1.00),
  generated_at     TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  expires_at       TIMESTAMPTZ, -- null = never expires; set to invalidate stale insights
  metadata         JSONB        NOT NULL DEFAULT '{}',
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW()
  -- No updated_at: insights are immutable once generated; create new row to supersede
);

-- Indexes
CREATE INDEX IF NOT EXISTS qac_journey_insights_customer_idx
  ON qac_journey_insights(customer_id, insight_type, generated_at DESC);

CREATE INDEX IF NOT EXISTS qac_journey_insights_workspace_idx
  ON qac_journey_insights(workspace_id, generated_at DESC);

-- NOTE: a partial index WHERE expires_at > NOW() is not possible because NOW()
-- is STABLE, not IMMUTABLE. Active-insight queries filter at runtime instead;
-- qac_journey_insights_customer_idx covers that access pattern efficiently.

-- RLS
ALTER TABLE qac_journey_insights ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qac_journey_insights_select" ON qac_journey_insights;
CREATE POLICY "qac_journey_insights_select"
  ON qac_journey_insights FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "qac_journey_insights_insert" ON qac_journey_insights;
CREATE POLICY "qac_journey_insights_insert"
  ON qac_journey_insights FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "qac_journey_insights_delete" ON qac_journey_insights;
CREATE POLICY "qac_journey_insights_delete"
  ON qac_journey_insights FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );


-- ── 2. qac_interactions.customer_id ──────────────────────────────────────────
-- Links a call interaction to a known customer.
-- NULLABLE: historical rows created before this migration keep customer_id = NULL.
-- ON DELETE SET NULL: if a customer record is deleted, the interaction is preserved
-- but loses its customer link (call records are permanent).

ALTER TABLE qac_interactions
  ADD COLUMN IF NOT EXISTS customer_id UUID
    REFERENCES qac_customers(id) ON DELETE SET NULL;

-- Partial index: only indexes rows that have been linked to a customer.
-- Skips the majority of historical rows (customer_id = NULL) for efficiency.
CREATE INDEX IF NOT EXISTS qac_interactions_customer_id_idx
  ON qac_interactions(workspace_id, customer_id, created_at DESC)
  WHERE customer_id IS NOT NULL;
