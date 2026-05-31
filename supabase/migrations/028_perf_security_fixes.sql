-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 028: Performance + Security + Bug fixes
--
-- BUGS FIXED:
--   1. minutes_used double-counted per call (trigger + finalize_call_billing both incremented)
--   2. total_calls double-counted per call (trigger + increment_agent_total_calls both incremented)
--
-- PERFORMANCE:
--   3. 21 missing indexes on FK columns (workspaces.owner_id is hot path on every request)
--   4. auth_rls_initplan: is_workspace_member/owns_workspace/is_superadmin now use
--      (SELECT auth.uid()) so Postgres evaluates auth once per query, not per row
--   5. Consolidated multiple permissive policies on workspaces table
--
-- SECURITY:
--   6. REVOKE EXECUTE on 10 sensitive SECURITY DEFINER functions from PUBLIC/anon/authenticated
--   7. SET search_path = public, pg_catalog on all custom SECURITY DEFINER functions
-- ═══════════════════════════════════════════════════════════════════════════


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 1: Missing indexes on FK columns
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_workspaces_owner_id           ON public.workspaces(owner_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_workspace_id ON public.workspace_members(workspace_id);
CREATE INDEX IF NOT EXISTS idx_workspace_members_user_id      ON public.workspace_members(user_id);
CREATE INDEX IF NOT EXISTS idx_integrations_workspace_id      ON public.integrations(workspace_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_workspace_id     ON public.phone_numbers(workspace_id);
CREATE INDEX IF NOT EXISTS idx_phone_numbers_agent_id         ON public.phone_numbers(agent_id);
CREATE INDEX IF NOT EXISTS idx_api_keys_workspace_id          ON public.api_keys(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_workspace_id         ON public.campaigns(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaigns_agent_id             ON public.campaigns(agent_id);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_workspace_id ON public.campaign_templates(workspace_id);
CREATE INDEX IF NOT EXISTS idx_campaign_templates_agent_id    ON public.campaign_templates(agent_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_kb_id          ON public.document_chunks(kb_id);
CREATE INDEX IF NOT EXISTS idx_document_chunks_workspace_id   ON public.document_chunks(workspace_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_bases_workspace_id   ON public.knowledge_bases(workspace_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_workspace_id ON public.knowledge_documents(workspace_id);
CREATE INDEX IF NOT EXISTS idx_knowledge_documents_agent_id   ON public.knowledge_documents(agent_id);
CREATE INDEX IF NOT EXISTS idx_notifications_workspace_id     ON public.notifications(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_workspace_id        ON public.audit_logs(workspace_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_actor_id            ON public.audit_logs(actor_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_workspace_id  ON public.automation_rules(workspace_id);
CREATE INDEX IF NOT EXISTS idx_automation_rules_agent_id      ON public.automation_rules(agent_id);


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 2: Fix update_minutes_on_call trigger (removes double-counting)
--
-- Before: trigger incremented minutes_used AND finalize_call_billing did too → 2x charge
--         trigger incremented total_calls AND increment_agent_total_calls did too → 2x count
-- After:  trigger only handles avg_qa_score + threshold notifications
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.update_minutes_on_call()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
BEGIN
  -- Update avg_qa_score only when a new qa_score is being set (analyze-call job)
  IF new.qa_score IS NOT NULL
     AND (OLD.qa_score IS NULL OR OLD.qa_score IS DISTINCT FROM NEW.qa_score) THEN
    UPDATE public.agents
    SET avg_qa_score = (COALESCE(avg_qa_score, 0) * GREATEST(total_calls - 1, 0) + new.qa_score)
                       / GREATEST(total_calls, 1)
    WHERE id = new.agent_id;
  END IF;

  -- Send threshold notifications only when duration_seconds first becomes set.
  -- minutes_used is already correct (set by finalize_call_billing) when this fires.
  IF new.duration_seconds IS NOT NULL AND new.duration_seconds > 0
     AND (OLD.duration_seconds IS NULL OR OLD.duration_seconds = 0) THEN

    WITH ws AS (
      SELECT minutes_used, minutes_limit, owner_id
      FROM public.workspaces WHERE id = new.workspace_id
    )
    INSERT INTO public.notifications (workspace_id, user_id, type, title, message)
    SELECT new.workspace_id, ws.owner_id, 'minutes_80',
           'Approaching minutes limit',
           'You have used 80% of your monthly minutes.'
    FROM ws
    WHERE ws.minutes_used::numeric / NULLIF(ws.minutes_limit, 0) >= 0.8
      AND ws.minutes_used::numeric / NULLIF(ws.minutes_limit, 0) < 1.0
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.workspace_id = new.workspace_id
          AND n.type = 'minutes_80'
          AND n.created_at > date_trunc('month', now())
      );

    WITH ws AS (
      SELECT minutes_used, minutes_limit, owner_id
      FROM public.workspaces WHERE id = new.workspace_id
    )
    INSERT INTO public.notifications (workspace_id, user_id, type, title, message)
    SELECT new.workspace_id, ws.owner_id, 'minutes_100',
           'Minutes limit reached',
           'You have used all your monthly minutes. Upgrade to continue.'
    FROM ws
    WHERE ws.minutes_used >= ws.minutes_limit
      AND NOT EXISTS (
        SELECT 1 FROM public.notifications n
        WHERE n.workspace_id = new.workspace_id
          AND n.type = 'minutes_100'
          AND n.created_at > date_trunc('month', now())
      );
  END IF;

  RETURN new;
END;
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 3: REVOKE EXECUTE on sensitive SECURITY DEFINER functions from PUBLIC
-- These were callable anonymously via /rest/v1/rpc/ — attacker could drain minutes,
-- release call slots, or inject fake audit logs.
-- service_role (superuser) bypasses GRANT/REVOKE so this is safe.
-- ─────────────────────────────────────────────────────────────────────────────

REVOKE EXECUTE ON FUNCTION public.check_workspace_balance(uuid, numeric)    FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.finalize_call_billing(uuid, numeric)       FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.release_call_slot(uuid)                   FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.try_claim_call_slot(uuid)                 FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_workspace_minutes(uuid, numeric) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_workspace_balance(uuid, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.increment_agent_total_calls(uuid)          FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.write_audit_log(uuid,text,text,text,uuid,uuid,jsonb,text) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.record_webhook_delivery(uuid, text, integer) FROM PUBLIC;
REVOKE EXECUTE ON FUNCTION public.match_document_chunks(public.vector, uuid, double precision, integer) FROM PUBLIC;
-- Re-grant match_document_chunks to authenticated (used by dashboard RAG queries)
GRANT  EXECUTE ON FUNCTION public.match_document_chunks(public.vector, uuid, double precision, integer) TO authenticated;
-- is_workspace_member, owns_workspace, is_superadmin kept accessible (required by RLS USING clauses)


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 4: Fix auth_rls_initplan — (SELECT auth.uid()) evaluated once per query
-- Also adds SET search_path to fix mutable search_path security warning
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.is_workspace_member(p_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspace_members
    WHERE workspace_id = p_workspace_id
      AND user_id = (SELECT auth.uid())
      AND status = 'active'
  );
$$;

CREATE OR REPLACE FUNCTION public.owns_workspace(p_workspace_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.workspaces
    WHERE id = p_workspace_id
      AND owner_id = (SELECT auth.uid())
  );
$$;

CREATE OR REPLACE FUNCTION public.is_superadmin()
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_catalog AS $$
  SELECT COALESCE(
    (SELECT is_superadmin FROM public.users WHERE id = (SELECT auth.uid())),
    false
  );
$$;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 5: Add SET search_path to remaining SECURITY DEFINER functions
-- ─────────────────────────────────────────────────────────────────────────────

ALTER FUNCTION public.handle_new_user()
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.check_workspace_balance(uuid, numeric)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.finalize_call_billing(uuid, numeric)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.release_call_slot(uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.try_claim_call_slot(uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.increment_workspace_minutes(uuid, numeric)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.increment_workspace_balance(uuid, integer)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.increment_agent_total_calls(uuid)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.write_audit_log(uuid, text, text, text, uuid, uuid, jsonb, text)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.record_webhook_delivery(uuid, text, integer)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.match_document_chunks(public.vector, uuid, double precision, integer)
  SET search_path = public, pg_catalog;

ALTER FUNCTION public.touch_webhook_endpoint()
  SET search_path = public, pg_catalog;


-- ─────────────────────────────────────────────────────────────────────────────
-- SECTION 6: Consolidate multiple permissive policies on workspaces (3 → 2)
-- ─────────────────────────────────────────────────────────────────────────────

DROP POLICY IF EXISTS "superadmin_all_workspaces" ON public.workspaces;
DROP POLICY IF EXISTS "workspace_owner_all"       ON public.workspaces;
DROP POLICY IF EXISTS "workspace_member_select"   ON public.workspaces;

-- Owner + superadmin: full access (ALL commands)
CREATE POLICY "workspace_owner_all" ON public.workspaces
  FOR ALL USING (
    owner_id = (SELECT auth.uid()) OR is_superadmin()
  );

-- Non-owner members: read-only
CREATE POLICY "workspace_member_select" ON public.workspaces
  FOR SELECT USING (
    id IN (
      SELECT workspace_id FROM public.workspace_members
      WHERE user_id = (SELECT auth.uid()) AND status = 'active'
    )
  );
