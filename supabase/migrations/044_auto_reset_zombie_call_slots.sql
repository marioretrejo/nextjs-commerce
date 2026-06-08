-- ─────────────────────────────────────────────────────────────────────────────
-- Auto-reset zombie active_calls slots
--
-- Problem: if a worker crashes before its Close handler fires, the slot it
-- claimed via try_claim_call_slot is never released, and active_calls grows
-- until no new calls can start.
--
-- Solution:
--   1. Track WHEN the most recent slot was claimed (active_calls_last_claimed_at)
--   2. A pg_cron job runs every 5 min and resets active_calls = 0 for any
--      workspace where active_calls > 0 but the last claim was > 2 hours ago.
--
-- Safety: since minutes_limit caps calls at ≤ 60 min, any slot that was
-- claimed more than 2 hours ago is definitively stale, regardless of how
-- many other calls happened in between.
-- ─────────────────────────────────────────────────────────────────────────────

-- Step 1: Add timestamp column (nullable — NULL means no claim yet this cycle)
ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS active_calls_last_claimed_at TIMESTAMPTZ;

-- Step 2: Update try_claim_call_slot to stamp the claim time
CREATE OR REPLACE FUNCTION public.try_claim_call_slot(p_workspace_id uuid)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
DECLARE
  v_claimed BOOLEAN := FALSE;
BEGIN
  UPDATE workspaces
  SET
    active_calls                   = active_calls + 1,
    active_calls_last_claimed_at   = NOW()
  WHERE  id           = p_workspace_id
    AND  active_calls < concurrent_calls_limit
    AND  minutes_used < minutes_limit
  RETURNING TRUE INTO v_claimed;

  RETURN COALESCE(v_claimed, FALSE);
END;
$$;

-- Revoke public access (matches existing security posture)
REVOKE EXECUTE ON FUNCTION public.try_claim_call_slot(uuid) FROM PUBLIC;

-- Step 3: pg_cron job — every 5 minutes, release slots older than 2 hours
SELECT cron.schedule(
  'reset-stale-call-slots',
  '*/5 * * * *',
  $$
  UPDATE public.workspaces
  SET    active_calls = 0
  WHERE  active_calls > 0
    AND  active_calls_last_claimed_at < NOW() - INTERVAL '2 hours';
  $$
);
