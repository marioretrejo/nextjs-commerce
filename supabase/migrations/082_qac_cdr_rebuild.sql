-- Migration 082: QA Center CDR rebuild
--
-- QA Center is now a standalone CDR-based call center QA module. These changes
-- keep the global workspace/auth model, but separate QA data from AI Agent call
-- records, sessions, transcripts, and post-call scoring.

CREATE EXTENSION IF NOT EXISTS pgcrypto;

CREATE OR REPLACE FUNCTION qac_touch_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Providers -----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS qac_voip_providers (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name           TEXT NOT NULL,
  slug           TEXT NOT NULL,
  type           TEXT NOT NULL DEFAULT 'generic',
  webhook_secret TEXT,
  config_json    JSONB NOT NULL DEFAULT '{}'::jsonb,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qac_voip_provider_type_check CHECK (
    type IN ('squaretalk', 'twilio', 'aircall', 'ringcentral', 'generic')
  ),
  UNIQUE (workspace_id, slug)
);

CREATE INDEX IF NOT EXISTS qac_voip_providers_ws_active_idx
  ON qac_voip_providers(workspace_id, is_active);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'qac_voip_providers_touch_updated_at'
  ) THEN
    CREATE TRIGGER qac_voip_providers_touch_updated_at
      BEFORE UPDATE ON qac_voip_providers
      FOR EACH ROW EXECUTE FUNCTION qac_touch_updated_at();
  END IF;
END $$;

-- Departments ---------------------------------------------------------------

CREATE TABLE IF NOT EXISTS qac_departments (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name         TEXT NOT NULL,
  slug         TEXT NOT NULL,
  description  TEXT,
  qa_prompt    TEXT,
  auto_analyze BOOLEAN NOT NULL DEFAULT FALSE,
  is_active    BOOLEAN NOT NULL DEFAULT TRUE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (workspace_id, slug)
);

ALTER TABLE qac_departments
  ADD COLUMN IF NOT EXISTS auto_analyze BOOLEAN NOT NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

