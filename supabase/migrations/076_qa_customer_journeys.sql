-- QA Customer Journeys: Group calls by phone + agent + department
-- Tracks the full customer journey to enable context-aware scoring

CREATE TABLE qa_customer_journeys (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  contact_phone text NOT NULL,
  contact_name text,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  department text,
  first_call_at timestamp with time zone,
  last_call_at timestamp with time zone,
  total_calls integer DEFAULT 0,
  final_outcome text, -- 'converted', 'pending', 'rejected', 'callback_requested', etc.
  final_score numeric(5, 2), -- Journey-level score
  journey_summary text,
  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(workspace_id, contact_phone, agent_id, COALESCE(department, '')),
  CONSTRAINT valid_phone CHECK (contact_phone ~ '^\+?[0-9\s\-\(\)]{7,}$')
);

CREATE INDEX idx_qa_journeys_workspace ON qa_customer_journeys(workspace_id);
CREATE INDEX idx_qa_journeys_phone ON qa_customer_journeys(workspace_id, contact_phone);
CREATE INDEX idx_qa_journeys_agent ON qa_customer_journeys(workspace_id, agent_id);
CREATE INDEX idx_qa_journeys_department ON qa_customer_journeys(workspace_id, department);
CREATE INDEX idx_qa_journeys_updated ON qa_customer_journeys(updated_at DESC);

-- Tracks which calls belong to which journey
CREATE TABLE qa_journey_calls (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  journey_id uuid NOT NULL REFERENCES qa_customer_journeys(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  sequence_index integer NOT NULL, -- 1, 2, 3... in chronological order
  role_in_journey text NOT NULL, -- 'first_touch', 'follow_up', 'closing_call', 'support_call', 'other'
  created_at timestamp with time zone DEFAULT now(),
  UNIQUE(journey_id, call_id),
  CONSTRAINT valid_role CHECK (
    role_in_journey IN ('first_touch', 'follow_up', 'closing_call', 'support_call', 'other')
  )
);

CREATE INDEX idx_qa_journey_calls_journey ON qa_journey_calls(journey_id);
CREATE INDEX idx_qa_journey_calls_call ON qa_journey_calls(call_id);

-- Auto-update journey timestamps
CREATE OR REPLACE FUNCTION update_journey_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE qa_customer_journeys
  SET updated_at = now()
  WHERE id = NEW.journey_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_journey_call_update
AFTER INSERT OR UPDATE ON qa_journey_calls
FOR EACH ROW
EXECUTE FUNCTION update_journey_timestamps();
