-- ═══════════════════════════════════════════════════════════════════════════
-- Migration 031: AI State Machine Flow Builder
--
-- Adds flow_config JSONB to agents. Separate from legacy flow_json (v1 IVR)
-- so both schemas can coexist during migration. Worker prefers flow_config.
-- ═══════════════════════════════════════════════════════════════════════════

ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS flow_config JSONB;
