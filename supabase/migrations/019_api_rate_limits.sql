-- 019_api_rate_limits.sql
-- Adds per-workspace API rate limit configuration.
-- NULL means use platform default (10 req/s, burst 50).
-- Set by superadmins for Enterprise workspaces.

ALTER TABLE workspaces
  ADD COLUMN IF NOT EXISTS api_rate_limit_rps integer DEFAULT NULL;

COMMENT ON COLUMN workspaces.api_rate_limit_rps
  IS 'Custom API requests-per-second limit for this workspace. NULL = platform default (10 rps). Set by superadmin for Enterprise plans.';
