-- Migration 050: Billing circuit breaker — get_workspace_billing_status RPC
--
-- Returns a structured snapshot of a workspace's billing state so that the
-- agent worker can make a single atomic pre-flight decision without racing
-- against multiple column reads.
--
-- is_frozen = true means the workspace must NOT start or continue a call:
--   • billing_status = 'suspended_for_nonpayment'
--   • overage_blocked = true
--   • pay-as-you-go balance below minimum threshold ($0.50 = 50 cents)
--   • enterprise cap exhausted (minute_cap IS NOT NULL AND minutes_used >= minutes_limit)

CREATE OR REPLACE FUNCTION public.get_workspace_billing_status(p_workspace_id uuid)
RETURNS json
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_balance_cents   integer;
  v_billing_status  text;
  v_overage_blocked boolean;
  v_minute_cap      integer;
  v_minutes_used    decimal;
  v_minutes_limit   integer;
  v_is_frozen       boolean;
BEGIN
  SELECT
    stripe_balance_cents,
    billing_status,
    overage_blocked,
    minute_cap,
    minutes_used,
    minutes_limit
  INTO
    v_balance_cents,
    v_billing_status,
    v_overage_blocked,
    v_minute_cap,
    v_minutes_used,
    v_minutes_limit
  FROM workspaces
  WHERE id = p_workspace_id;

  IF NOT FOUND THEN
    RETURN json_build_object(
      'balance_cents',       0,
      'is_frozen',           true,
      'billing_status',      'unknown',
      'overage_blocked',     true,
      'min_threshold_cents', 50,
      'reason',              'workspace_not_found'
    );
  END IF;

  v_is_frozen := (
    -- Explicitly suspended account
    v_billing_status = 'suspended_for_nonpayment'
    -- Admin-blocked for overage
    OR v_overage_blocked = true
    -- Pay-as-you-go: balance below $0.50 minimum (50 cents)
    OR (v_minute_cap IS NULL AND COALESCE(v_balance_cents, 0) < 50)
    -- Enterprise cap: all pre-paid minutes consumed
    OR (v_minute_cap IS NOT NULL
        AND v_minutes_limit IS NOT NULL
        AND v_minutes_limit > 0
        AND COALESCE(v_minutes_used, 0) >= v_minutes_limit)
  );

  RETURN json_build_object(
    'balance_cents',       COALESCE(v_balance_cents, 0),
    'is_frozen',           v_is_frozen,
    'billing_status',      COALESCE(v_billing_status, 'unknown'),
    'overage_blocked',     COALESCE(v_overage_blocked, false),
    'min_threshold_cents', 50
  );
END;
$$;

-- Only service_role (used by the agent worker via admin Supabase client) can call this.
-- Authenticated users must not be able to read others' balance data.
REVOKE EXECUTE ON FUNCTION public.get_workspace_billing_status(uuid) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_workspace_billing_status(uuid) TO service_role;
