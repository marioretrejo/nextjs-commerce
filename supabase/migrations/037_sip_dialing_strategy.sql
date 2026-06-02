-- ════════════════════════════════════════════════════════════════════════════
-- Migration 037 · SIP Trunks, Dialing Strategy, Call Actions,
--                Scenario Handlers, Agent Tool Enhancements
-- ════════════════════════════════════════════════════════════════════════════
--
-- New tables:
--   sip_trunks          — named, prioritised SIP providers per workspace
--   sip_trunk_numbers   — outbound DIDs with area-code for local presence
--   dialing_schedules   — reusable timezone-aware availability windows
--   call_actions        — pre/post call webhooks, SMS, CRM hooks
--   scenario_handlers   — voicemail / bot / disinterest response configs
--
-- Enhancements:
--   agent_tools         — adds body_template, extract_path, timeout_ms

-- ─── 1. sip_trunks ───────────────────────────────────────────────────────────
-- Stores multiple named SIP trunk credentials per workspace.
-- Each trunk can be activated independently; highest-priority active trunk
-- is selected by resolveDialConfig().

CREATE TABLE IF NOT EXISTS public.sip_trunks (
  id                UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID    NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name              TEXT    NOT NULL,
  provider          TEXT    NOT NULL
                    CHECK (provider IN ('commpeak','squaretalk','telnyx','vonage','twilio','custom')),
  sip_host          TEXT    NOT NULL,
  username          TEXT    NOT NULL,
  password          TEXT    NOT NULL,
  livekit_trunk_id  TEXT,                         -- cached by dialing service; reset on cred change
  priority          INTEGER NOT NULL DEFAULT 0,   -- higher = preferred
  region            TEXT,                         -- informational: "us-east", "eu-west", …
  status            TEXT    NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','testing','error','disabled')),
  last_tested_at    TIMESTAMPTZ,
  test_result       JSONB,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_sip_trunks_workspace_id
  ON public.sip_trunks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sip_trunks_workspace_priority
  ON public.sip_trunks(workspace_id, priority DESC) WHERE status = 'active';

ALTER TABLE public.sip_trunks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_manage_sip_trunks"
  ON public.sip_trunks FOR ALL
  USING (
    workspace_id IN (
      SELECT id          FROM public.workspaces      WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT workspace_id FROM public.workspace_members
        WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
  );

-- ─── 2. sip_trunk_numbers ─────────────────────────────────────────────────────
-- Individual DIDs (phone numbers) owned by a trunk.
-- area_code enables nearest-local-number selection (NANP US/CA).

CREATE TABLE IF NOT EXISTS public.sip_trunk_numbers (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  trunk_id      UUID NOT NULL REFERENCES public.sip_trunks(id) ON DELETE CASCADE,
  workspace_id  UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  number        TEXT NOT NULL,                -- E.164
  area_code     TEXT,                         -- "212", "415", etc.  (NANP only)
  country_code  TEXT NOT NULL DEFAULT 'US',   -- ISO 3166-1 alpha-2
  region        TEXT,                         -- US state / EU country / etc.
  is_primary    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, number)
);

CREATE INDEX IF NOT EXISTS idx_sip_trunk_numbers_workspace_id
  ON public.sip_trunk_numbers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_sip_trunk_numbers_area_code
  ON public.sip_trunk_numbers(workspace_id, area_code) WHERE area_code IS NOT NULL;

ALTER TABLE public.sip_trunk_numbers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_manage_sip_trunk_numbers"
  ON public.sip_trunk_numbers FOR ALL
  USING (
    workspace_id IN (
      SELECT id           FROM public.workspaces     WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT workspace_id FROM public.workspace_members
        WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
  );

-- ─── 3. dialing_schedules ────────────────────────────────────────────────────
-- Reusable availability windows. Attached workspace-wide (is_default=true)
-- or to a specific agent_id.
-- windows JSON shape: [{ day: "mon", start: "09:00", end: "18:00" }, ...]

CREATE TABLE IF NOT EXISTS public.dialing_schedules (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID    NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id      UUID    REFERENCES public.agents(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  timezone      TEXT    NOT NULL DEFAULT 'America/New_York',
  windows       JSONB   NOT NULL DEFAULT '[]'::jsonb,
  is_default    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_dialing_schedules_workspace
  ON public.dialing_schedules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_dialing_schedules_agent
  ON public.dialing_schedules(agent_id) WHERE agent_id IS NOT NULL;

ALTER TABLE public.dialing_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_manage_dialing_schedules"
  ON public.dialing_schedules FOR ALL
  USING (
    workspace_id IN (
      SELECT id           FROM public.workspaces     WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT workspace_id FROM public.workspace_members
        WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
  );

-- ─── 4. call_actions ─────────────────────────────────────────────────────────
-- Pre/post call hooks executed by the orchestration layer.
-- config schema differs by type:
--   webhook:    { url, method, headers, body_template }
--   sms:        { to_template, body_template, provider }
--   email:      { to_template, subject_template, body_template }
--   crm_update: { crm_type, field_mappings }
-- All templates support {{key}} variable injection (contact_name, contact_phone, …).

CREATE TABLE IF NOT EXISTS public.call_actions (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID    NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id      UUID    REFERENCES public.agents(id) ON DELETE CASCADE,
  name          TEXT    NOT NULL,
  trigger       TEXT    NOT NULL
                CHECK (trigger IN (
                  'pre_call','post_call','on_transfer','on_voicemail',
                  'on_converted','on_no_answer','on_error'
                )),
  type          TEXT    NOT NULL
                CHECK (type IN ('webhook','sms','email','crm_update')),
  config        JSONB   NOT NULL DEFAULT '{}'::jsonb,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_call_actions_agent
  ON public.call_actions(agent_id) WHERE agent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_call_actions_workspace_trigger
  ON public.call_actions(workspace_id, trigger) WHERE is_active = TRUE;

ALTER TABLE public.call_actions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_manage_call_actions"
  ON public.call_actions FOR ALL
  USING (
    workspace_id IN (
      SELECT id           FROM public.workspaces     WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT workspace_id FROM public.workspace_members
        WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
  );

-- ─── 5. scenario_handlers ────────────────────────────────────────────────────
-- Per-agent overrides for built-in call scenarios.
-- If no row matches, the service falls back to hardcoded defaults.
-- config schema differs by action:
--   leave_voicemail:  { message_template }
--   navigate_ivr:     { dtmf_sequence, wait_ms }
--   transfer:         { transfer_number }
--   custom_response:  { llm_instruction }

CREATE TABLE IF NOT EXISTS public.scenario_handlers (
  id            UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID    NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  agent_id      UUID    REFERENCES public.agents(id) ON DELETE CASCADE,
  scenario      TEXT    NOT NULL
                CHECK (scenario IN (
                  'voicemail_short','voicemail_long','bot_detected',
                  'disinterest','objection','no_response','human_requested'
                )),
  action        TEXT    NOT NULL
                CHECK (action IN (
                  'hangup','leave_voicemail','navigate_ivr',
                  'transfer','retry_later','custom_response'
                )),
  config        JSONB   NOT NULL DEFAULT '{}'::jsonb,
  max_attempts  INTEGER NOT NULL DEFAULT 4,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (agent_id, scenario)
);

CREATE INDEX IF NOT EXISTS idx_scenario_handlers_agent
  ON public.scenario_handlers(agent_id) WHERE agent_id IS NOT NULL;

ALTER TABLE public.scenario_handlers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_member_manage_scenario_handlers"
  ON public.scenario_handlers FOR ALL
  USING (
    workspace_id IN (
      SELECT id           FROM public.workspaces     WHERE owner_id = (SELECT auth.uid())
      UNION
      SELECT workspace_id FROM public.workspace_members
        WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
  );

-- ─── 6. agent_tools enhancements ─────────────────────────────────────────────
-- body_template  — Handlebars-style body for POST/PUT (overrides raw args JSON)
-- extract_path   — dot-notation path to pluck a value from the JSON response
-- timeout_ms     — per-tool HTTP timeout (default 8 000 ms)

ALTER TABLE public.agent_tools
  ADD COLUMN IF NOT EXISTS body_template TEXT,
  ADD COLUMN IF NOT EXISTS extract_path  TEXT,
  ADD COLUMN IF NOT EXISTS timeout_ms    INTEGER NOT NULL DEFAULT 8000;
