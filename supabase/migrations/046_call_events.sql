-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 046: Call events — lightweight event sourcing
--
-- Records discrete events that happen during and after a call.
-- Used for debugging watchdog firings, pipeline latency, and lifecycle
-- transitions without bloating the main calls row.
--
-- event_type taxonomy (non-exhaustive):
--   call.*          — lifecycle transitions (initiated, answered, ended …)
--   llm.*           — LLM pipeline events (slow, timeout)
--   tts.*           — TTS pipeline events (slow, timeout)
--   watchdog.*      — watchdog firings (thinking_fired, ttfb_fired …)
--   dnc.*           — Do-not-call detections
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.call_events (
  id            uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  call_room     text        NOT NULL,
  workspace_id  uuid        NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  event_type    text        NOT NULL,
  payload       jsonb       NOT NULL DEFAULT '{}',
  created_at    timestamptz NOT NULL DEFAULT now()
);

-- Per-room timeline (most common read pattern: debug a single call)
CREATE INDEX IF NOT EXISTS idx_call_events_room
  ON public.call_events (call_room, created_at DESC);

-- Workspace-level analytics (e.g. "how often does llm.timeout fire this week")
CREATE INDEX IF NOT EXISTS idx_call_events_workspace
  ON public.call_events (workspace_id, event_type, created_at DESC);

-- TTL cleanup: events older than 90 days can be vacuumed by a cron job
CREATE INDEX IF NOT EXISTS idx_call_events_created_at
  ON public.call_events (created_at);

ALTER TABLE public.call_events ENABLE ROW LEVEL SECURITY;

-- Workspace members can read events for their workspace's calls
CREATE POLICY "call_events_workspace_select" ON public.call_events
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_members wm
        ON wm.workspace_id = w.id
       AND wm.user_id = auth.uid()
       AND wm.status = 'active'
      WHERE w.id = workspace_id
        AND (w.owner_id = auth.uid() OR wm.id IS NOT NULL)
    )
  );
