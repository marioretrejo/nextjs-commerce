-- Migration 060: Provider Health Checks
-- Stores periodic health snapshots computed from call_events, post_call_jobs,
-- and call_cost_events. Enables the Provider Health Dashboard.
--
-- circuit_state is INFERRED from event patterns — not a real circuit breaker
-- state machine. See docs/provider-health.md for the distinction.

CREATE TABLE IF NOT EXISTS public.provider_health_checks (
  id                  uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  -- NULL = global/platform-level; set = workspace-scoped snapshot
  workspace_id        uuid        NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  provider            text        NOT NULL,
  provider_type       text        NOT NULL
    CHECK (provider_type IN (
      'llm','tts','stt','telephony','database','webhook','jobs','cron','realtime','internal'
    )),
  status              text        NOT NULL
    CHECK (status IN ('healthy','degraded','down','unknown')),
  latency_ms          integer     NULL,
  error_rate          numeric(7,4) NULL,     -- 0.0000–1.0000
  success_rate        numeric(7,4) NULL,
  sample_size         integer     NOT NULL DEFAULT 0,
  window_seconds      integer     NOT NULL DEFAULT 300,
  circuit_state       text        NOT NULL DEFAULT 'closed'
    CHECK (circuit_state IN ('closed','half_open','open','disabled','unknown')),
  fallback_provider   text        NULL,
  fallback_count      integer     NOT NULL DEFAULT 0,
  last_error_code     text        NULL,
  last_error_message  text        NULL,     -- sanitized, max 200 chars
  metadata            jsonb       NOT NULL DEFAULT '{}'::jsonb,
  checked_at          timestamptz NOT NULL DEFAULT now(),
  created_at          timestamptz NOT NULL DEFAULT now()
);

-- ── Indexes ─────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_phc_provider_checked
  ON public.provider_health_checks (provider, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_phc_type_checked
  ON public.provider_health_checks (provider_type, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_phc_status_checked
  ON public.provider_health_checks (status, checked_at DESC);

CREATE INDEX IF NOT EXISTS idx_phc_workspace_checked
  ON public.provider_health_checks (workspace_id, checked_at DESC)
  WHERE workspace_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_phc_circuit_checked
  ON public.provider_health_checks (circuit_state, checked_at DESC);

-- ── Row Level Security ───────────────────────────────────────────────────────────
ALTER TABLE public.provider_health_checks ENABLE ROW LEVEL SECURITY;

-- Superadmins can read all rows including global (workspace_id IS NULL)
CREATE POLICY "phc_superadmin_select"
  ON public.provider_health_checks
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users u
      WHERE u.id = auth.uid() AND u.is_superadmin = true
    )
  );

-- Workspace members can read their workspace's checks (workspace_id IS NOT NULL)
CREATE POLICY "phc_workspace_member_select"
  ON public.provider_health_checks
  FOR SELECT USING (
    workspace_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.workspaces w
        LEFT JOIN public.workspace_members wm
          ON wm.workspace_id = w.id
          AND wm.user_id = auth.uid()
          AND wm.status = 'active'
        WHERE w.id = workspace_id
          AND (w.owner_id = auth.uid() OR wm.id IS NOT NULL)
      )
    )
  );

-- ── RPC: get_provider_health_summary ────────────────────────────────────────────
-- Returns the latest snapshot per provider within the given window.
-- Used by the health API to avoid re-scanning call_events on every request.
CREATE OR REPLACE FUNCTION public.get_provider_health_summary(
  p_workspace_id  uuid    DEFAULT NULL,
  p_window_minutes integer DEFAULT 15
)
RETURNS TABLE (
  provider          text,
  provider_type     text,
  status            text,
  circuit_state     text,
  latency_ms        integer,
  error_rate        numeric,
  success_rate      numeric,
  sample_size       integer,
  fallback_count    integer,
  fallback_provider text,
  last_error_code   text,
  last_error_message text,
  checked_at        timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT ON (provider)
    provider,
    provider_type,
    status,
    circuit_state,
    latency_ms,
    error_rate,
    success_rate,
    sample_size,
    fallback_count,
    fallback_provider,
    last_error_code,
    last_error_message,
    checked_at
  FROM public.provider_health_checks
  WHERE
    checked_at >= now() - (p_window_minutes::text || ' minutes')::interval
    AND (
      -- Global health rows (workspace_id IS NULL)
      workspace_id IS NULL
      OR
      -- Or the caller's workspace (if specified)
      (p_workspace_id IS NOT NULL AND workspace_id = p_workspace_id)
    )
  ORDER BY provider, checked_at DESC;
$$;

-- Revoke public execute; only service_role and authenticated users via API call this
REVOKE EXECUTE ON FUNCTION public.get_provider_health_summary(uuid, integer) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.get_provider_health_summary(uuid, integer) TO service_role;
GRANT  EXECUTE ON FUNCTION public.get_provider_health_summary(uuid, integer) TO authenticated;

COMMENT ON TABLE public.provider_health_checks IS
  'Periodic health snapshots per provider. Populated by /api/cron/provider-health. '
  'circuit_state is INFERRED from event patterns, not a real circuit breaker.';
