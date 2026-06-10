-- Migration 055: Campaign Outbound Engine enhancements (Fase 13)
--
-- campaigns and campaign_contacts already exist (migration 001).
-- This migration adds:
--   1. campaigns.configuration JSONB   — flexible per-campaign runtime settings
--   2. campaign_contacts: excluded/completed/failed status values + campaign_lead_id column
--   3. Composite index on (campaign_id, status) for high-concurrency queue polling
--   4. Postgres function claim_campaign_contacts for race-free lead claiming

-- ── 1. campaigns.configuration ────────────────────────────────────────────────

ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS configuration JSONB NULL DEFAULT '{}'::jsonb;

COMMENT ON COLUMN public.campaigns.configuration IS
  'Per-campaign runtime settings, e.g. {"cooldown_minutes": 60, "webhook_url": "..."}. '
  'These override workspace-level defaults when present.';

-- ── 2. campaign_contacts status expansion + campaign_lead_id ─────────────────

-- Expand the status CHECK constraint to include excluded/completed/failed.
-- Inline CHECK constraints may have auto-generated names; we find and drop the
-- existing one before recreating it with the full value set.
DO $$
DECLARE
  v_conname text;
BEGIN
  SELECT conname INTO v_conname
  FROM pg_constraint
  WHERE conrelid = 'public.campaign_contacts'::regclass
    AND contype = 'c'
    AND pg_get_constraintdef(oid) ILIKE '%status%';

  IF v_conname IS NOT NULL THEN
    EXECUTE format('ALTER TABLE public.campaign_contacts DROP CONSTRAINT %I', v_conname);
  END IF;
END $$;

ALTER TABLE public.campaign_contacts
  ADD CONSTRAINT campaign_contacts_status_check
  CHECK (status IN (
    'pending',
    'calling',
    'converted',
    'no_answer',
    'invalid',
    'rejected',
    'voicemail',
    'max_attempts',
    'excluded',
    'completed',
    'failed'
  ));

-- External lead identifier: optional CRM/system ID passed into bot metadata
-- so the worker can fetch personalized context at call start.
ALTER TABLE public.campaign_contacts
  ADD COLUMN IF NOT EXISTS campaign_lead_id TEXT NULL;

COMMENT ON COLUMN public.campaign_contacts.campaign_lead_id IS
  'Optional external identifier (CRM, spreadsheet row ID, etc.) injected as '
  '"contact_id" in room metadata so the worker fetches name + variables at start.';

-- ── 3. Indexes ────────────────────────────────────────────────────────────────

-- Queue polling: dispatcher selects pending contacts per campaign
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_queue
  ON public.campaign_contacts (campaign_id, status)
  WHERE status IN ('pending', 'calling');

-- Worker lookup by external lead ID
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_lead_id
  ON public.campaign_contacts (campaign_lead_id)
  WHERE campaign_lead_id IS NOT NULL;

-- ── 4. Claim function — FOR UPDATE SKIP LOCKED ────────────────────────────────
-- Atomically claims up to p_limit pending contacts for a single campaign,
-- transitioning them to 'calling' and incrementing attempts in one statement.
-- Multiple concurrent dispatchers will never claim the same row.

CREATE OR REPLACE FUNCTION public.claim_campaign_contacts(
  p_campaign_id  UUID,
  p_limit        INT  DEFAULT 10
)
RETURNS SETOF public.campaign_contacts
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.campaign_contacts
  SET
    status        = 'calling',
    attempts      = attempts + 1,
    last_called_at = now()
  WHERE id IN (
    SELECT id
    FROM   public.campaign_contacts
    WHERE  campaign_id = p_campaign_id
      AND  status      = 'pending'
    ORDER  BY created_at ASC
    LIMIT  p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_campaign_contacts(UUID, INT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_campaign_contacts(UUID, INT) TO service_role;
