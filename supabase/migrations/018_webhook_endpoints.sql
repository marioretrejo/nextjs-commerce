-- Migration 018: Customer-facing webhook endpoints
-- Separate from integrations table to allow multiple endpoints per workspace

CREATE TABLE IF NOT EXISTS public.webhook_endpoints (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id    UUID NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  url             TEXT NOT NULL,
  secret          TEXT NOT NULL DEFAULT encode(gen_random_bytes(32), 'hex'),
  events          TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  description     TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  last_delivery_at         TIMESTAMPTZ,
  last_delivery_status     TEXT,
  last_delivery_status_code INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE public.webhook_endpoints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "webhook_endpoints_select"
  ON public.webhook_endpoints FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_members wm
        ON wm.workspace_id = w.id AND wm.user_id = auth.uid() AND wm.status = 'active'
      WHERE w.id = webhook_endpoints.workspace_id
        AND (w.owner_id = auth.uid() OR wm.id IS NOT NULL)
    )
  );

CREATE POLICY "webhook_endpoints_write"
  ON public.webhook_endpoints FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.workspaces w
      LEFT JOIN public.workspace_members wm
        ON wm.workspace_id = w.id AND wm.user_id = auth.uid()
          AND wm.status = 'active' AND wm.role = 'admin'
      WHERE w.id = webhook_endpoints.workspace_id
        AND (w.owner_id = auth.uid() OR wm.id IS NOT NULL)
    )
  );

CREATE INDEX IF NOT EXISTS idx_webhook_endpoints_workspace
  ON public.webhook_endpoints (workspace_id) WHERE is_active = TRUE;

CREATE OR REPLACE FUNCTION public.touch_webhook_endpoint()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = NOW(); RETURN NEW; END;
$$;

CREATE TRIGGER webhook_endpoints_updated_at
  BEFORE UPDATE ON public.webhook_endpoints
  FOR EACH ROW EXECUTE FUNCTION public.touch_webhook_endpoint();

CREATE OR REPLACE FUNCTION public.record_webhook_delivery(
  p_endpoint_id UUID, p_status TEXT, p_status_code INT
) RETURNS VOID LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE public.webhook_endpoints
  SET last_delivery_at = NOW(), last_delivery_status = p_status, last_delivery_status_code = p_status_code
  WHERE id = p_endpoint_id;
END;
$$;
