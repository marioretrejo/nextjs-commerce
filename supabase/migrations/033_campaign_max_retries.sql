-- Add max_retries to campaigns (how many times to retry a no-answer/voicemail contact)
ALTER TABLE public.campaigns
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3;

-- Partial index to speed up the retry cron query:
--   "contacts in active state that might need a retry"
CREATE INDEX IF NOT EXISTS idx_campaign_contacts_retry
  ON public.campaign_contacts(campaign_id, last_called_at, attempts)
  WHERE status IN ('no_answer', 'voicemail');
