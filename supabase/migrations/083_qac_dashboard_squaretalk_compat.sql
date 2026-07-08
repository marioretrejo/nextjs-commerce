-- Migration 083: QA Center dashboard and Squaretalk compatibility
--
-- Keeps the CDR model tolerant of older QA Center rows while the new Dashboard,
-- webhook ingestion and GROQ pipeline use the normalized qac_* tables.

ALTER TABLE qac_interactions
  ADD COLUMN IF NOT EXISTS provider TEXT,
  ADD COLUMN IF NOT EXISTS agent_name TEXT,
  ADD COLUMN IF NOT EXISTS agent_extension TEXT,
  ADD COLUMN IF NOT EXISTS department_name TEXT,
  ADD COLUMN IF NOT EXISTS audio_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_s INTEGER,
  ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS transcript TEXT,
  ADD COLUMN IF NOT EXISTS source_payload JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE qac_departments
  ADD COLUMN IF NOT EXISTS auto_analyze BOOLEAN NOT NULL DEFAULT TRUE,
  ALTER COLUMN auto_analyze SET DEFAULT TRUE;

UPDATE qac_interactions
SET
  recording_url = COALESCE(recording_url, audio_url),
  duration_seconds = COALESCE(duration_seconds, duration_s),
  call_started_at = COALESCE(call_started_at, started_at),
  raw_payload = COALESCE(raw_payload, source_payload, '{}'::jsonb)
WHERE TRUE;

CREATE INDEX IF NOT EXISTS qac_interactions_agent_name_idx
  ON qac_interactions(workspace_id, agent_name)
  WHERE agent_name IS NOT NULL;

CREATE INDEX IF NOT EXISTS qac_interactions_department_name_idx
  ON qac_interactions(workspace_id, department_name)
  WHERE department_name IS NOT NULL;
