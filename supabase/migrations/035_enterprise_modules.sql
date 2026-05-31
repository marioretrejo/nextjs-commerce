-- Module 1: Agent Core Engine
ALTER TABLE public.agents
  ADD COLUMN IF NOT EXISTS response_delay_ms integer NOT NULL DEFAULT 500,
  ADD COLUMN IF NOT EXISTS speak_first boolean NOT NULL DEFAULT false;

-- Module 4: Auto-QA feedback field
ALTER TABLE public.calls
  ADD COLUMN IF NOT EXISTS qa_feedback text;

-- Module 5: White-label custom CSS (already has favicon_url and custom_css in branding JSONB — no schema change needed)

-- Module 2: TCPA — ensure dnc_list exists (from migration 010, but guard with IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS public.dnc_list (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  workspace_id uuid NOT NULL REFERENCES public.workspaces(id) ON DELETE CASCADE,
  phone text NOT NULL,
  reason text,
  added_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (workspace_id, phone)
);
CREATE INDEX IF NOT EXISTS idx_dnc_list_workspace_phone ON public.dnc_list(workspace_id, phone);

-- Enable RLS on dnc_list if not already
ALTER TABLE public.dnc_list ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'dnc_list' AND policyname = 'workspace_members_dnc'
  ) THEN
    CREATE POLICY workspace_members_dnc ON public.dnc_list
      USING (workspace_id IN (
        SELECT workspace_id FROM public.workspace_members WHERE user_id = auth.uid()
      ));
  END IF;
END $$;
