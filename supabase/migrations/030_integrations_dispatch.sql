-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 030: Add telegram/n8n/teams integration types + extracted_data
-- ═══════════════════════════════════════════════════════════════════════════

-- Extend integrations.type CHECK to include new messaging/automation types.
-- Must drop and recreate the named constraint (Postgres can't ALTER CHECK).
ALTER TABLE public.integrations DROP CONSTRAINT IF EXISTS integrations_type_check;
ALTER TABLE public.integrations ADD CONSTRAINT integrations_type_check CHECK (
  type IN (
    'hubspot','gohighlevel','salesforce','zapier','make','calendly',
    'google_calendar','twilio','telnyx','webhook',
    'telegram','n8n','teams'
  )
);

-- Consolidated extracted call data as a single JSONB blob for n8n/webhook payloads
ALTER TABLE public.calls ADD COLUMN IF NOT EXISTS extracted_data JSONB;
