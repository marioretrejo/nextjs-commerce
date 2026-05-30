-- Fix: add is_active column to api_keys.
-- The middleware always filters by is_active=eq.true but the column was missing,
-- causing PostgREST to return a 400 error on every API-key auth attempt.
-- DEFAULT true ensures all existing rows stay valid without any data migration.

ALTER TABLE public.api_keys
  ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;

-- Partial index: only active keys are looked up in the middleware hot path
CREATE INDEX IF NOT EXISTS idx_api_keys_hash_active
  ON public.api_keys (key_hash)
  WHERE is_active = true;
