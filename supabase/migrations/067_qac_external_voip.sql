-- Migration 067: QA Center — External VoIP Ingestion Hardening
--
-- Adds to qac_interactions:
--   · external_call_id — provider's unique call ID (idempotency key)
--   · provider         — "squaretalk", "voiso", "twilio", etc.
--   · talk_time_s      — actual talk time in seconds (vs total duration)
--   · started_at       — call start timestamp from the provider
--   · department_name  — agent department / team / queue
--   · agent_extension  — VoIP extension number
--   · source_payload   — sanitized raw provider payload (secrets stripped)
--
-- Idempotency:
--   Partial unique index on (workspace_id, provider, external_call_id)
--   WHERE both are NOT NULL — legacy rows and missing IDs are excluded.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE qac_interactions
  ADD COLUMN IF NOT EXISTS external_call_id TEXT,
  ADD COLUMN IF NOT EXISTS provider         TEXT,
  ADD COLUMN IF NOT EXISTS talk_time_s      INT,
  ADD COLUMN IF NOT EXISTS started_at       TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS department_name  TEXT,
  ADD COLUMN IF NOT EXISTS agent_extension  TEXT,
  ADD COLUMN IF NOT EXISTS source_payload   JSONB;

-- Idempotency: one interaction per (workspace, provider, external_call_id).
-- NULL values in either column are excluded so old/missing IDs never conflict.
CREATE UNIQUE INDEX IF NOT EXISTS qac_interactions_external_id_idx
  ON qac_interactions(workspace_id, provider, external_call_id)
  WHERE external_call_id IS NOT NULL AND provider IS NOT NULL;

-- Fast provider filter (e.g., WHERE workspace_id = $1 AND provider = 'squaretalk')
CREATE INDEX IF NOT EXISTS qac_interactions_provider_idx
  ON qac_interactions(workspace_id, provider)
  WHERE provider IS NOT NULL;

-- Fast department filter for per-team reporting
CREATE INDEX IF NOT EXISTS qac_interactions_dept_idx
  ON qac_interactions(workspace_id, department_name)
  WHERE department_name IS NOT NULL;
