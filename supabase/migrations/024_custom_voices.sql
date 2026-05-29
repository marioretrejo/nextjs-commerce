-- 024 · Voice Studio — custom cloned voices per workspace

CREATE TABLE IF NOT EXISTS custom_voices (
  id                 uuid    PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id       uuid    NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  name               text    NOT NULL,
  provider           text    NOT NULL DEFAULT 'cartesia',  -- 'cartesia' | 'elevenlabs'
  provider_voice_id  text    NOT NULL,                     -- voice ID returned by the TTS API
  preview_url        text,                                 -- short audio sample URL
  language           text    NOT NULL DEFAULT 'en',
  gender             text,                                 -- 'male' | 'female' | 'neutral'
  status             text    NOT NULL DEFAULT 'ready'      -- 'cloning' | 'ready' | 'error'
    CHECK (status IN ('cloning', 'ready', 'error')),
  error_message      text,
  created_at         timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE custom_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "custom_voices_workspace_access" ON custom_voices
  FOR ALL USING (
    workspace_id IN (
      SELECT workspace_id FROM workspace_members WHERE user_id = auth.uid() AND status = 'active'
      UNION
      SELECT id FROM workspaces WHERE owner_id = auth.uid()
    )
  );
