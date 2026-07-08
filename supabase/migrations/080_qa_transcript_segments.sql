-- QA Transcript Segments: Store transcripts with precise timestamps
-- Enables jumping to exact moments where violations or key events occur

CREATE TABLE qa_transcript_segments (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id uuid NOT NULL REFERENCES calls(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  speaker text NOT NULL, -- 'agent', 'customer', 'system', 'ivr'
  text text NOT NULL,

  -- Timestamps in seconds
  start_seconds numeric(10, 2) NOT NULL, -- 0.00, 3.45, 120.00, etc.
  end_seconds numeric(10, 2) NOT NULL,

  -- Optional: if from Deepgram, store confidence and word-level details
  confidence numeric(3, 2), -- 0.00 to 1.00
  language text, -- 'en', 'es', 'fr', etc.

  -- For AI labeling: is this a key moment?
  is_key_moment boolean DEFAULT false,
  key_moment_label text, -- 'greeting', 'objection', 'closing', 'promise', 'violation', etc.

  -- Embeddings for semantic search (optional, for future)
  embedding vector(1536), -- OpenAI embedding dimension

  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  CONSTRAINT valid_times CHECK (start_seconds < end_seconds),
  CONSTRAINT valid_confidence CHECK (confidence IS NULL OR (confidence >= 0 AND confidence <= 1))
);

CREATE INDEX idx_transcript_segments_call ON qa_transcript_segments(call_id);
CREATE INDEX idx_transcript_segments_workspace ON qa_transcript_segments(workspace_id);
CREATE INDEX idx_transcript_segments_speaker ON qa_transcript_segments(speaker);
CREATE INDEX idx_transcript_segments_key_moment ON qa_transcript_segments(call_id, is_key_moment) WHERE is_key_moment = true;
CREATE INDEX idx_transcript_segments_start_time ON qa_transcript_segments(call_id, start_seconds);

-- Full-text search on transcript content
CREATE INDEX idx_transcript_segments_content ON qa_transcript_segments USING GIN (to_tsvector('spanish', text));

-- Transcript metadata summary (denormalized for faster queries)
CREATE TABLE qa_call_transcript_summary (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  call_id uuid NOT NULL UNIQUE REFERENCES calls(id) ON DELETE CASCADE,
  workspace_id uuid NOT NULL REFERENCES workspaces(id) ON DELETE CASCADE,

  total_segments integer DEFAULT 0,
  duration_seconds numeric(10, 2),
  language text DEFAULT 'en',

  -- Quick stats
  agent_turn_count integer DEFAULT 0,
  customer_turn_count integer DEFAULT 0,
  agent_avg_turn_length numeric(10, 2),
  customer_avg_turn_length numeric(10, 2),

  -- Key moments detected
  key_moments_count integer DEFAULT 0,
  key_moments_types text[], -- ['greeting', 'objection', 'closing', 'violation']

  -- For quick access
  first_agent_line_at numeric(10, 2),
  last_customer_line_at numeric(10, 2),

  -- Enriched transcript data
  has_embedding boolean DEFAULT false,
  embeddings_updated_at timestamp with time zone,

  metadata jsonb DEFAULT '{}',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX idx_transcript_summary_workspace ON qa_call_transcript_summary(workspace_id);
CREATE INDEX idx_transcript_summary_language ON qa_call_transcript_summary(language);
