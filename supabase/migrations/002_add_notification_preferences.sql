-- Add notification preferences to users table
alter table public.users
  add column if not exists notification_preferences jsonb not null default '["minutes_80","minutes_100","campaign_completed","payment_failed"]'::jsonb;

-- Add update policy for notification preferences
create policy "users_update_own_notifications" on public.users
  for update using (auth.uid() = id)
  with check (auth.uid() = id);
