-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 072: Schema reconciliation + idempotency infrastructure
--
-- WHY:
--   An audit found database objects referenced by application code (and by
--   migration 028's REVOKE/ALTER statements) that were never committed to
--   version control — they exist only in the live database, created out-of-band.
--   This makes a fresh `supabase db reset` non-reproducible and leaves the
--   `audit_logs` table (written by lib/admin-audit.ts) with NO row-level
--   security defined anywhere in source.
--
--   Everything here is created idempotently and NON-DESTRUCTIVELY:
--     - Columns/tables/indexes use IF NOT EXISTS.
--     - Functions are created ONLY IF ABSENT, so the live database's existing
--       definitions are never overwritten. (try_claim_call_slot is intentionally
--       omitted — it is owned by migration 044.)
--
--   Migration 028 was patched to tolerate these functions being absent when it
--   runs (they are created here, which sorts after 028), so a fresh reset
--   succeeds end-to-end.
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Defensive column (set by lib/updateWorkspaceMinutes); harmless if present
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE public.workspaces
  ADD COLUMN IF NOT EXISTS overage_blocked boolean NOT NULL DEFAULT false;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: audit_logs table + RLS (superadmin read, service-role write)
-- Referenced by lib/admin-audit.ts (write_audit_log RPC) and admin routes.
-- (Distinct from qac_audit_logs created in migration 042.)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  uuid REFERENCES public.workspaces(id) ON DELETE SET NULL,
  actor_id      uuid REFERENCES public.users(id) ON DELETE SET NULL,
  actor_type    text NOT NULL DEFAULT 'superadmin',
  action        text NOT NULL,
  target_type   text,
  target_id     uuid,
  metadata      jsonb NOT NULL DEFAULT '{}'::jsonb,
  ip            text,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id ON public.audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id     ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_action       ON public.audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at   ON public.audit_logs(created_at DESC);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- Only superadmins may read; writes happen via the service-role admin client
-- (which bypasses RLS), so no INSERT policy is granted to ordinary roles.
DROP POLICY IF EXISTS "audit_logs_superadmin_read" ON public.audit_logs;
CREATE POLICY "audit_logs_superadmin_read" ON public.audit_logs
  FOR SELECT USING (public.is_superadmin());


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: impersonation_sessions table + RLS (superadmin only)
-- Referenced by app/api/admin/workspaces/[id]/impersonate/route.ts.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.impersonation_sessions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id            uuid NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  target_workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  token               text NOT NULL UNIQUE,
  expires_at          timestamptz NOT NULL,
  ended_at            timestamptz,
  created_at          timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_admin_id ON public.impersonation_sessions(admin_id);
CREATE INDEX IF NOT EXISTS idx_impersonation_sessions_token    ON public.impersonation_sessions(token);

ALTER TABLE public.impersonation_sessions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "impersonation_superadmin_read" ON public.impersonation_sessions;
CREATE POLICY "impersonation_superadmin_read" ON public.impersonation_sessions
  FOR SELECT USING (public.is_superadmin());


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: Webhook idempotency ledger
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.processed_webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider     text NOT NULL,
  event_id     text NOT NULL,
  processed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider, event_id)
);

ALTER TABLE public.processed_webhook_events ENABLE ROW LEVEL SECURITY;
-- No policies: only the service-role client (bypasses RLS) touches this table.


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: Missing performance indexes
-- ─────────────────────────────────────────────────────────────────────────────

-- Inbound-call hot path looks up phone_numbers by E.164 number on every call.
CREATE UNIQUE INDEX IF NOT EXISTS idx_phone_numbers_number ON public.phone_numbers(number);

-- Twilio status webhook queries calls by routing_data->>twilio_call_sid (JSONB).
CREATE INDEX IF NOT EXISTS idx_calls_routing_data ON public.calls USING gin (routing_data);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: Billing / audit RPCs (create ONLY IF ABSENT)
-- Assumed present by migration 028 but never committed. try_claim_call_slot is
-- intentionally excluded (owned by migration 044).
-- ─────────────────────────────────────────────────────────────────────────────

-- finalize_call_billing: atomically add minutes AND release one concurrency slot
-- in a single UPDATE, returning post-update usage. Used by the LiveKit webhook.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'finalize_call_billing') THEN
    EXECUTE $fn$
      CREATE FUNCTION public.finalize_call_billing(p_workspace_id uuid, p_minutes numeric)
      RETURNS TABLE (new_minutes_used numeric, minutes_limit numeric, is_over_limit boolean)
      LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = public, pg_catalog AS $body$
      BEGIN
        RETURN QUERY
        UPDATE public.workspaces w
        SET minutes_used    = w.minutes_used + GREATEST(p_minutes, 0),
            active_calls     = GREATEST(w.active_calls - 1, 0),
            overage_blocked  = (w.minutes_used + GREATEST(p_minutes, 0)) >= w.minutes_limit
        WHERE w.id = p_workspace_id
        RETURNING w.minutes_used,
                  w.minutes_limit,
                  (w.minutes_used >= w.minutes_limit);
      END;
      $body$;
    $fn$;
  END IF;
