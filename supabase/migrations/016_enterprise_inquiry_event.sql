-- Migration 016: add enterprise_inquiry to workspace_events allowed types

ALTER TABLE workspace_events
  DROP CONSTRAINT IF EXISTS workspace_events_event_type_check;

ALTER TABLE workspace_events
  ADD CONSTRAINT workspace_events_event_type_check
  CHECK (event_type IN (
    'minutes_reset', 'plan_upgraded', 'plan_downgraded',
    'limit_reached', 'minutes_adjusted', 'enterprise_inquiry'
  ));
