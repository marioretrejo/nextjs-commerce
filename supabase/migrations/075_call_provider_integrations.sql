-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 075: Multi-provider Call Import
--
-- Lets a workspace connect external VoIP/CRM providers (Squaretalk, Voiso,
-- CommPeak, n8n, or a custom webhook) and import their completed calls into the
-- SAME `calls` table used by the existing /calls, /calls/[id] and /quality
-- surfaces — so imported calls flow through the existing QA scoring + player.
--
-- Two connection methods are modelled:
--   · webhook_receiver — the provider/n8n POSTs calls to VoiceOP (fully working)
--   · api_sync         — VoiceOP pulls calls via the provider API (scaffolded)
--
-- Idempotency: imported calls dedup on (workspace_id, external_source,
-- external_call_id) via a partial unique index (NULLs excluded).
--
-- Also reconciles a pre-existing discrepancy: app/api/agents/[id]/criteria
-- inserts qa_criteria.workspace_id, but the original schema (001) never created
-- that column. We add it (nullable, backfilled from the agent) without touching
-- the existing agent-scoped RLS policy.
-- ═══════════════════════════════════════════════════════════════════════════

-- ── call_provider_integrations ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_provider_integrations (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  provider          TEXT NOT NULL
                      CHECK (provider IN ('squaretalk','voiso','commpeak','custom_webhook','n8n')),
  connection_method TEXT NOT NULL
                      CHECK (connection_method IN ('webhook_receiver','api_sync')),
  status            TEXT NOT NULL DEFAULT 'active'
                      CHECK (status IN ('active','paused','error','disabled')),
  default_agent_id  UUID REFERENCES public.agents(id) ON DELETE SET NULL,
  default_department TEXT,
  webhook_secret    TEXT,
  config            JSONB NOT NULL DEFAULT '{}'::jsonb,
  credentials       JSONB NOT NULL DEFAULT '{}'::jsonb,
  last_event_at     TIMESTAMPTZ,
  last_sync_at      TIMESTAMPTZ,
  last_error        TEXT,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_provider_integrations_ws_provider_idx
  ON public.call_provider_integrations(workspace_id, provider);

ALTER TABLE public.call_provider_integrations ENABLE ROW LEVEL SECURITY;

-- Members of the workspace may read/manage their integrations. Server routes use
-- the service-role client (bypasses RLS) and enforce workspace scoping in code;
-- this policy is defense-in-depth for any session-scoped access.
DROP POLICY IF EXISTS "call_provider_integrations_member_all" ON public.call_provider_integrations;
CREATE POLICY "call_provider_integrations_member_all" ON public.call_provider_integrations
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_members wm
        ON wm.workspace_id = w.id AND wm.user_id = auth.uid() AND wm.status = 'active'
      WHERE w.id = workspace_id AND (w.owner_id = auth.uid() OR wm.id IS NOT NULL)
    )
  );

-- ── call_import_logs ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.call_import_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  integration_id   UUID REFERENCES public.call_provider_integrations(id) ON DELETE SET NULL,
  provider         TEXT NOT NULL,
  external_call_id TEXT,
  status           TEXT NOT NULL CHECK (status IN ('success','error','duplicate')),
  message          TEXT,
  payload          JSONB,
  response         JSONB,
  call_id          UUID REFERENCES public.calls(id) ON DELETE SET NULL,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS call_import_logs_ws_created_idx
  ON public.call_import_logs(workspace_id, created_at DESC);

ALTER TABLE public.call_import_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "call_import_logs_member_select" ON public.call_import_logs;
CREATE POLICY "call_import_logs_member_select" ON public.call_import_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_members wm
        ON wm.workspace_id = w.id AND wm.user_id = auth.uid() AND wm.status = 'active'
      WHERE w.id = workspace_id AND (w.owner_id = auth.uid() OR wm.id IS NOT NULL)
    )
  );

-- ── calls: external-import columns ─────────────────────────────────────────
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS external_source         TEXT,
  ADD COLUMN IF NOT EXISTS external_call_id        TEXT,
  ADD COLUMN IF NOT EXISTS external_agent_name     TEXT,
  ADD COLUMN IF NOT EXISTS department              TEXT,
  ADD COLUMN IF NOT EXISTS prospect_id             TEXT,
  ADD COLUMN IF NOT EXISTS crm_id                  TEXT,
  ADD COLUMN IF NOT EXISTS extension               TEXT,
  ADD COLUMN IF NOT EXISTS imported_payload        JSONB,
  ADD COLUMN IF NOT EXISTS analysis_status         TEXT DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS analysis_error          TEXT,
  ADD COLUMN IF NOT EXISTS recording_storage_path  TEXT,
  ADD COLUMN IF NOT EXISTS qa_details              JSONB,
  ADD COLUMN IF NOT EXISTS import_integration_id   UUID REFERENCES public.call_provider_integrations(id) ON DELETE SET NULL;

-- Idempotency: one imported call per (workspace, source, external id).
-- NULL external_call_id rows (native LiveKit/Retell calls) never conflict.
CREATE UNIQUE INDEX IF NOT EXISTS calls_external_dedup_idx
  ON public.calls(workspace_id, external_source, external_call_id)
  WHERE external_call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS calls_ws_external_source_idx
  ON public.calls(workspace_id, external_source)
  WHERE external_source IS NOT NULL;

CREATE INDEX IF NOT EXISTS calls_ws_analysis_status_idx
  ON public.calls(workspace_id, analysis_status);

-- ── qa_criteria.workspace_id reconciliation ────────────────────────────────
-- The criteria API (app/api/agents/[id]/criteria/route.ts) inserts workspace_id
-- but 001 never created the column. Add it (nullable) and backfill from the
-- owning agent. RLS stays agent-scoped (unchanged) so this is non-breaking.
ALTER TABLE public.qa_criteria
  ADD COLUMN IF NOT EXISTS workspace_id UUID REFERENCES public.workspaces(id) ON DELETE CASCADE;

UPDATE public.qa_criteria c
  SET workspace_id = a.workspace_id
  FROM public.agents a
  WHERE c.agent_id = a.id AND c.workspace_id IS NULL;

CREATE INDEX IF NOT EXISTS qa_criteria_workspace_idx
  ON public.qa_criteria(workspace_id)
  WHERE workspace_id IS NOT NULL;
