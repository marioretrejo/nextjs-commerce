alter table public.agents
  add column if not exists flow_json jsonb default null,
  add column if not exists widget_config jsonb default '{"button_text":"Talk to us","button_color":"#0a0a0a","position":"bottom-right"}';
