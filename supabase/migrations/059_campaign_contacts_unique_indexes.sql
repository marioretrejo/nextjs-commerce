-- Migration 059: Unique indexes on campaign_contacts
--
-- Prevents duplicate phone numbers within a campaign and duplicate
-- external lead IDs (campaign_lead_id) within a campaign.
-- Partial index for campaign_lead_id covers only non-NULL values.

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_contacts_phone_unique
  ON public.campaign_contacts (campaign_id, phone);

CREATE UNIQUE INDEX IF NOT EXISTS idx_campaign_contacts_lead_id_unique
  ON public.campaign_contacts (campaign_id, campaign_lead_id)
  WHERE campaign_lead_id IS NOT NULL;
