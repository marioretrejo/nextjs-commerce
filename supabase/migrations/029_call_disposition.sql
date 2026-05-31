-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 029: Call Disposition + Post-Call Analytics columns
--
-- Adds:
--   disposition  VARCHAR(50) — AI-extracted sales/call outcome
--   tokens_used  INTEGER     — LLM tokens consumed during analyze-call job
--
-- Valid disposition values:
--   meeting_booked    — prospect agreed to a meeting or appointment
--   not_interested    — prospect declined or showed clear disinterest
--   voicemail         — reached voicemail or automated answering system
--   follow_up         — needs a follow-up call or contact
--   callback_requested — caller asked to be called back at a later time
--   completed         — goal achieved without a specific categorical outcome
--   transferred       — call handed off to a human agent
--   other             — does not fit any defined category
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS disposition  VARCHAR(50)
    CHECK (disposition IN (
      'meeting_booked', 'not_interested', 'voicemail',
      'follow_up', 'callback_requested', 'completed', 'transferred', 'other'
    )),
  ADD COLUMN IF NOT EXISTS tokens_used  INTEGER;

CREATE INDEX IF NOT EXISTS idx_calls_disposition ON public.calls(disposition)
  WHERE disposition IS NOT NULL;
