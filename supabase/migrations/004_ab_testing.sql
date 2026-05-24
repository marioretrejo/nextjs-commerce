alter table public.campaigns
  add column if not exists ab_enabled boolean not null default false,
  add column if not exists ab_agent_id uuid references public.agents(id) on delete set null,
  add column if not exists ab_split_ratio integer not null default 50;
