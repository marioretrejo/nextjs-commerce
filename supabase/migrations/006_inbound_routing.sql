alter table public.phone_numbers
  add column if not exists inbound_enabled boolean not null default false,
  add column if not exists routing_rules jsonb not null default '{"default_agent_id":null,"rules":[]}';
