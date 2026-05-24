-- ============================================================
-- VoiceOS — Full Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Extensions
create extension if not exists "uuid-ossp";
create extension if not exists "pg_cron";
create extension if not exists "pgcrypto";

-- ============================================================
-- USERS
-- ============================================================
create table if not exists public.users (
  id              uuid primary key references auth.users(id) on delete cascade,
  email           text not null unique,
  name            text,
  company         text,
  avatar_url      text,
  plan            text not null default 'free' check (plan in ('free', 'pro', 'scale')),
  minutes_used    integer not null default 0,
  minutes_limit   integer not null default 50,
  stripe_customer_id       text unique,
  stripe_subscription_id   text unique,
  subscription_status      text default 'inactive',
  is_superadmin   boolean not null default false,
  is_suspended    boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.users enable row level security;

create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

create policy "users_update_own" on public.users
  for update using (auth.uid() = id);

create policy "superadmin_all_users" on public.users
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.is_superadmin = true)
  );

-- ============================================================
-- WORKSPACES
-- ============================================================
create table if not exists public.workspaces (
  id              uuid primary key default uuid_generate_v4(),
  owner_id        uuid not null references public.users(id) on delete cascade,
  name            text not null,
  logo_url        text,
  plan            text not null default 'free' check (plan in ('free', 'pro', 'scale')),
  minutes_used    integer not null default 0,
  minutes_limit   integer not null default 50,
  is_white_label  boolean not null default false,
  custom_domain   text unique,
  created_at      timestamptz not null default now()
);

alter table public.workspaces enable row level security;

create policy "workspace_member_select" on public.workspaces
  for select using (
    owner_id = auth.uid() or
    exists (
      select 1 from public.workspace_members wm
      where wm.workspace_id = id and wm.user_id = auth.uid() and wm.status = 'active'
    )
  );

create policy "workspace_owner_all" on public.workspaces
  for all using (owner_id = auth.uid());

create policy "superadmin_all_workspaces" on public.workspaces
  for all using (
    exists (select 1 from public.users u where u.id = auth.uid() and u.is_superadmin = true)
  );

-- ============================================================
-- WORKSPACE MEMBERS
-- ============================================================
create table if not exists public.workspace_members (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  user_id         uuid references public.users(id) on delete cascade,
  role            text not null default 'viewer' check (role in ('admin', 'editor', 'viewer')),
  status          text not null default 'pending' check (status in ('active', 'pending')),
  invite_email    text,
  invite_token    text unique,
  invited_at      timestamptz not null default now(),
  joined_at       timestamptz
);

alter table public.workspace_members enable row level security;

create policy "member_select_own_workspace" on public.workspace_members
  for select using (
    user_id = auth.uid() or
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

create policy "workspace_owner_manage_members" on public.workspace_members
  for all using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

-- ============================================================
-- AGENTS
-- ============================================================
create table if not exists public.agents (
  id                          uuid primary key default uuid_generate_v4(),
  workspace_id                uuid not null references public.workspaces(id) on delete cascade,
  name                        text not null,
  language                    text not null default 'en-US',
  auto_language_detection     boolean not null default false,
  voice_engine                text not null default 'retell' check (voice_engine in ('retell', 'elevenlabs', 'hybrid')),
  voice_id                    text,
  voice_name                  text,
  emotional_speed             numeric(3,2) default 1.0,
  emotional_pitch             numeric(3,2) default 1.0,
  emotional_expressiveness    numeric(3,2) default 0.7,
  objective                   text,
  personality                 text,
  system_prompt               text,
  first_message               text,
  voicemail_message           text,
  schedule_days               text[] default array['mon','tue','wed','thu','fri'],
  schedule_start_time         time default '09:00',
  schedule_end_time           time default '18:00',
  timezone                    text default 'America/New_York',
  max_attempts                integer default 3,
  retry_interval_minutes      integer default 60,
  phone_number_id             uuid,
  branded_caller_id           text,
  transfer_enabled            boolean default false,
  transfer_number             text,
  transfer_type               text default 'warm' check (transfer_type in ('warm', 'cold')),
  transfer_condition          text,
  interruption_handling       boolean default true,
  noise_cancellation          boolean default true,
  ivr_mode                    boolean default false,
  dtmf_enabled                boolean default false,
  post_call_analysis_enabled  boolean default true,
  dynamic_variables           jsonb default '{}',
  status                      text not null default 'active' check (status in ('active', 'paused')),
  retell_agent_id             text unique,
  elevenlabs_agent_id         text unique,
  avg_qa_score                numeric(5,2) default 0,
  total_calls                 integer default 0,
  created_at                  timestamptz not null default now()
);

alter table public.agents enable row level security;

create policy "agent_workspace_member_select" on public.agents
  for select using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'active'
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );

