-- 049_cost_status_partial: add 'partial' to cost_status allowed values
-- 'partial' = some providers priced (costs configured), others unknown.
-- Requires dropping and recreating the named constraint from migration 048.

ALTER TABLE calls DROP CONSTRAINT IF EXISTS calls_cost_status_check;
ALTER TABLE calls
  ADD CONSTRAINT calls_cost_status_check
  CHECK (cost_status IN ('not_calculated', 'estimated', 'partial', 'final', 'failed'));
