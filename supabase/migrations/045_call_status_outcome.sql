-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 045: Granular call lifecycle columns
--
-- Adds separate columns for technical call status and business outcome,
-- replacing the single status/outcome fields with a richer schema that
-- supports the full VoiceOS call lifecycle.
--
-- technical_status tracks the SIP/media-layer state of the call.
-- business_outcome captures what happened from a sales/ops perspective.
-- end_reason is a short freetext label (e.g. 'silence_timeout', 'dnc').
-- answered_at / ended_at enable accurate talk-time analytics.
--
-- NOTE: The legacy `status` column is kept for backwards compatibility with
-- existing UI queries. The worker writes BOTH columns so old and new code
-- work during the migration window.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS technical_status text
    CHECK (technical_status IN (
      'initiated', 'ringing', 'in_progress', 'completed',
      'failed', 'no_answer', 'busy', 'cancelled'
    )),
  ADD COLUMN IF NOT EXISTS business_outcome text
    CHECK (business_outcome IN (
      'voicemail', 'contacted', 'interested', 'not_interested',
      'dnc', 'transferred', 'silence_timeout', 'error'
    )),
  ADD COLUMN IF NOT EXISTS end_reason     text,
  ADD COLUMN IF NOT EXISTS answered_at    timestamptz,
  ADD COLUMN IF NOT EXISTS ended_at       timestamptz;

-- Workspace-scoped index for call analytics dashboards
CREATE INDEX IF NOT EXISTS idx_calls_technical_status
  ON public.calls (workspace_id, technical_status)
  WHERE technical_status IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calls_business_outcome
  ON public.calls (workspace_id, business_outcome)
  WHERE business_outcome IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_calls_answered_at
  ON public.calls (workspace_id, answered_at DESC)
  WHERE answered_at IS NOT NULL;
