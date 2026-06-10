-- Migration 057: Idempotent post-call job enqueue
--
-- Cost strategy: Strategy A — billing.computeAndPersist() runs awaited in the
-- close handler (fast, DB-only). The cost_finalization job reconciles afterward
-- and is a no-op when cost_status is already 'final'. No duplication.
--
-- Idempotency: a unique partial index on (call_id, job_type) WHERE call_id IS NOT NULL
-- prevents duplicate jobs when the close handler fires more than once.
-- The RPC enqueue_post_call_jobs_idempotent uses ON CONFLICT DO NOTHING so a
-- second enqueue for the same (call_id, job_type) silently skips, never errors.

-- ── 1. Unique constraint: one pending/active job per (call_id, job_type) ──────
-- Partial: only enforced when call_id IS NOT NULL.
-- cleanup / transcript_postprocess jobs without a call_id are not constrained.

CREATE UNIQUE INDEX IF NOT EXISTS idx_pcj_call_job_type_unique
  ON public.post_call_jobs (call_id, job_type)
  WHERE call_id IS NOT NULL;

-- ── 2. Idempotent batch-enqueue RPC ──────────────────────────────────────────
-- Accepts a JSON array of job objects, inserts them all in one statement.
-- Rows that conflict on (call_id, job_type) are silently skipped (DO NOTHING).
-- Returns only the rows that were actually inserted (enqueued count = len(result)).

-- LANGUAGE sql avoids PL/pgSQL variable scoping: the RETURNS TABLE output
-- columns (including `call_id`) would create implicit variables in plpgsql,
-- making the ON CONFLICT ... WHERE call_id IS NOT NULL reference ambiguous.
CREATE OR REPLACE FUNCTION public.enqueue_post_call_jobs_idempotent(
  p_jobs JSONB
)
RETURNS TABLE (
  id          UUID,
  job_type    TEXT,
  status      TEXT,
  call_id     UUID,
  created_at  TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
  INSERT INTO public.post_call_jobs (
    workspace_id,
    call_id,
    room_name,
    agent_id,
    job_type,
    priority,
    max_attempts,
    payload,
    run_after
  )
  SELECT
    (j->>'workspace_id')::UUID,
    NULLIF(j->>'call_id',   '')::UUID,
    NULLIF(j->>'room_name', ''),
    NULLIF(j->>'agent_id',  '')::UUID,
    j->>'job_type',
    COALESCE((j->>'priority')::INT,      100),
    COALESCE((j->>'max_attempts')::INT,    5),
    COALESCE(j->'payload', '{}'::JSONB),
    COALESCE(NULLIF(j->>'run_after', '')::TIMESTAMPTZ, now())
  FROM jsonb_array_elements(p_jobs) AS j
  ON CONFLICT (call_id, job_type)
  WHERE call_id IS NOT NULL
  DO NOTHING
  RETURNING
    post_call_jobs.id,
    post_call_jobs.job_type,
    post_call_jobs.status,
    post_call_jobs.call_id,
    post_call_jobs.created_at;
$$;

REVOKE EXECUTE ON FUNCTION public.enqueue_post_call_jobs_idempotent(JSONB) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.enqueue_post_call_jobs_idempotent(JSONB) TO service_role;
