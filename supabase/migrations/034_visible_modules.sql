-- Add visible_modules to workspace_members (which nav modules a member can see)
ALTER TABLE public.workspace_members
  ADD COLUMN IF NOT EXISTS visible_modules text[] NOT NULL DEFAULT ARRAY[
    'dashboard','agents','campaigns','calls','analytics',
    'knowledge','quality','numbers','compliance','integrations',
    'team','billing','settings','developers'
  ];