CREATE INDEX IF NOT EXISTS qac_departments_ws_slug_idx
  ON qac_departments(workspace_id, slug);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'qac_departments_touch_updated_at'
  ) THEN
    CREATE TRIGGER qac_departments_touch_updated_at
      BEFORE UPDATE ON qac_departments
      FOR EACH ROW EXECUTE FUNCTION qac_touch_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS qac_department_extensions (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  department_id  UUID NOT NULL REFERENCES qac_departments(id) ON DELETE CASCADE,
  extension      TEXT,
  agent_extension TEXT,
  agent_name     TEXT,
  is_active      BOOLEAN NOT NULL DEFAULT TRUE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE qac_department_extensions
  ADD COLUMN IF NOT EXISTS extension TEXT,
  ADD COLUMN IF NOT EXISTS agent_extension TEXT,
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

UPDATE qac_department_extensions
SET extension = COALESCE(extension, agent_extension)
WHERE extension IS NULL;

UPDATE qac_department_extensions
SET agent_extension = COALESCE(agent_extension, extension)
WHERE agent_extension IS NULL;

CREATE INDEX IF NOT EXISTS qac_department_extensions_ws_ext_idx
  ON qac_department_extensions(workspace_id, extension)
  WHERE extension IS NOT NULL AND is_active = TRUE;

CREATE INDEX IF NOT EXISTS qac_department_extensions_agent_ext_idx
  ON qac_department_extensions(workspace_id, agent_extension)
  WHERE agent_extension IS NOT NULL AND is_active = TRUE;

-- Agents --------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS qac_agents (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name              TEXT NOT NULL,
  email             TEXT,
  extension         TEXT,
  department_id     UUID REFERENCES qac_departments(id) ON DELETE SET NULL,
  external_agent_id TEXT,
  is_active         BOOLEAN NOT NULL DEFAULT TRUE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qac_agents_ws_active_idx
  ON qac_agents(workspace_id, is_active);

CREATE INDEX IF NOT EXISTS qac_agents_ws_extension_idx
  ON qac_agents(workspace_id, extension)
  WHERE extension IS NOT NULL;

CREATE INDEX IF NOT EXISTS qac_agents_ws_external_idx
  ON qac_agents(workspace_id, external_agent_id)
  WHERE external_agent_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'qac_agents_touch_updated_at'
  ) THEN
    CREATE TRIGGER qac_agents_touch_updated_at
      BEFORE UPDATE ON qac_agents
      FOR EACH ROW EXECUTE FUNCTION qac_touch_updated_at();
  END IF;
END $$;

-- Scorecards ----------------------------------------------------------------

CREATE TABLE IF NOT EXISTS qac_scorecards (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id  UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  department_id UUID REFERENCES qac_departments(id) ON DELETE CASCADE,
  name          TEXT NOT NULL,
  version       INTEGER NOT NULL DEFAULT 1,
  is_active     BOOLEAN NOT NULL DEFAULT TRUE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qac_scorecards_ws_dept_idx
  ON qac_scorecards(workspace_id, department_id, is_active);

CREATE UNIQUE INDEX IF NOT EXISTS qac_scorecards_one_active_per_dept_idx
  ON qac_scorecards(workspace_id, department_id)
  WHERE is_active = TRUE AND department_id IS NOT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'qac_scorecards_touch_updated_at'
  ) THEN
    CREATE TRIGGER qac_scorecards_touch_updated_at
      BEFORE UPDATE ON qac_scorecards
      FOR EACH ROW EXECUTE FUNCTION qac_touch_updated_at();
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS qac_scorecard_criteria (
  id                  UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id        UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  scorecard_id        UUID NOT NULL REFERENCES qac_scorecards(id) ON DELETE CASCADE,
  category            TEXT NOT NULL,
  name                TEXT NOT NULL,
  description         TEXT,
  weight              NUMERIC(8,2) NOT NULL DEFAULT 0 CHECK (weight >= 0),
  is_critical         BOOLEAN NOT NULL DEFAULT FALSE,
  applicability_rule  TEXT,
  pass_definition     TEXT,
  partial_definition  TEXT,
  fail_definition     TEXT,
  na_definition       TEXT,
  examples_json       JSONB NOT NULL DEFAULT '[]'::jsonb,
  sort_order          INTEGER NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS qac_scorecard_criteria_card_idx
  ON qac_scorecard_criteria(scorecard_id, sort_order);

-- Interactions ---------------------------------------------------------------

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'qac_interactions'
      AND column_name = 'agent_id'
      AND udt_name <> 'uuid'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'qac_interactions'
      AND column_name = 'legacy_agent_id'
  ) THEN
    ALTER TABLE qac_interactions RENAME COLUMN agent_id TO legacy_agent_id;
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS qac_interactions (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_id       UUID REFERENCES qac_voip_providers(id) ON DELETE SET NULL,
  external_call_id  TEXT,
  agent_id          UUID REFERENCES qac_agents(id) ON DELETE SET NULL,
  department_id     UUID REFERENCES qac_departments(id) ON DELETE SET NULL,
  caller_id         TEXT,
  prospect_id       TEXT,
  interaction_title TEXT,
  recording_url     TEXT,
  internal_audio_url TEXT,
  duration_seconds  INTEGER,
  direction         TEXT,
  disposition       TEXT,
  call_started_at   TIMESTAMPTZ,
  call_ended_at     TIMESTAMPTZ,
  channel           TEXT NOT NULL DEFAULT 'call',
  status            TEXT NOT NULL DEFAULT 'pending_cdr',
  review_status     TEXT NOT NULL DEFAULT 'pending_review',
  raw_payload        JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE qac_interactions
  ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES qac_voip_providers(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS agent_id UUID REFERENCES qac_agents(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS caller_id TEXT,
  ADD COLUMN IF NOT EXISTS prospect_id TEXT,
  ADD COLUMN IF NOT EXISTS interaction_title TEXT,
  ADD COLUMN IF NOT EXISTS recording_url TEXT,
  ADD COLUMN IF NOT EXISTS internal_audio_url TEXT,
  ADD COLUMN IF NOT EXISTS duration_seconds INTEGER,
  ADD COLUMN IF NOT EXISTS direction TEXT,
  ADD COLUMN IF NOT EXISTS disposition TEXT,
  ADD COLUMN IF NOT EXISTS call_started_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS call_ended_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS raw_payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW();

ALTER TABLE qac_interactions
  ALTER COLUMN agent_name DROP NOT NULL,
  ALTER COLUMN transcript DROP NOT NULL;

ALTER TABLE qac_interactions
  DROP CONSTRAINT IF EXISTS qac_interactions_status_check,
  DROP CONSTRAINT IF EXISTS qac_interactions_review_status_check;

UPDATE qac_interactions
SET
  status = CASE status
    WHEN 'pending' THEN 'pending_audio'
    WHEN 'failed' THEN 'failed_analysis'
    ELSE status
  END,
  duration_seconds = COALESCE(duration_seconds, duration_s),
  recording_url = COALESCE(recording_url, audio_url),
  call_started_at = COALESCE(call_started_at, started_at),
  raw_payload = COALESCE(raw_payload, source_payload, metadata, '{}'::jsonb)
WHERE TRUE;

ALTER TABLE qac_interactions
  ALTER COLUMN status SET DEFAULT 'pending_cdr',
  ADD CONSTRAINT qac_interactions_status_check CHECK (
    status IN (
      'pending_cdr',
      'pending_audio',
      'audio_ready',
      'transcribing',
      'transcribed',
      'analyzing',
      'analyzed',
      'not_evaluable',
      'failed_audio',
      'failed_transcription',
      'failed_analysis',
      'manual_review_required'
    )
  ),
  ADD CONSTRAINT qac_interactions_review_status_check CHECK (
    review_status IN (
      'pending_review',
      'in_review',
      'reviewed',
      'approved',
      'disputed'
    )
  );

CREATE UNIQUE INDEX IF NOT EXISTS qac_interactions_provider_external_uidx
  ON qac_interactions(workspace_id, provider_id, external_call_id)
  WHERE provider_id IS NOT NULL AND external_call_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS qac_interactions_cdr_filters_idx
  ON qac_interactions(workspace_id, provider_id, department_id, agent_id, status, review_status);

CREATE INDEX IF NOT EXISTS qac_interactions_started_idx
  ON qac_interactions(workspace_id, call_started_at DESC NULLS LAST, created_at DESC);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'qac_interactions_touch_updated_at'
  ) THEN
    CREATE TRIGGER qac_interactions_touch_updated_at
      BEFORE UPDATE ON qac_interactions
      FOR EACH ROW EXECUTE FUNCTION qac_touch_updated_at();
  END IF;
END $$;

-- Transcripts and analysis ---------------------------------------------------

CREATE TABLE IF NOT EXISTS qac_transcripts (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  interaction_id UUID NOT NULL REFERENCES qac_interactions(id) ON DELETE CASCADE,
  full_text      TEXT NOT NULL,
  diarized_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  language       TEXT,
  provider       TEXT,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qac_transcripts_interaction_idx
  ON qac_transcripts(interaction_id, created_at DESC);

CREATE TABLE IF NOT EXISTS qac_analyses (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id          UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  interaction_id        UUID NOT NULL REFERENCES qac_interactions(id) ON DELETE CASCADE,
  scorecard_id          UUID REFERENCES qac_scorecards(id) ON DELETE SET NULL,
  overall_score         NUMERIC(5,2),
  sentiment             TEXT,
  risk_level            TEXT,
  call_disposition      TEXT,
  summary               TEXT,
  strengths_json        JSONB NOT NULL DEFAULT '[]'::jsonb,
  opportunities_json    JSONB NOT NULL DEFAULT '[]'::jsonb,
  recommendations_json  JSONB NOT NULL DEFAULT '[]'::jsonb,
  trackers_json         JSONB NOT NULL DEFAULT '{}'::jsonb,
  raw_json              JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qac_analyses_interaction_idx
  ON qac_analyses(interaction_id, created_at DESC);

CREATE INDEX IF NOT EXISTS qac_analyses_score_idx
  ON qac_analyses(workspace_id, overall_score DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS qac_criteria_results (
  id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id      UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  analysis_id       UUID NOT NULL REFERENCES qac_analyses(id) ON DELETE CASCADE,
  criterion_id      UUID REFERENCES qac_scorecard_criteria(id) ON DELETE SET NULL,
  applicable        BOOLEAN NOT NULL DEFAULT TRUE,
  result            TEXT NOT NULL DEFAULT 'n/a',
  score             NUMERIC(8,2),
  reason            TEXT,
  evidence_json     JSONB NOT NULL DEFAULT '[]'::jsonb,
  reviewer_comment  TEXT,
  CONSTRAINT qac_criteria_results_result_check CHECK (
    result IN ('pass', 'partial', 'fail', 'n/a')
  )
);

CREATE INDEX IF NOT EXISTS qac_criteria_results_analysis_idx
  ON qac_criteria_results(analysis_id);

CREATE TABLE IF NOT EXISTS qac_reviews (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id   UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  interaction_id UUID NOT NULL REFERENCES qac_interactions(id) ON DELETE CASCADE,
  reviewer_id    UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  status         TEXT NOT NULL DEFAULT 'reviewed',
  comments       TEXT,
  reviewed_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qac_reviews_interaction_idx
  ON qac_reviews(interaction_id, reviewed_at DESC);

CREATE TABLE IF NOT EXISTS qac_ingestion_logs (
  id               UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id     UUID REFERENCES workspaces(id) ON DELETE CASCADE,
  provider_id      UUID REFERENCES qac_voip_providers(id) ON DELETE SET NULL,
  external_call_id TEXT,
  status           TEXT NOT NULL,
  error_message    TEXT,
  raw_payload      JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS qac_ingestion_logs_provider_idx
  ON qac_ingestion_logs(provider_id, external_call_id, created_at DESC);

-- RLS ------------------------------------------------------------------------

ALTER TABLE qac_voip_providers ENABLE ROW LEVEL SECURITY;
ALTER TABLE qac_departments ENABLE ROW LEVEL SECURITY;
ALTER TABLE qac_department_extensions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qac_agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE qac_scorecards ENABLE ROW LEVEL SECURITY;
ALTER TABLE qac_scorecard_criteria ENABLE ROW LEVEL SECURITY;
ALTER TABLE qac_interactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE qac_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE qac_analyses ENABLE ROW LEVEL SECURITY;
ALTER TABLE qac_criteria_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE qac_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE qac_ingestion_logs ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'qac_voip_providers',
    'qac_department_extensions',
    'qac_agents',
    'qac_scorecards',
    'qac_scorecard_criteria',
    'qac_transcripts',
    'qac_analyses',
    'qac_criteria_results',
    'qac_reviews',
    'qac_ingestion_logs'
  ]
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = tbl || '_workspace_read'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR SELECT USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()))',
        tbl || '_workspace_read',
        tbl
      );
    END IF;

    IF NOT EXISTS (
      SELECT 1 FROM pg_policies
      WHERE schemaname = 'public'
        AND tablename = tbl
        AND policyname = tbl || '_workspace_admin_write'
    ) THEN
      EXECUTE format(
        'CREATE POLICY %I ON %I FOR ALL USING (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN (''owner'', ''admin''))) WITH CHECK (workspace_id IN (SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND role IN (''owner'', ''admin'')))',
        tbl || '_workspace_admin_write',
        tbl
      );
    END IF;
  END LOOP;
END $$;