create policy "agent_workspace_owner_editor_write" on public.agents
  for all using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'active' and wm.role in ('admin', 'editor')
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );

-- ============================================================
-- PHONE NUMBERS
-- ============================================================
create table if not exists public.phone_numbers (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  number          text not null,
  country_code    text not null default 'US',
  country_name    text not null default 'United States',
  provider        text not null default 'twilio' check (provider in ('twilio', 'telnyx')),
  agent_id        uuid references public.agents(id) on delete set null,
  status          text not null default 'available' check (status in ('available', 'in_use', 'suspended')),
  branded_name    text,
  twilio_sid      text unique,
  created_at      timestamptz not null default now()
);

alter table public.phone_numbers enable row level security;

create policy "phone_workspace_member_select" on public.phone_numbers
  for select using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'active'
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );

create policy "phone_workspace_owner_admin_write" on public.phone_numbers
  for all using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'active' and wm.role = 'admin'
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );

-- ============================================================
-- KNOWLEDGE DOCUMENTS
-- ============================================================
create table if not exists public.knowledge_documents (
  id              uuid primary key default uuid_generate_v4(),
  agent_id        uuid not null references public.agents(id) on delete cascade,
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  name            text not null,
  type            text not null check (type in ('pdf', 'docx', 'text', 'url')),
  file_url        text,
  content_text    text,
  status          text not null default 'processing' check (status in ('processing', 'ready', 'error')),
  page_count      integer,
  retell_kb_id    text,
  elevenlabs_kb_id text,
  retention_days  integer default 365,
  created_at      timestamptz not null default now()
);

alter table public.knowledge_documents enable row level security;

create policy "kb_workspace_member_select" on public.knowledge_documents
  for select using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'active'
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );

create policy "kb_workspace_editor_write" on public.knowledge_documents
  for all using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'active' and wm.role in ('admin', 'editor')
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );

-- ============================================================
-- CAMPAIGNS
-- ============================================================
create table if not exists public.campaigns (
  id                    uuid primary key default uuid_generate_v4(),
  workspace_id          uuid not null references public.workspaces(id) on delete cascade,
  agent_id              uuid references public.agents(id) on delete set null,
  name                  text not null,
  description           text,
  status                text not null default 'draft' check (status in ('draft', 'scheduled', 'active', 'paused', 'completed')),
  start_at              timestamptz,
  end_at                timestamptz,
  timezone              text default 'America/New_York',
  max_concurrency       integer default 5,
  retry_enabled         boolean default true,
  retry_interval_hours  integer default 24,
  respect_schedule      boolean default true,
  total_contacts        integer default 0,
  completed_contacts    integer default 0,
  converted_contacts    integer default 0,
  retell_batch_call_id  text,
  created_at            timestamptz not null default now()
);

alter table public.campaigns enable row level security;

create policy "campaign_workspace_member_select" on public.campaigns
  for select using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'active'
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );

create policy "campaign_workspace_editor_write" on public.campaigns
  for all using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'active' and wm.role in ('admin', 'editor')
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );

