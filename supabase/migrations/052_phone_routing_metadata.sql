-- Migration 052: Per-number metadata configuration for dynamic prompt injection
--
-- Adds metadata_config JSONB to the existing phone_numbers table.
-- These key/value pairs are merged with system variables (current_date, etc.)
-- and injected into the agent system_prompt via the template compiler before
-- each inbound call starts.
--
-- Example: {"branch": "Norte", "city": "Monterrey", "campaign": "Verano2025"}
--
-- The column is nullable; NULL and {} are both treated as "no per-number vars".

ALTER TABLE phone_numbers
  ADD COLUMN IF NOT EXISTS metadata_config jsonb NULL DEFAULT '{}';

COMMENT ON COLUMN phone_numbers.metadata_config IS
  'Static context variables injected into the agent system_prompt template '
  'for calls received on this number. Keys correspond to {{variable}} '
  'placeholders in the prompt. Values must be strings.';

-- RLS: the existing phone_numbers policies already cover workspace members.
-- No new policies needed — metadata_config is governed by the same rules.
