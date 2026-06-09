-- Migration 054: Dial Eligibility Checks
--
-- Records every pre-dial compliance check so operators can audit why a call
-- was blocked, measure block rates by reason, and debug compliance configuration.
-- Written by recordDialEligibilityCheck() — fire-and-forget, never blocks dialing.

CREATE TABLE IF NOT EXISTS public.dial_eligibility_checks (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  campaign_id      UUID        NULL REFERENCES public.campaigns(id) ON DELETE SET NULL,
  lead_id          TEXT        NULL,
  phone_number     TEXT        NOT NULL,
  normalized_phone TEXT        NULL,
  country          TEXT        NULL,
  timezone         TEXT        NULL,
  allowed          BOOLEAN     NOT NULL,
  reason           TEXT        NULL,
  reason_code      TEXT        NULL,
  checks           JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Performance indexes
CREATE INDEX IF NOT EXISTS idx_dec_workspace_created
  ON public.dial_eligibility_checks (workspace_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dec_campaign_created
  ON public.dial_eligibility_checks (campaign_id, created_at DESC)
  WHERE campaign_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dec_phone
  ON public.dial_eligibility_checks (phone_number);

CREATE INDEX IF NOT EXISTS idx_dec_normalized_phone
  ON public.dial_eligibility_checks (normalized_phone)
  WHERE normalized_phone IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_dec_allowed
  ON public.dial_eligibility_checks (workspace_id, allowed, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dec_reason_code
  ON public.dial_eligibility_checks (workspace_id, reason_code, created_at DESC)
  WHERE reason_code IS NOT NULL;

-- RLS
ALTER TABLE public.dial_eligibility_checks ENABLE ROW LEVEL SECURITY;

-- Service role (worker + API): full read/write
CREATE POLICY "service_role_all_dec"
  ON public.dial_eligibility_checks
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Workspace members: read-only for their own workspace
CREATE POLICY "workspace_member_read_dec"
  ON public.dial_eligibility_checks
  FOR SELECT
  USING (
    workspace_id IN (
      SELECT id           FROM public.workspaces      WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT workspace_id FROM public.workspace_members
        WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
  );
