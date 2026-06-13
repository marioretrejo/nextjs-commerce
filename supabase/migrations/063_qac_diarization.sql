-- Migration 063: QA Center Phase 2A — Speaker Diarization
-- Adds diarized transcript storage and per-flag speaker attribution.
-- Fully idempotent: ADD COLUMN IF NOT EXISTS, CREATE INDEX IF NOT EXISTS.

-- Speaker-diarized transcript (JSONB). Null when Groq Whisper fallback was used.
ALTER TABLE qac_interactions
  ADD COLUMN IF NOT EXISTS diarized_transcript JSONB;

-- Who said the flagged statement (agent | customer | unknown). Null when not determinable.
ALTER TABLE qac_flags
  ADD COLUMN IF NOT EXISTS speaker TEXT
    CHECK (speaker IN ('agent', 'customer', 'unknown'));

-- Partial index: speeds up queries that filter by whether diarization succeeded.
CREATE INDEX IF NOT EXISTS qac_interactions_diarized_idx
  ON qac_interactions(workspace_id, created_at DESC)
  WHERE diarized_transcript IS NOT NULL;
