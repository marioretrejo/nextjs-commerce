-- =============================================================================
-- Voice Agent Infrastructure – Database Schema
-- Target: PostgreSQL 15 + TimescaleDB 2.x
-- Run this AFTER switching from SQLite to PostgreSQL for production.
-- =============================================================================

-- Enable TimescaleDB extension
CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS pg_trgm;     -- fuzzy text search on transcripts

-- ── Agent Configurations ──────────────────────────────────────────────────────
CREATE TABLE voice_agents (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name            TEXT NOT NULL,
    owner_api_key   TEXT NOT NULL,           -- hashed API key reference
    system_prompt   TEXT,
    llm_model       TEXT NOT NULL DEFAULT 'gpt-4o',
    stt_model       TEXT NOT NULL DEFAULT 'nova-2',
    tts_provider    TEXT NOT NULL DEFAULT 'elevenlabs',
    tts_voice_id    TEXT,
    language        TEXT NOT NULL DEFAULT 'en-US',
    silence_timeout_ms  INT NOT NULL DEFAULT 1000,
    max_call_duration_s INT NOT NULL DEFAULT 3600,
    webhook_url     TEXT,
    pinecone_index  TEXT,
    metadata        JSONB,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_voice_agents_owner ON voice_agents (owner_api_key);

-- ── API Keys (tenant authentication) ─────────────────────────────────────────
CREATE TABLE api_keys (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    key_hash        TEXT UNIQUE NOT NULL,   -- SHA-256(raw_key), never store raw
    label           TEXT,
    user_id         INT REFERENCES users(id) ON DELETE CASCADE,
    rate_limit_rpm  INT NOT NULL DEFAULT 100,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    last_used_at    TIMESTAMPTZ,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── Active Calls ──────────────────────────────────────────────────────────────
CREATE TABLE voice_calls (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    agent_id        UUID NOT NULL REFERENCES voice_agents(id),
    caller_number   TEXT,
    direction       TEXT NOT NULL DEFAULT 'inbound',  -- inbound | outbound
    sip_call_id     TEXT,                              -- SIP Call-ID header
    status          TEXT NOT NULL DEFAULT 'active',    -- active | completed | failed
    started_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ended_at        TIMESTAMPTZ,
    duration_s      INT,
    barge_in_count  INT NOT NULL DEFAULT 0,
    turn_count      INT NOT NULL DEFAULT 0,
    metadata        JSONB
);

CREATE INDEX idx_voice_calls_agent ON voice_calls (agent_id, started_at DESC);
CREATE INDEX idx_voice_calls_status ON voice_calls (status) WHERE status = 'active';

-- ── Per-Turn Latency Metrics (TimescaleDB hypertable) ─────────────────────────
-- This is the hot metrics table; TimescaleDB partitions it by time automatically.
CREATE TABLE call_turn_metrics (
    id                  UUID        NOT NULL DEFAULT uuid_generate_v4(),
    call_id             UUID        NOT NULL REFERENCES voice_calls(id),
    turn_id             UUID        NOT NULL,
    end_of_speech_at    TIMESTAMPTZ NOT NULL,   -- user stops speaking
    first_token_at      TIMESTAMPTZ,            -- LLM emits first token
    first_audio_at      TIMESTAMPTZ,            -- TTS emits first audio frame
    ttfb_ms             INT,                    -- end_of_speech → first audio
    llm_latency_ms      INT,                    -- end_of_speech → first LLM token
    tts_latency_ms      INT,                    -- first token  → first audio
    stt_confidence      FLOAT,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (id, end_of_speech_at)
);

-- Convert to hypertable, partition by end_of_speech_at (7-day chunks)
SELECT create_hypertable('call_turn_metrics', 'end_of_speech_at', chunk_time_interval => INTERVAL '7 days');

-- Continuous aggregate: hourly P50/P95/P99 latency per agent
CREATE MATERIALIZED VIEW latency_hourly
WITH (timescaledb.continuous) AS
SELECT
    time_bucket('1 hour', m.end_of_speech_at)  AS bucket,
    c.agent_id,
    COUNT(*)                                    AS turns,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY m.ttfb_ms) AS p50_ms,
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.ttfb_ms) AS p95_ms,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY m.ttfb_ms) AS p99_ms,
    AVG(m.ttfb_ms)                              AS avg_ms
