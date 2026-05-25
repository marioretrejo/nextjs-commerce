-- Migration 013: voice_engine_internal column on agents
-- Client sees: standard | ultra_fast | premium
-- Internally maps to: elevenlabs_v2 | cartesia_sonic3 | elevenlabs_v3

ALTER TABLE agents
  ADD COLUMN IF NOT EXISTS voice_engine_internal TEXT
    CHECK (voice_engine_internal IN ('elevenlabs_v2','cartesia_sonic3','elevenlabs_v3'));

-- Migrate existing voice_engine values to new generic tier names
-- Old values: retell, elevenlabs, hybrid → map to standard/ultra_fast/premium
UPDATE agents SET
  voice_engine_internal = CASE
    WHEN voice_engine = 'elevenlabs' THEN 'elevenlabs_v2'
    WHEN voice_engine = 'hybrid'     THEN 'elevenlabs_v2'
    ELSE 'elevenlabs_v2'  -- retell default → standard → elevenlabs_v2
  END
WHERE voice_engine_internal IS NULL;

-- Update voice_engine to new generic tier names for existing records
UPDATE agents SET
  voice_engine = CASE
    WHEN voice_engine = 'retell'     THEN 'standard'
    WHEN voice_engine = 'elevenlabs' THEN 'standard'
    WHEN voice_engine = 'hybrid'     THEN 'ultra_fast'
    ELSE voice_engine
  END
WHERE voice_engine IN ('retell', 'elevenlabs', 'hybrid');
