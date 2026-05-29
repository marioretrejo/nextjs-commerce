-- 025: Call lifecycle — concurrency management + billing RPCs
--
-- Adds the columns and functions required by the outbound dial routes,
-- the LiveKit/Twilio webhooks, and the agent worker for tracking active
-- calls, claiming/releasing concurrency slots, and finalizing billing.

-- ── Workspaces: concurrency tracking ──────────────────────────────────────────
ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS active_calls           integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS concurrent_calls_limit integer NOT NULL DEFAULT 5;

-- ─── try_claim_call_slot ──────────────────────────────────────────────────────
-- Atomically increments active_calls iff the workspace is under its concurrent
-- limit, not suspended, and has minutes remaining. Returns TRUE if claimed.
CREATE OR REPLACE FUNCTION try_claim_call_slot(p_workspace_id uuid)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_rows integer;
BEGIN
  UPDATE workspaces
  SET    active_calls = active_calls + 1
  WHERE  id            = p_workspace_id
    AND  active_calls  < concurrent_calls_limit
    AND  billing_status = 'active'
    AND  minutes_used   < minutes_limit;

  GET DIAGNOSTICS v_rows = ROW_COUNT;
  RETURN v_rows > 0;
END;
$$;

-- ─── release_call_slot ────────────────────────────────────────────────────────
-- Decrements active_calls (floor 0). Called on error before the call starts.
CREATE OR REPLACE FUNCTION release_call_slot(p_workspace_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE workspaces
  SET active_calls = GREATEST(0, active_calls - 1)
  WHERE id = p_workspace_id;
END;
$$;

-- ─── finalize_call_billing ────────────────────────────────────────────────────
-- Atomically adds p_minutes to minutes_used AND releases the concurrency slot
-- in one round-trip. Returns the new totals so callers can detect limit breach.
CREATE OR REPLACE FUNCTION finalize_call_billing(
  p_workspace_id uuid,
  p_minutes      numeric
)
RETURNS TABLE(new_minutes_used numeric, minutes_limit integer, is_over_limit boolean)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE workspaces
  SET minutes_used = minutes_used + p_minutes,
      active_calls = GREATEST(0, active_calls - 1)
  WHERE id = p_workspace_id;

  RETURN QUERY
  SELECT
    w.minutes_used::numeric            AS new_minutes_used,
    w.minutes_limit                    AS minutes_limit,
    (w.minutes_used >= w.minutes_limit) AS is_over_limit
  FROM workspaces w
  WHERE w.id = p_workspace_id;
END;
$$;

-- ─── check_workspace_balance ─────────────────────────────────────────────────
-- Returns TRUE if the workspace's projected total (current minutes_used +
-- p_elapsed_min) meets or exceeds the limit — the worker uses this every 60 s
-- to kill a call that is about to run over.
CREATE OR REPLACE FUNCTION check_workspace_balance(
  p_workspace_id uuid,
  p_elapsed_min  numeric
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_ws record;
BEGIN
  SELECT minutes_used, minutes_limit
  INTO   v_ws
  FROM   workspaces
  WHERE  id = p_workspace_id;

  IF NOT FOUND THEN RETURN false; END IF;

  RETURN (v_ws.minutes_used + p_elapsed_min) >= v_ws.minutes_limit;
END;
$$;

-- ─── increment_agent_total_calls ─────────────────────────────────────────────
-- Increments the agent's total_calls counter. Called by the LiveKit webhook
-- after each room_finished event.
CREATE OR REPLACE FUNCTION increment_agent_total_calls(p_agent_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE agents
  SET total_calls = COALESCE(total_calls, 0) + 1
  WHERE id = p_agent_id;
END;
$$;
