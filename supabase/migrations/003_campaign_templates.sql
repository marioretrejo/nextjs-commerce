create table if not exists public.campaign_templates (
  id           uuid primary key default uuid_generate_v4(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  name         text not null,
  description  text,
  agent_id     uuid references public.agents(id) on delete set null,
  config       jsonb not null default '{}',
  created_at   timestamptz not null default now()
);

alter table public.campaign_templates enable row level security;

create policy "templates_workspace_access" on public.campaign_templates
  for all using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid()
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );
