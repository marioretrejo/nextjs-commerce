-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 047: Add call_id to call_events + RLS hardening
--
-- Problem (046 gap):
--   Events are recorded with call_room (LiveKit room name) during the call,
--   but the Supabase calls.id UUID isn't known yet. After the Close handler
--   upserts the calls row, the worker backfills call_id so events can be
--   queried by database call ID (joins, admin dashboards, etc.).
--
-- RLS note:
--   service_role always bypasses RLS in Supabase — the worker can already
--   INSERT without a policy. The explicit INSERT policy below gates any
--   future authenticated-role inserts to workspace members only.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.call_events
  ADD COLUMN IF NOT EXISTS call_id uuid
    REFERENCES public.calls(id) ON DELETE SET NULL;

-- Index for joining events to a specific call row by UUID
CREATE INDEX IF NOT EXISTS idx_call_events_call_id
  ON public.call_events (call_id)
  WHERE call_id IS NOT NULL;

-- Composite index: workspace + call_id (most common analytics join)
CREATE INDEX IF NOT EXISTS idx_call_events_workspace_call_id
  ON public.call_events (workspace_id, call_id)
  WHERE call_id IS NOT NULL;

-- Authenticated workspace members may read their own workspace's events (already in 046)
-- Explicit INSERT policy: only workspace owners / active members may insert directly.
-- In practice inserts come from service_role (bypasses RLS). This policy protects
-- against accidental use of the anon/user key.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename  = 'call_events'
      AND policyname = 'call_events_workspace_insert'
  ) THEN
    EXECUTE $policy$
      CREATE POLICY "call_events_workspace_insert" ON public.call_events
        FOR INSERT WITH CHECK (
          EXISTS (
            SELECT 1 FROM public.workspaces w
            LEFT JOIN public.workspace_members wm
              ON wm.workspace_id = w.id
             AND wm.user_id = auth.uid()
             AND wm.status = 'active'
            WHERE w.id = workspace_id
              AND (w.owner_id = auth.uid() OR wm.id IS NOT NULL)
          )
        )
    $policy$;
  END IF;
END $$;
