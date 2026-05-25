-- Migration 015: Bulletproof minute enforcement

-- Ensure minutes_used is DECIMAL for precision
ALTER TABLE workspaces
  ALTER COLUMN minutes_used TYPE DECIMAL(10,2) USING minutes_used::DECIMAL(10,2);

-- Add enforcement columns
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS overage_blocked  BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS minutes_reset_at TIMESTAMP WITH TIME ZONE;

-- Add pause_reason to campaigns for limit enforcement
ALTER TABLE campaigns
  ADD COLUMN IF NOT EXISTS pause_reason TEXT;

-- pg_cron monthly reset (requires pg_cron extension enabled in Supabase)
-- Schedule: 00:01 UTC on 1st of every month
-- Run in Supabase SQL editor to enable:
/*
SELECT cron.schedule(
  'monthly-minutes-reset',
  '1 0 1 * *',
  $$
    UPDATE workspaces
    SET
      minutes_used      = 0,
      overage_blocked   = FALSE,
      minutes_reset_at  = NOW()
    WHERE minutes_used > 0 OR overage_blocked = TRUE;

    INSERT INTO workspace_events (workspace_id, event_type, details)
    SELECT
      id,
      'minutes_reset',
      jsonb_build_object('reset_at', NOW(), 'previous_minutes_used', minutes_used)
    FROM workspaces
    WHERE minutes_limit > 0;

    INSERT INTO notifications (user_id, type, title, body)
    SELECT
      w.owner_id,
      'minutes_reset',
      'Your minutes have reset',
      'You have ' || w.minutes_limit || ' minutes available this month.'
    FROM workspaces w
    WHERE w.minutes_limit > 0;
  $$
);
*/
