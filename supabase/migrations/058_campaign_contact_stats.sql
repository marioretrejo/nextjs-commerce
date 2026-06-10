-- Migration 058: Campaign contact stats RPC
--
-- Provides an efficient per-campaign lead count aggregation used by
-- GET /api/campaigns to return pending/completed/failed breakdowns without
-- fetching individual contact rows.
--
-- SECURITY INVOKER: runs as the calling database role, so Supabase RLS on
-- campaign_contacts automatically restricts results to the caller's workspace.

CREATE OR REPLACE FUNCTION public.campaign_contact_stats(p_campaign_ids UUID[])
RETURNS TABLE (
  campaign_id UUID,
  pending     BIGINT,
  completed   BIGINT,
  failed      BIGINT,
  calling     BIGINT
)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
  SELECT
    campaign_id,
    COUNT(*) FILTER (WHERE status = 'pending')                                                   AS pending,
    COUNT(*) FILTER (WHERE status IN ('completed', 'converted'))                                  AS completed,
    COUNT(*) FILTER (WHERE status IN ('failed','rejected','max_attempts','invalid','excluded'))   AS failed,
    COUNT(*) FILTER (WHERE status = 'calling')                                                   AS calling
  FROM public.campaign_contacts
  WHERE campaign_id = ANY(p_campaign_ids)
  GROUP BY campaign_id;
$$;

GRANT EXECUTE ON FUNCTION public.campaign_contact_stats(UUID[]) TO authenticated, service_role;
