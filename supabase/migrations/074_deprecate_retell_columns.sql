-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 074: Deprecate Retell columns (MIGRATION_NOTE)
--
-- FASE 3 removed the Retell SDK entirely (lib/retell, webhook, web-call/test-call
-- routes, the batch-launch path, and the retell-sdk / retell-client-js-sdk deps).
-- The web widget now runs on LiveKit (@livekit/components-react + /api/livekit/token).
--
-- The retell_* columns are NOT dropped — per the "never destroy data without a
-- deprecation step" rule they are kept for historical rows and because
-- calls.retell_call_id is still used app-wide as the LiveKit room / call
-- identifier (the dedup key, e.g. the room_finished upsert onConflict). They are
-- flagged deprecated here; a future migration can rename them to provider-neutral
-- names (call_room_id / provider_agent_id) once all call-path code is migrated.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
BEGIN
  BEGIN
    EXECUTE $c$ COMMENT ON COLUMN public.agents.retell_agent_id IS
      'DEPRECATED (074): Retell removed. Kept for historical rows only.' $c$;
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END;

  BEGIN
    EXECUTE $c$ COMMENT ON COLUMN public.calls.retell_call_id IS
      'DEPRECATED name (074): Retell removed. Column repurposed as the LiveKit room / call identifier (dedup key). Do not drop without renaming to call_room_id first.' $c$;
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END;

  BEGIN
    EXECUTE $c$ COMMENT ON COLUMN public.campaigns.retell_batch_call_id IS
      'DEPRECATED (074): Retell batch launch removed. Campaigns now dial via the continuous LiveKit-SIP dialer. Historical rows only.' $c$;
  EXCEPTION WHEN undefined_column OR undefined_table THEN NULL; END;
END $$;
