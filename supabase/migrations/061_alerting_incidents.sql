-- Migration 061: Alerting + Incident Notifications
-- Provides structured alert rules, deduplication via fingerprints,
-- incident lifecycle (open → acknowledged → resolved), and delivery tracking.

-- ── A. alert_rules ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alert_rules (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name             text        NOT NULL,
  signal           text        NOT NULL
    CHECK (signal IN (
      'provider_down','provider_degraded','circuit_open','fallback_spike',
      'post_call_jobs_dead_letter','post_call_jobs_stale_running',
      'webhook_failure_spike','cron_failure','db_error_spike',
      'active_calls_zombie','call_failure_spike','cost_spike',
      'compliance_block_spike'
    )),
  severity         text        NOT NULL DEFAULT 'warning'
    CHECK (severity IN ('info','warning','critical')),
  enabled          boolean     NOT NULL DEFAULT true,
  threshold        jsonb       NOT NULL DEFAULT '{}'::jsonb,
  channels         jsonb       NOT NULL DEFAULT '[]'::jsonb,
  cooldown_minutes integer     NOT NULL DEFAULT 30,
  created_by       uuid        NULL,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ar_workspace ON public.alert_rules (workspace_id)
  WHERE workspace_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ar_signal ON public.alert_rules (signal, enabled);

-- ── B. alert_incidents ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alert_incidents (
  id               uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     uuid        NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  rule_id          uuid        NULL REFERENCES public.alert_rules(id) ON DELETE SET NULL,
  signal           text        NOT NULL,
  severity         text        NOT NULL
    CHECK (severity IN ('info','warning','critical')),
  status           text        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open','acknowledged','resolved','muted')),
  title            text        NOT NULL,
  description      text        NULL,
  -- fingerprint encodes workspace + signal + provider so NULLs are handled in-band
  fingerprint      text        NOT NULL,
  provider         text        NULL,
  provider_type    text        NULL,
  source           text        NOT NULL DEFAULT 'provider_health',
  first_seen_at    timestamptz NOT NULL DEFAULT now(),
  last_seen_at     timestamptz NOT NULL DEFAULT now(),
  resolved_at      timestamptz NULL,
  occurrence_count integer     NOT NULL DEFAULT 1,
  metadata         jsonb       NOT NULL DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

-- Partial unique index: only one open/acknowledged incident per fingerprint
-- (workspace is encoded in fingerprint so NULLs are handled correctly)
CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_open_fingerprint
  ON public.alert_incidents (fingerprint)
  WHERE status IN ('open', 'acknowledged');

CREATE INDEX IF NOT EXISTS idx_ai_workspace_status
  ON public.alert_incidents (workspace_id, status, severity);

CREATE INDEX IF NOT EXISTS idx_ai_signal_status
  ON public.alert_incidents (signal, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ai_last_seen
  ON public.alert_incidents (last_seen_at DESC);

-- ── C. alert_deliveries ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.alert_deliveries (
  id           uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  incident_id  uuid        NOT NULL REFERENCES public.alert_incidents(id) ON DELETE CASCADE,
  workspace_id uuid        NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  channel      text        NOT NULL
    CHECK (channel IN ('dashboard','slack','email','webhook')),
  status       text        NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','sent','failed','skipped')),
  destination  text        NULL,     -- masked, not raw secret
  attempts     integer     NOT NULL DEFAULT 0,
  last_error   text        NULL,     -- sanitized, max 200 chars
  sent_at      timestamptz NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ad_incident ON public.alert_deliveries (incident_id);
CREATE INDEX IF NOT EXISTS idx_ad_status ON public.alert_deliveries (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ad_channel_incident
  ON public.alert_deliveries (channel, incident_id, created_at DESC);

-- ── Row Level Security ──────────────────────────────────────────────────────────

ALTER TABLE public.alert_rules     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_incidents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.alert_deliveries ENABLE ROW LEVEL SECURITY;

-- Superadmins see everything (including global workspace_id=NULL rows)
CREATE POLICY "ar_superadmin_all"
  ON public.alert_rules FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_superadmin = true));

CREATE POLICY "ai_superadmin_all"
  ON public.alert_incidents FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_superadmin = true));

CREATE POLICY "ad_superadmin_all"
  ON public.alert_deliveries FOR ALL
  USING (EXISTS (SELECT 1 FROM public.users WHERE id = auth.uid() AND is_superadmin = true));

-- Workspace members can select their workspace's rows
CREATE POLICY "ar_workspace_member_select"
  ON public.alert_rules FOR SELECT
  USING (
    workspace_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.workspaces w
        LEFT JOIN public.workspace_members wm
          ON wm.workspace_id = w.id AND wm.user_id = auth.uid() AND wm.status = 'active'
        WHERE w.id = workspace_id
          AND (w.owner_id = auth.uid() OR wm.id IS NOT NULL)
      )
    )
  );

CREATE POLICY "ai_workspace_member_select"
  ON public.alert_incidents FOR SELECT
  USING (
    workspace_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.workspaces w
        LEFT JOIN public.workspace_members wm
          ON wm.workspace_id = w.id AND wm.user_id = auth.uid() AND wm.status = 'active'
        WHERE w.id = workspace_id
          AND (w.owner_id = auth.uid() OR wm.id IS NOT NULL)
      )
    )
  );

-- Workspace owners/editors can acknowledge/resolve their incidents
CREATE POLICY "ai_workspace_member_update"
  ON public.alert_incidents FOR UPDATE
  USING (
    workspace_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.workspaces w
        LEFT JOIN public.workspace_members wm
          ON wm.workspace_id = w.id AND wm.user_id = auth.uid()
          AND wm.status = 'active' AND wm.role IN ('owner','admin','editor')
        WHERE w.id = workspace_id
          AND (w.owner_id = auth.uid() OR wm.id IS NOT NULL)
      )
    )
  );

CREATE POLICY "ad_workspace_member_select"
  ON public.alert_deliveries FOR SELECT
  USING (
    workspace_id IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM public.workspaces w
        LEFT JOIN public.workspace_members wm
          ON wm.workspace_id = w.id AND wm.user_id = auth.uid() AND wm.status = 'active'
        WHERE w.id = workspace_id
          AND (w.owner_id = auth.uid() OR wm.id IS NOT NULL)
      )
    )
  );

COMMENT ON TABLE public.alert_rules IS
  'Configurable alert rules per workspace. Defaults applied in code when no rules exist.';

COMMENT ON TABLE public.alert_incidents IS
  'Deduplicated alert incidents. fingerprint encodes workspace+signal+provider for upsert logic.';

COMMENT ON TABLE public.alert_deliveries IS
  'Per-channel delivery records for each incident notification. destination is masked.';
