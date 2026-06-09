-- Migration 051: Add webhook_url to workspaces
--
-- Allows operators to configure a workspace-level outbound webhook that receives
-- a signed call.completed payload after each call ends (HMAC-SHA256 via
-- INTERNAL_API_SECRET). Per-call overrides via room metadata remain supported.
--
-- The column is intentionally nullable — a NULL means webhooks are disabled for
-- that workspace. Validation (URL format) is left to the application layer.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS webhook_url text NULL;

COMMENT ON COLUMN workspaces.webhook_url IS
  'Outbound webhook endpoint. When set, VoiceOS POSTs a signed call.completed '
  'payload (X-VoiceOS-Signature: HMAC-SHA256) after each call ends. '
  'Per-call overrides via room metadata take precedence over this column.';
