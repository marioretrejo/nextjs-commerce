-- Migration 070: Telegram QA Notifications
--
-- Adds index on integrations(workspace_id, type) for fast Telegram config lookup.
-- Telegram credentials are stored in the existing integrations table with
-- type = 'telegram_qa', status = 'connected', credentials = { bot_token, chat_id }.
--
-- qac_compliance_violations is already created in migration 069.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS integrations_workspace_type_idx
  ON integrations(workspace_id, type);