END $$;

-- increment_workspace_minutes: atomic minute increment (no slot release).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_workspace_minutes') THEN
    EXECUTE $fn$
      CREATE FUNCTION public.increment_workspace_minutes(p_workspace_id uuid, p_minutes numeric)
      RETURNS TABLE (prev_minutes_used numeric, new_minutes_used numeric, minutes_limit numeric, owner_id uuid)
      LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = public, pg_catalog AS $body$
      DECLARE
        v_prev numeric;
      BEGIN
        SELECT w.minutes_used INTO v_prev FROM public.workspaces w
          WHERE w.id = p_workspace_id FOR UPDATE;
        RETURN QUERY
        UPDATE public.workspaces w
        SET minutes_used   = w.minutes_used + GREATEST(p_minutes, 0),
            overage_blocked = (w.minutes_used + GREATEST(p_minutes, 0)) >= w.minutes_limit
        WHERE w.id = p_workspace_id
        RETURNING v_prev, w.minutes_used, w.minutes_limit, w.owner_id;
      END;
      $body$;
    $fn$;
  END IF;
END $$;

-- increment_workspace_balance: atomic prepaid-balance credit (cents).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_workspace_balance') THEN
    EXECUTE $fn$
      CREATE FUNCTION public.increment_workspace_balance(p_workspace_id uuid, p_amount_cents integer)
      RETURNS integer
      LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = public, pg_catalog AS $body$
      DECLARE v_new integer;
      BEGIN
        UPDATE public.workspaces
        SET stripe_balance_cents = stripe_balance_cents + p_amount_cents
        WHERE id = p_workspace_id
        RETURNING stripe_balance_cents INTO v_new;
        RETURN v_new;
      END;
      $body$;
    $fn$;
  END IF;
END $$;

-- check_workspace_balance: returns true if the workspace can afford p_minutes.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'check_workspace_balance') THEN
    EXECUTE $fn$
      CREATE FUNCTION public.check_workspace_balance(p_workspace_id uuid, p_minutes numeric)
      RETURNS boolean
      LANGUAGE sql STABLE SECURITY DEFINER
      SET search_path = public, pg_catalog AS $body$
        SELECT COALESCE(
          (SELECT (minutes_used + GREATEST(p_minutes, 0)) <= minutes_limit
             FROM public.workspaces WHERE id = p_workspace_id),
          false
        );
      $body$;
    $fn$;
  END IF;
END $$;

-- release_call_slot: free one concurrency slot (floored at zero).
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'release_call_slot') THEN
    EXECUTE $fn$
      CREATE FUNCTION public.release_call_slot(p_workspace_id uuid)
      RETURNS void
      LANGUAGE sql SECURITY DEFINER
      SET search_path = public, pg_catalog AS $body$
        UPDATE public.workspaces
        SET active_calls = GREATEST(active_calls - 1, 0)
        WHERE id = p_workspace_id;
      $body$;
    $fn$;
  END IF;
END $$;

-- increment_agent_total_calls: atomic per-agent call counter.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'increment_agent_total_calls') THEN
    EXECUTE $fn$
      CREATE FUNCTION public.increment_agent_total_calls(p_agent_id uuid)
      RETURNS void
      LANGUAGE sql SECURITY DEFINER
      SET search_path = public, pg_catalog AS $body$
        UPDATE public.agents SET total_calls = COALESCE(total_calls, 0) + 1
        WHERE id = p_agent_id;
      $body$;
    $fn$;
  END IF;
END $$;

-- write_audit_log: insert an audit-trail row.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_proc WHERE proname = 'write_audit_log') THEN
    EXECUTE $fn$
      CREATE FUNCTION public.write_audit_log(
        p_actor_id uuid, p_actor_type text, p_action text, p_target_type text,
        p_target_id uuid, p_workspace_id uuid, p_metadata jsonb, p_ip text)
      RETURNS uuid
      LANGUAGE plpgsql SECURITY DEFINER
      SET search_path = public, pg_catalog AS $body$
      DECLARE v_id uuid;
      BEGIN
        INSERT INTO public.audit_logs
          (actor_id, actor_type, action, target_type, target_id, workspace_id, metadata, ip)
        VALUES
          (p_actor_id, COALESCE(p_actor_type, 'superadmin'), p_action, p_target_type,
           p_target_id, p_workspace_id, COALESCE(p_metadata, '{}'::jsonb), p_ip)
        RETURNING id INTO v_id;
        RETURN v_id;
      END;
      $body$;
    $fn$;
  END IF;
END $$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 7: Lock down the reconstructed functions (idempotent)
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.finalize_call_billing(uuid, numeric)        FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_workspace_minutes(uuid, numeric)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_workspace_balance(uuid, integer)  FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.check_workspace_balance(uuid, numeric)      FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_call_slot(uuid)                     FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_agent_total_calls(uuid)           FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.write_audit_log(uuid, text, text, text, uuid, uuid, jsonb, text) FROM PUBLIC;