-- ============================================================
-- CAMPAIGN CONTACTS
-- ============================================================
create table if not exists public.campaign_contacts (
  id              uuid primary key default uuid_generate_v4(),
  campaign_id     uuid not null references public.campaigns(id) on delete cascade,
  name            text,
  phone           text not null,
  email           text,
  variables       jsonb default '{}',
  status          text not null default 'pending' check (
    status in ('pending','calling','converted','no_answer','invalid','rejected','voicemail','max_attempts')
  ),
  attempts        integer default 0,
  last_called_at  timestamptz,
  call_id         uuid,
  created_at      timestamptz not null default now()
);

alter table public.campaign_contacts enable row level security;

create policy "contact_via_campaign_workspace" on public.campaign_contacts
  for all using (
    exists (
      select 1 from public.campaigns c
      join public.workspaces w on w.id = c.workspace_id
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'active'
      where c.id = campaign_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );

-- ============================================================
-- CALLS
-- ============================================================
create table if not exists public.calls (
  id                  uuid primary key default uuid_generate_v4(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  agent_id            uuid references public.agents(id) on delete set null,
  campaign_id         uuid references public.campaigns(id) on delete set null,
  contact_name        text,
  contact_phone       text,
  direction           text not null default 'outbound' check (direction in ('inbound', 'outbound')),
  duration_seconds    integer default 0,
  status              text default 'completed',
  outcome             text check (outcome in ('converted','no_answer','rejected','transferred','voicemail')),
  sentiment           text check (sentiment in ('positive','neutral','negative')),
  transcript          text,
  recording_url       text,
  summary             text,
  task_completed      boolean default false,
  extracted_name      text,
  extracted_email     text,
  extracted_interest  text,
  extracted_objections text,
  qa_score            numeric(5,2),
  retell_call_id      text unique,
  cost_usd            numeric(8,4) default 0,
  created_at          timestamptz not null default now()
);

alter table public.calls enable row level security;

create policy "calls_workspace_member_select" on public.calls
  for select using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'active'
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );

create policy "calls_service_insert" on public.calls
  for insert with check (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'active'
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );

-- ============================================================
-- QA CRITERIA
-- ============================================================
create table if not exists public.qa_criteria (
  id              uuid primary key default uuid_generate_v4(),
  agent_id        uuid not null references public.agents(id) on delete cascade,
  name            text not null,
  description     text,
  weight          integer not null default 5 check (weight between 1 and 10),
  created_at      timestamptz not null default now()
);

alter table public.qa_criteria enable row level security;

create policy "qa_criteria_via_agent_workspace" on public.qa_criteria
  for all using (
    exists (
      select 1 from public.agents a
      join public.workspaces w on w.id = a.workspace_id
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'active'
      where a.id = agent_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );

-- ============================================================
-- INTEGRATIONS
-- ============================================================
create table if not exists public.integrations (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  type            text not null check (
    type in ('hubspot','gohighlevel','salesforce','zapier','make','calendly',
             'google_calendar','twilio','telnyx','webhook')
  ),
  status          text not null default 'disconnected' check (status in ('connected', 'disconnected')),
  credentials     jsonb default '{}',
  webhook_url     text,
  webhook_events  text[] default array[]::text[],
  created_at      timestamptz not null default now(),
  unique (workspace_id, type)
);

alter table public.integrations enable row level security;

create policy "integrations_workspace_member" on public.integrations
  for select using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'active'
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );

create policy "integrations_workspace_admin_write" on public.integrations
  for all using (
    exists (
      select 1 from public.workspaces w
      left join public.workspace_members wm on wm.workspace_id = w.id and wm.user_id = auth.uid() and wm.status = 'active' and wm.role = 'admin'
      where w.id = workspace_id and (w.owner_id = auth.uid() or wm.id is not null)
    )
  );

-- ============================================================
-- NOTIFICATIONS
-- ============================================================
create table if not exists public.notifications (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid references public.workspaces(id) on delete cascade,
  user_id         uuid not null references public.users(id) on delete cascade,
  type            text not null check (
    type in ('minutes_80','minutes_100','campaign_completed','contact_converted',
             'qa_alert','team_invite','payment_failed','broadcast')
  ),
  title           text not null,
  message         text not null,
  read            boolean not null default false,
  created_at      timestamptz not null default now()
);

alter table public.notifications enable row level security;

create policy "notifications_own" on public.notifications
  for all using (user_id = auth.uid());

-- ============================================================
-- BILLING INVOICES
-- ============================================================
create table if not exists public.billing_invoices (
  id                  uuid primary key default uuid_generate_v4(),
  workspace_id        uuid not null references public.workspaces(id) on delete cascade,
  stripe_invoice_id   text unique not null,
  amount              integer not null,
  currency            text not null default 'usd',
  status              text not null,
  period_start        timestamptz,
  period_end          timestamptz,
  pdf_url             text,
  created_at          timestamptz not null default now()
);

alter table public.billing_invoices enable row level security;

create policy "invoices_workspace_owner" on public.billing_invoices
  for select using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

-- ============================================================
-- API KEYS
-- ============================================================
create table if not exists public.api_keys (
  id              uuid primary key default uuid_generate_v4(),
  workspace_id    uuid not null references public.workspaces(id) on delete cascade,
  name            text not null,
  key_hash        text not null unique,
  key_prefix      text not null,
  last_used_at    timestamptz,
  created_at      timestamptz not null default now()
);

alter table public.api_keys enable row level security;

create policy "api_keys_workspace_owner" on public.api_keys
  for all using (
    exists (
      select 1 from public.workspaces w
      where w.id = workspace_id and w.owner_id = auth.uid()
    )
  );

-- ============================================================
-- INDEXES
-- ============================================================
create index if not exists idx_agents_workspace_id on public.agents(workspace_id);
create index if not exists idx_agents_status on public.agents(status);
create index if not exists idx_agents_retell_id on public.agents(retell_agent_id);

create index if not exists idx_calls_workspace_id on public.calls(workspace_id);
create index if not exists idx_calls_agent_id on public.calls(agent_id);
create index if not exists idx_calls_campaign_id on public.calls(campaign_id);
create index if not exists idx_calls_created_at on public.calls(created_at desc);
create index if not exists idx_calls_retell_id on public.calls(retell_call_id);
create index if not exists idx_calls_outcome on public.calls(outcome);

create index if not exists idx_campaigns_workspace_id on public.campaigns(workspace_id);
create index if not exists idx_campaigns_status on public.campaigns(status);
create index if not exists idx_campaigns_agent_id on public.campaigns(agent_id);

create index if not exists idx_campaign_contacts_campaign_id on public.campaign_contacts(campaign_id);
create index if not exists idx_campaign_contacts_status on public.campaign_contacts(status);
create index if not exists idx_campaign_contacts_phone on public.campaign_contacts(phone);

create index if not exists idx_knowledge_docs_agent_id on public.knowledge_documents(agent_id);
create index if not exists idx_knowledge_docs_workspace_id on public.knowledge_documents(workspace_id);

create index if not exists idx_phone_numbers_workspace_id on public.phone_numbers(workspace_id);
create index if not exists idx_phone_numbers_agent_id on public.phone_numbers(agent_id);

create index if not exists idx_notifications_user_id on public.notifications(user_id);
create index if not exists idx_notifications_read on public.notifications(read);
create index if not exists idx_notifications_created_at on public.notifications(created_at desc);

create index if not exists idx_workspace_members_workspace_id on public.workspace_members(workspace_id);
create index if not exists idx_workspace_members_user_id on public.workspace_members(user_id);

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create user profile on auth.users insert
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.users (id, email, name, avatar_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'),
    new.raw_user_meta_data->>'avatar_url'
  );

  -- Auto-create personal workspace
  insert into public.workspaces (owner_id, name, plan, minutes_limit)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)) || '''s Workspace',
    'free',
    50
  );

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Update minutes_used on call completion
create or replace function public.update_minutes_on_call()
returns trigger language plpgsql security definer as $$
declare
  minutes_to_add integer;
begin
  if new.duration_seconds is not null and new.duration_seconds > 0 then
    minutes_to_add := ceil(new.duration_seconds::numeric / 60);

    update public.workspaces
    set minutes_used = minutes_used + minutes_to_add
    where id = new.workspace_id;

    -- Check 80% threshold
    with ws as (
      select minutes_used, minutes_limit, owner_id
      from public.workspaces where id = new.workspace_id
    )
    insert into public.notifications (workspace_id, user_id, type, title, message)
    select
      new.workspace_id,
      ws.owner_id,
      'minutes_80',
      'Approaching minutes limit',
      'You have used 80% of your monthly minutes.'
    from ws
    where ws.minutes_used::numeric / ws.minutes_limit >= 0.8
      and ws.minutes_used::numeric / ws.minutes_limit < 1.0
      and not exists (
        select 1 from public.notifications n
        where n.workspace_id = new.workspace_id
          and n.type = 'minutes_80'
          and n.created_at > date_trunc('month', now())
      );

    -- Check 100% threshold
    with ws as (
      select minutes_used, minutes_limit, owner_id
      from public.workspaces where id = new.workspace_id
    )
    insert into public.notifications (workspace_id, user_id, type, title, message)
    select
      new.workspace_id,
      ws.owner_id,
      'minutes_100',
      'Minutes limit reached',
      'You have used all your monthly minutes. Upgrade to continue.'
    from ws
    where ws.minutes_used >= ws.minutes_limit
      and not exists (
        select 1 from public.notifications n
        where n.workspace_id = new.workspace_id
          and n.type = 'minutes_100'
          and n.created_at > date_trunc('month', now())
      );
  end if;

  -- Update agent stats
  update public.agents
  set
    total_calls = total_calls + 1,
    avg_qa_score = case
      when new.qa_score is not null then
        (avg_qa_score * total_calls + new.qa_score) / (total_calls + 1)
      else avg_qa_score
    end
  where id = new.agent_id;

  return new;
end;
$$;

drop trigger if exists on_call_inserted on public.calls;
create trigger on_call_inserted
  after insert on public.calls
  for each row execute function public.update_minutes_on_call();

-- Reset minutes on first of month (pg_cron)
select cron.schedule(
  'reset-monthly-minutes',
  '0 0 1 * *',
  $$
    update public.workspaces set minutes_used = 0;
    update public.users set minutes_used = 0;
  $$
);

-- Auto-delete recordings after retention period
select cron.schedule(
  'cleanup-old-recordings',
  '0 3 * * *',
  $$
    update public.calls
    set recording_url = null, transcript = null
    where created_at < now() - interval '1 day' * coalesce(
      (select retention_days from public.knowledge_documents limit 1), 365
    )
    and recording_url is not null;
  $$
);

-- ============================================================
-- REALTIME
-- ============================================================
alter publication supabase_realtime add table public.calls;
alter publication supabase_realtime add table public.campaigns;
alter publication supabase_realtime add table public.campaign_contacts;
alter publication supabase_realtime add table public.notifications;
alter publication supabase_realtime add table public.agents;

-- ============================================================
-- STORAGE BUCKETS
-- ============================================================
insert into storage.buckets (id, name, public)
values
  ('avatars', 'avatars', true),
  ('logos', 'logos', true),
  ('knowledge', 'knowledge', false),
  ('recordings', 'recordings', false)
on conflict (id) do nothing;

-- Storage policies
create policy "avatars_public_read" on storage.objects
  for select using (bucket_id = 'avatars');

create policy "avatars_auth_upload" on storage.objects
  for insert with check (bucket_id = 'avatars' and auth.uid() is not null);

create policy "logos_public_read" on storage.objects
  for select using (bucket_id = 'logos');

create policy "logos_auth_upload" on storage.objects
  for insert with check (bucket_id = 'logos' and auth.uid() is not null);

create policy "knowledge_auth_access" on storage.objects
  for all using (bucket_id = 'knowledge' and auth.uid() is not null);

create policy "recordings_auth_access" on storage.objects
  for all using (bucket_id = 'recordings' and auth.uid() is not null);
