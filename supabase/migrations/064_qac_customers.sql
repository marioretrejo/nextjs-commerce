-- Migration 064: QA Center Phase 2B — Customer Identity + Call Threads
--
-- Creates:
--   · qac_customers          — canonical customer record per workspace
--   · qac_call_threads       — groups related calls into a conversation arc
--
-- Design rules:
--   · workspace_id NOT NULL on every table — enforced at column AND RLS level
--   · Uniqueness on phone/email enforced via PARTIAL UNIQUE INDEXES (not table
--     constraints) so that NULL values are excluded — prevents blocking inserts
--     when phone or email is absent, while still enforcing 1 record per value.
--   · CHECK: at least one of canonical_phone / canonical_email must be present
--   · All RLS UPDATE policies include both USING and WITH CHECK to prevent
--     workspace_id from being changed to one the user doesn't belong to.
--   · Admin client (service role) bypasses RLS — policies are defense-in-depth
--   · Fully idempotent: IF NOT EXISTS, CREATE OR REPLACE, DROP ... IF EXISTS
-- ─────────────────────────────────────────────────────────────────────────────


-- ── 1. qac_customers ──────────────────────────────────────────────────────────
-- One row per unique customer identity within a workspace.
-- canonical_phone is the primary identifier (E.164 format).
-- canonical_email is a secondary identifier (optional).
-- A customer must have at least one of phone or email.

CREATE TABLE IF NOT EXISTS qac_customers (
  id                 UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       UUID         NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  canonical_phone    TEXT,        -- E.164 normalised, e.g. "+15551234567"
  canonical_email    TEXT,        -- lower-cased
  display_name       TEXT         NOT NULL DEFAULT 'Unknown',
  first_seen_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  last_seen_at       TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  total_calls        INT          NOT NULL DEFAULT 0,
  lifetime_sentiment TEXT         CHECK (lifetime_sentiment IN ('positive', 'neutral', 'negative')),
  notes              TEXT,
  metadata           JSONB        NOT NULL DEFAULT '{}',
  created_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ  NOT NULL DEFAULT NOW(),

  -- At least one stable identifier must be present
  CONSTRAINT qac_customers_has_identity
    CHECK (canonical_phone IS NOT NULL OR canonical_email IS NOT NULL)
  -- NOTE: uniqueness for phone/email enforced via partial indexes below,
  -- NOT table-level UNIQUE constraints, to correctly handle NULL values.
);

-- Lookup indexes
CREATE INDEX IF NOT EXISTS qac_customers_workspace_idx
  ON qac_customers(workspace_id);

CREATE INDEX IF NOT EXISTS qac_customers_last_seen_idx
  ON qac_customers(workspace_id, last_seen_at DESC);

-- Partial unique indexes: enforce one record per (workspace, phone) and
-- (workspace, email) only when the value is present.
-- Rows with phone=NULL or email=NULL are excluded from these indexes entirely,
-- so multiple customers without a phone (or without an email) are allowed.
CREATE UNIQUE INDEX IF NOT EXISTS qac_customers_phone_unique
  ON qac_customers(workspace_id, canonical_phone)
  WHERE canonical_phone IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS qac_customers_email_unique
  ON qac_customers(workspace_id, canonical_email)
  WHERE canonical_email IS NOT NULL;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION qac_customers_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS qac_customers_updated_at_trigger ON qac_customers;
CREATE TRIGGER qac_customers_updated_at_trigger
  BEFORE UPDATE ON qac_customers
  FOR EACH ROW EXECUTE FUNCTION qac_customers_set_updated_at();

-- RLS
ALTER TABLE qac_customers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qac_customers_select" ON qac_customers;
CREATE POLICY "qac_customers_select"
  ON qac_customers FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "qac_customers_insert" ON qac_customers;
CREATE POLICY "qac_customers_insert"
  ON qac_customers FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "qac_customers_update" ON qac_customers;
CREATE POLICY "qac_customers_update"
  ON qac_customers FOR UPDATE
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

DROP POLICY IF EXISTS "qac_customers_delete" ON qac_customers;
CREATE POLICY "qac_customers_delete"
  ON qac_customers FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );


-- ── 2. qac_call_threads ───────────────────────────────────────────────────────
-- Groups related calls from the same customer into a conversation arc.
-- A thread represents one "case" or "negotiation" (e.g., a contract dispute).
-- One customer can have multiple threads (different topics over time).

CREATE TABLE IF NOT EXISTS qac_call_threads (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID         NOT NULL REFERENCES workspaces(id)    ON DELETE CASCADE,
  customer_id     UUID         NOT NULL REFERENCES qac_customers(id) ON DELETE CASCADE,
  title           TEXT,        -- human-readable label, e.g. "Contract renegotiation Q2"
  status          TEXT         NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'resolved', 'escalated', 'abandoned')),
  intent          TEXT,        -- primary intent/topic of this thread
  outcome         TEXT,        -- final outcome when status = resolved/escalated
  call_count      INT          NOT NULL DEFAULT 0,
  first_call_at   TIMESTAMPTZ,
  last_call_at    TIMESTAMPTZ,
  resolved_at     TIMESTAMPTZ,
  metadata        JSONB        NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS qac_call_threads_customer_idx
  ON qac_call_threads(customer_id, created_at DESC);

CREATE INDEX IF NOT EXISTS qac_call_threads_workspace_idx
  ON qac_call_threads(workspace_id, status, last_call_at DESC);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION qac_call_threads_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS qac_call_threads_updated_at_trigger ON qac_call_threads;
CREATE TRIGGER qac_call_threads_updated_at_trigger
  BEFORE UPDATE ON qac_call_threads
  FOR EACH ROW EXECUTE FUNCTION qac_call_threads_set_updated_at();

-- RLS
ALTER TABLE qac_call_threads ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "qac_call_threads_select" ON qac_call_threads;
CREATE POLICY "qac_call_threads_select"
  ON qac_call_threads FOR SELECT
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "qac_call_threads_insert" ON qac_call_threads;
CREATE POLICY "qac_call_threads_insert"
  ON qac_call_threads FOR INSERT
  WITH CHECK (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "qac_call_threads_update" ON qac_call_threads;
CREATE POLICY "qac_call_threads_update"
  ON qac_call_threads FOR UPDATE
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

DROP POLICY IF EXISTS "qac_call_threads_delete" ON qac_call_threads;
CREATE POLICY "qac_call_threads_delete"
  ON qac_call_threads FOR DELETE
  USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members
      WHERE user_id = auth.uid() AND role IN ('owner', 'admin')
    )
  );
