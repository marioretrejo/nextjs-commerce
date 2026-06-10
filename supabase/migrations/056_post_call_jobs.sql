-- Migration 056: Post-call jobs — persistent, retryable, auditable job queue
--
-- Replaces fire-and-forget post-call tasks (CRM extraction, webhook delivery,
-- QA analysis, integration dispatch) with a persistent job table that supports
-- retry with exponential back-off, dead-letter, and worker locking.
--
-- Job types: crm_extraction, qa_analysis, outbound_webhook, integration_dispatch,
--            cost_finalization, transcript_postprocess, call_summary, cleanup
-- Status:    pending → running → completed | retrying → running | failed | dead_letter

CREATE TABLE IF NOT EXISTS public.post_call_jobs (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  call_id           UUID        NULL REFERENCES public.calls(id) ON DELETE CASCADE,
  room_name         TEXT        NULL,
  agent_id          UUID        NULL REFERENCES public.agents(id) ON DELETE SET NULL,
  job_type          TEXT        NOT NULL,
  status            TEXT        NOT NULL DEFAULT 'pending',
  priority          INTEGER     NOT NULL DEFAULT 100,
  attempts          INTEGER     NOT NULL DEFAULT 0,
  max_attempts      INTEGER     NOT NULL DEFAULT 5,
  payload           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  result            JSONB       NULL,
  error_message     TEXT        NULL,
  error_code        TEXT        NULL,
  locked_at         TIMESTAMPTZ NULL,
  locked_by         TEXT        NULL,
  run_after         TIMESTAMPTZ NOT NULL DEFAULT now(),
  started_at        TIMESTAMPTZ NULL,
  completed_at      TIMESTAMPTZ NULL,
  failed_at         TIMESTAMPTZ NULL,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- CHECK constraints
ALTER TABLE public.post_call_jobs
  DROP CONSTRAINT IF EXISTS post_call_jobs_job_type_check;
ALTER TABLE public.post_call_jobs
  ADD CONSTRAINT post_call_jobs_job_type_check
  CHECK (job_type IN (
    'crm_extraction',
    'qa_analysis',
    'outbound_webhook',
    'integration_dispatch',
    'cost_finalization',
    'transcript_postprocess',
    'call_summary',
    'cleanup'
  ));

ALTER TABLE public.post_call_jobs
  DROP CONSTRAINT IF EXISTS post_call_jobs_status_check;
ALTER TABLE public.post_call_jobs
  ADD CONSTRAINT post_call_jobs_status_check
  CHECK (status IN (
    'pending',
    'running',
    'completed',
    'retrying',
    'failed',
    'dead_letter',
    'canceled'
  ));

-- Indexes
CREATE INDEX IF NOT EXISTS idx_pcj_workspace_created
  ON public.post_call_jobs (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_pcj_call_id
  ON public.post_call_jobs (call_id, created_at DESC)
  WHERE call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pcj_claimable
  ON public.post_call_jobs (status, run_after, priority)
  WHERE status IN ('pending', 'retrying');

CREATE INDEX IF NOT EXISTS idx_pcj_job_type_status
  ON public.post_call_jobs (job_type, status);

CREATE INDEX IF NOT EXISTS idx_pcj_locked_at
  ON public.post_call_jobs (locked_at)
  WHERE locked_at IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_pcj_priority_run_after
  ON public.post_call_jobs (priority ASC, run_after ASC)
  WHERE status IN ('pending', 'retrying');

CREATE INDEX IF NOT EXISTS idx_pcj_created_at
  ON public.post_call_jobs (created_at);

-- updated_at trigger (reuse pattern if trigger function already exists)
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_post_call_jobs_updated_at ON public.post_call_jobs;
CREATE TRIGGER trg_post_call_jobs_updated_at
  BEFORE UPDATE ON public.post_call_jobs
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

-- RLS
ALTER TABLE public.post_call_jobs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pcj_service_role_all"
  ON public.post_call_jobs FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE POLICY "pcj_workspace_member_select"
  ON public.post_call_jobs FOR SELECT
  USING (
    workspace_id IN (
      SELECT id           FROM public.workspaces      WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT workspace_id FROM public.workspace_members
        WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
  );

-- ── Claim function — FOR UPDATE SKIP LOCKED ──────────────────────────────────
-- Atomically marks up to p_limit eligible jobs as 'running', incrementing
-- attempts and setting locked_by. Multiple cron workers will never claim
-- the same job. Jobs stuck in 'running' for > 10 minutes are re-eligible
-- (stale lock recovery).

CREATE OR REPLACE FUNCTION public.claim_post_call_jobs(
  p_worker_id  TEXT,
  p_limit      INT     DEFAULT 10,
  p_job_type   TEXT    DEFAULT NULL
)
RETURNS SETOF public.post_call_jobs
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
BEGIN
  RETURN QUERY
  UPDATE public.post_call_jobs
  SET
    status     = 'running',
    locked_at  = now(),
    locked_by  = p_worker_id,
    started_at = COALESCE(started_at, now()),
    attempts   = attempts + 1,
    updated_at = now()
  WHERE id IN (
    SELECT id
    FROM   public.post_call_jobs
    WHERE  status IN ('pending', 'retrying')
      AND  run_after <= now()
      -- stale lock recovery: re-claim jobs stuck > 10 minutes
      AND  (locked_at IS NULL OR locked_at < now() - INTERVAL '10 minutes')
      AND  (p_job_type IS NULL OR job_type = p_job_type)
    ORDER  BY priority ASC, run_after ASC
    LIMIT  p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.claim_post_call_jobs(TEXT, INT, TEXT) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.claim_post_call_jobs(TEXT, INT, TEXT) TO service_role;
