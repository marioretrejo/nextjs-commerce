-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 073: call_recordings storage bucket + RLS
--
-- The LiveKit egress writes call audio to a private bucket named
-- "call_recordings" (app/api/webhooks/livekit/route.ts) and the call detail
-- page reads signed URLs from it (app/(app)/calls/[id]/page.tsx), but no
-- migration ever created that bucket or any storage.objects policy for it — so
-- on a fresh project the egress upload fails and the bucket has no access rules.
--
-- This creates the private bucket idempotently and adds a workspace-scoped read
-- policy: an authenticated user may read a recording only if its object path
-- contains the id of an agent in a workspace they are an active member of.
-- (Egress object paths are `agent-<agentId>-<ts>/...`, so matching on the agent
-- id is robust regardless of the sip-agent/agent prefix.)
-- ═══════════════════════════════════════════════════════════════════════════

INSERT INTO storage.buckets (id, name, public)
VALUES ('call_recordings', 'call_recordings', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "call_recordings_workspace_read" ON storage.objects;
CREATE POLICY "call_recordings_workspace_read" ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'call_recordings'
    AND EXISTS (
      SELECT 1
      FROM public.agents a
      JOIN public.workspace_members m ON m.workspace_id = a.workspace_id
      WHERE m.user_id = (SELECT auth.uid())
        AND m.status = 'active'
        AND storage.objects.name LIKE '%' || a.id::text || '%'
    )
  );

-- Writes happen exclusively through the service-role client (egress), which
-- bypasses RLS, so no INSERT/UPDATE policy is granted to ordinary roles.
