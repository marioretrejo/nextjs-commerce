-- Provider cost configuration table
-- Stores per-unit costs for every third-party service used in a call.
-- Seeded with sane defaults; admin can update via the calculator UI.

CREATE TABLE IF NOT EXISTS provider_costs (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  -- Telephony (cents per minute)
  twilio_outbound_per_min  numeric(10,4) NOT NULL DEFAULT 0.85,  -- $0.0085/min outbound
  twilio_inbound_per_min   numeric(10,4) NOT NULL DEFAULT 0.85,  -- $0.0085/min inbound
  livekit_per_min          numeric(10,4) NOT NULL DEFAULT 0.20,  -- $0.002/min per participant
  -- AI services
  stt_per_min              numeric(10,4) NOT NULL DEFAULT 0.59,  -- Deepgram Nova-3 $0.0059/min
  llm_per_1k_tokens        numeric(10,4) NOT NULL DEFAULT 0.06,  -- Groq Llama 4 Scout
  tts_per_1k_chars         numeric(10,4) NOT NULL DEFAULT 0.65,  -- Cartesia Sonic-3
  -- Metadata
  label                    text NOT NULL DEFAULT 'default',
  updated_at               timestamptz NOT NULL DEFAULT now(),
  updated_by               uuid REFERENCES auth.users(id)
);

-- Only one active cost config row needed; use label='default'
INSERT INTO provider_costs (label) VALUES ('default') ON CONFLICT DO NOTHING;

-- RLS: only superadmins can mutate; all authenticated can read
ALTER TABLE provider_costs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "read_provider_costs" ON provider_costs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "write_provider_costs" ON provider_costs
  FOR ALL USING (
    EXISTS (SELECT 1 FROM users WHERE id = auth.uid() AND is_superadmin = true)
  );
