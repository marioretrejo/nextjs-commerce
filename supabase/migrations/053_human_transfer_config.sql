-- Migration 053: Human Transfer Configuration
--
-- 1. Adds transfer_target_phone to phone_numbers so each inbound DID can
--    declare its own human-agent destination (call center number or SIP URI).
--    Falls back to VOICEOS_GLOBAL_TRANSFER_FALLBACK env var when NULL.
--
-- 2. Expands the business_outcome CHECK constraint to include
--    'transferred_to_human' — a distinct outcome from the generic 'transferred'
--    (which was the SIP-REFER path). This value is written when the worker
--    confirms a Twilio call-redirect or SIP REFER succeeded.

-- ── 1. phone_numbers ─────────────────────────────────────────────────────────

ALTER TABLE public.phone_numbers
  ADD COLUMN IF NOT EXISTS transfer_target_phone TEXT;

COMMENT ON COLUMN public.phone_numbers.transfer_target_phone IS
  'E.164 number or sip: URI to redirect the call to when transfer_to_human fires.
   NULL → worker falls back to agents.transfer_number, then VOICEOS_GLOBAL_TRANSFER_FALLBACK env var.';

-- ── 2. Expand business_outcome CHECK constraint ───────────────────────────────
-- Postgres CHECK constraints cannot be altered in place — drop and recreate.

ALTER TABLE public.calls
  DROP CONSTRAINT IF EXISTS calls_business_outcome_check;

ALTER TABLE public.calls
  ADD CONSTRAINT calls_business_outcome_check
  CHECK (business_outcome IN (
    'voicemail',
    'contacted',
    'interested',
    'not_interested',
    'dnc',
    'transferred',
    'transferred_to_human',
    'silence_timeout',
    'error'
  ));