FROM call_turn_metrics m
JOIN voice_calls c ON c.id = m.call_id
GROUP BY bucket, c.agent_id
WITH NO DATA;

SELECT add_continuous_aggregate_policy('latency_hourly',
    start_offset => INTERVAL '2 hours',
    end_offset   => INTERVAL '1 minute',
    schedule_interval => INTERVAL '1 minute');

-- ── Full-Call Transcripts ─────────────────────────────────────────────────────
CREATE TABLE call_transcripts (
    id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id     UUID UNIQUE NOT NULL REFERENCES voice_calls(id),
    turns       JSONB NOT NULL DEFAULT '[]',   -- [{role, content, ts}]
    raw_text    TEXT,                          -- concatenated for FTS
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_transcripts_fts ON call_transcripts USING GIN (to_tsvector('english', raw_text));

-- ── Post-Call Analysis Results ────────────────────────────────────────────────
CREATE TABLE call_analysis (
    id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    call_id             UUID UNIQUE NOT NULL REFERENCES voice_calls(id),
    sentiment_score     SMALLINT CHECK (sentiment_score BETWEEN 1 AND 10),
    sentiment_label     TEXT,                          -- positive | neutral | negative
    outcome             TEXT,                          -- conversion | ftd | no_sale | callback
    entities            JSONB DEFAULT '{}',            -- {names, dates, amounts, ...}
    objections          TEXT[],
    next_action         TEXT,
    summary             TEXT,
    confidence          FLOAT,
    model_version       TEXT,
    processed_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ── SIP Channel Tracking (for Kubernetes HPA signal) ─────────────────────────
CREATE TABLE sip_channels (
    id              UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pod_id          TEXT NOT NULL,
    call_id         UUID REFERENCES voice_calls(id),
    opened_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    closed_at       TIMESTAMPTZ,
    rtp_ssrc        BIGINT
);

CREATE INDEX idx_sip_channels_active ON sip_channels (pod_id) WHERE closed_at IS NULL;

-- Convenience view: current concurrent call count by pod
CREATE VIEW active_channel_count AS
SELECT pod_id, COUNT(*) AS active_channels
FROM sip_channels
WHERE closed_at IS NULL
GROUP BY pod_id;

-- ── Retention Policy: drop raw turn metrics older than 90 days ────────────────
SELECT add_retention_policy('call_turn_metrics', INTERVAL '90 days');

-- ── Additional indexes (performance) ─────────────────────────────────────────
-- Frequently JOINed on call_id; without an index every join is a seq scan
CREATE INDEX idx_call_transcripts_call_id  ON call_transcripts (call_id);
CREATE INDEX idx_call_analysis_call_id     ON call_analysis (call_id);

-- Analytics filters often combine agent + date + status
CREATE INDEX idx_voice_calls_agent_date_status
    ON voice_calls (agent_id, started_at DESC, status);

-- FK lookup: which keys belong to a user
CREATE INDEX idx_api_keys_user_id ON api_keys (user_id);

-- ── Helper function: P95 latency for a given agent in the last N minutes ──────
CREATE OR REPLACE FUNCTION agent_p95_latency(p_agent_id UUID, p_minutes INT DEFAULT 60)
RETURNS TABLE (p95_ms FLOAT, sample_count BIGINT) AS $$
SELECT
    PERCENTILE_CONT(0.95) WITHIN GROUP (ORDER BY m.ttfb_ms)::FLOAT,
    COUNT(*)
FROM call_turn_metrics m
JOIN voice_calls c ON c.id = m.call_id
WHERE c.agent_id = p_agent_id
  AND m.end_of_speech_at > NOW() - (p_minutes || ' minutes')::INTERVAL;
$$ LANGUAGE SQL STABLE;
