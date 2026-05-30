-- ══════════════════════════════════════════════════════════
-- 026 · Dynamic Agent Tools
-- ══════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public.agent_tools (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  agent_id         uuid NOT NULL REFERENCES public.agents(id) ON DELETE CASCADE,
  workspace_id     uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  name             text NOT NULL,
  description      text NOT NULL DEFAULT '',
  parameter_schema jsonb NOT NULL DEFAULT '{"type":"object","properties":{},"required":[]}'::jsonb,
  server_url       text NOT NULL,
  method           text NOT NULL DEFAULT 'POST'
                   CHECK (method IN ('GET','POST','PUT','PATCH','DELETE')),
  headers          jsonb DEFAULT '{}'::jsonb,
  created_at       timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS agent_tools_agent_name_idx
  ON public.agent_tools(agent_id, name);

ALTER TABLE public.agent_tools ENABLE ROW LEVEL SECURITY;

CREATE POLICY "workspace_owner_manage_agent_tools"
  ON public.agent_tools FOR ALL
  USING (
    workspace_id IN (
      SELECT id FROM public.workspaces WHERE owner_id = auth.uid()
      UNION
      SELECT workspace_id FROM public.workspace_members
        WHERE user_id = auth.uid() AND status = 'active'
    )
  );
