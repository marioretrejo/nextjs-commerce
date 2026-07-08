-- QA Alerts: Centralized alert management for rule violations and scoring concerns
-- Integrates with Telegram for real-time notifications

CREATE TABLE qa_alerts (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  journey_id uuid REFERENCES qa_customer_journeys(id) ON DELETE SET NULL,
  agent_id uuid REFERENCES agents(id) ON DELETE SET NULL,
  department_id uuid REFERENCES qa_departments(id) ON DELETE SET NULL,
  rule_id uuid REFERENCES qa_forbidden_rules(id) ON DELETE SET NULL,

  severity text NOT NULL DEFAULT 'medium', -- low, medium, high, critical

  title text NOT NULL, -- e.g., "Promesa de ganancias detectada"
  summary text NOT NULL, -- Brief description of the violation
  transcript_excerpt text, -- The exact phrase from the transcript
  timestamp_seconds integer, -- Where in the recording the violation occurs (0-3600)
  timestamp_label text, -- Human-readable label (e.g., "03:42")

  status text NOT NULL DEFAULT 'open', -- open, acknowledged, resolved, dismissed
  acknowledged_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  acknowledged_at timestamp with time zone,
  resolved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  resolved_at timestamp with time zone,
  resolution_notes text,

  -- Telegram notification tracking
  telegram_sent boolean DEFAULT false,
  telegram_message_id text,
  telegram_retry_count integer DEFAULT 0,
  telegram_last_retry_at timestamp with time zone,

  -- Custom data
  metadata jsonb DEFAULT '{}',

  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_severity CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  CONSTRAINT valid_status CHECK (status IN ('open', 'acknowledged', 'resolved', 'dismissed')),
  CONSTRAINT valid_timestamp CHECK (timestamp_seconds IS NULL OR timestamp_seconds >= 0)
);

CREATE INDEX idx_qa_alerts_workspace ON qa_alerts(workspace_id);
CREATE INDEX idx_qa_alerts_call ON qa_alerts(call_id);
CREATE INDEX idx_qa_alerts_journey ON qa_alerts(journey_id);
CREATE INDEX idx_qa_alerts_agent ON qa_alerts(agent_id);
CREATE INDEX idx_qa_alerts_department ON qa_alerts(department_id);
CREATE INDEX idx_qa_alerts_status ON qa_alerts(workspace_id, status);
CREATE INDEX idx_qa_alerts_severity ON qa_alerts(workspace_id, severity);
CREATE INDEX idx_qa_alerts_created ON qa_alerts(created_at DESC);

-- Alert audit log
CREATE TABLE qa_alerts_audit (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES qa_alerts(id) ON DELETE CASCADE,
  action text NOT NULL, -- 'created', 'acknowledged', 'resolved', 'dismissed', 'telegram_sent'
  actor_id uuid REFERENCES auth.users(id),
  changes jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_qa_alerts_audit_alert ON qa_alerts_audit(alert_id);
CREATE INDEX idx_qa_alerts_audit_action ON qa_alerts_audit(action);

-- Telegram delivery queue (for retry logic)
CREATE TABLE qa_alerts_telegram_queue (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  alert_id uuid NOT NULL REFERENCES qa_alerts(id) ON DELETE CASCADE,
  chat_id text NOT NULL,
  message_json text NOT NULL,
  retry_count integer DEFAULT 0,
  max_retries integer DEFAULT 3,
  status text DEFAULT 'pending', -- pending, sent, failed
  error_message text,
  next_retry_at timestamp with time zone,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_telegram_queue_status ON qa_alerts_telegram_queue(status, next_retry_at);
CREATE INDEX idx_telegram_queue_alert ON qa_alerts_telegram_queue(alert_id);
