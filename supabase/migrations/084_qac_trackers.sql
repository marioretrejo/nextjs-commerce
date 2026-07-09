-- Migration 084: QA Center AI Trackers
--
-- Trackers run alongside scorecards. They do not directly affect score, but
-- can raise risk level and require manual review when configured.

CREATE TABLE IF NOT EXISTS qac_trackers (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id             UUID NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  department_id            UUID REFERENCES qac_departments(id) ON DELETE CASCADE,
  name                     TEXT NOT NULL,
  name_es                  TEXT,
  description              TEXT NOT NULL,
  description_es           TEXT,
  positive_examples_json   JSONB NOT NULL DEFAULT '[]'::jsonb,
  action_config_json       JSONB NOT NULL DEFAULT '{}'::jsonb,
  severity                 TEXT NOT NULL DEFAULT 'info',
  risk_level_override      TEXT,
  trigger_manual_review    BOOLEAN NOT NULL DEFAULT FALSE,
  is_active                BOOLEAN NOT NULL DEFAULT TRUE,
  is_system                BOOLEAN NOT NULL DEFAULT FALSE,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT qac_trackers_severity_check CHECK (
    severity IN ('info', 'low', 'medium', 'high', 'critical')
  ),
  CONSTRAINT qac_trackers_risk_override_check CHECK (
    risk_level_override IS NULL OR risk_level_override IN ('low', 'medium', 'high', 'critical')
  ),
  UNIQUE (workspace_id, department_id, name)
);

CREATE INDEX IF NOT EXISTS qac_trackers_ws_active_idx
  ON qac_trackers(workspace_id, department_id, is_active);

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'qac_trackers_touch_updated_at'
  ) THEN
    CREATE TRIGGER qac_trackers_touch_updated_at
      BEFORE UPDATE ON qac_trackers
      FOR EACH ROW EXECUTE FUNCTION qac_touch_updated_at();
  END IF;
END $$;

ALTER TABLE qac_trackers ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'qac_trackers'
      AND policyname = 'qac_trackers_workspace_read'
  ) THEN
    CREATE POLICY qac_trackers_workspace_read ON qac_trackers
      FOR SELECT USING (
        workspace_id IN (
          SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'qac_trackers'
      AND policyname = 'qac_trackers_workspace_admin_write'
  ) THEN
    CREATE POLICY qac_trackers_workspace_admin_write ON qac_trackers
      FOR ALL USING (
        workspace_id IN (
          SELECT workspace_id
          FROM workspace_members
          WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin', 'supervisor')
        )
      )
      WITH CHECK (
        workspace_id IN (
          SELECT workspace_id
          FROM workspace_members
          WHERE user_id = auth.uid()
            AND role IN ('owner', 'admin', 'supervisor')
        )
      );
  END IF;
END $$;
