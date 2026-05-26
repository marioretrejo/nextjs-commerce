-- Migration 017: Add invite_token to workspace_members for email invite flow
ALTER TABLE workspace_members
  ADD COLUMN IF NOT EXISTS invite_token TEXT UNIQUE;
