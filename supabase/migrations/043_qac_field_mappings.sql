-- Migration 043: QAC integration field mappings
-- Allows each workspace to map provider-specific payload fields to VoiceOS fields.
-- field_mappings is a JSONB object: { "voiceos_field": ["candidate1", "candidate2", ...] }

ALTER TABLE qac_integrations
  ADD COLUMN IF NOT EXISTS field_mappings JSONB NOT NULL DEFAULT '{}',
  ADD COLUMN IF NOT EXISTS provider_name  TEXT;

-- Seed the default Twilio mappings so existing integrations work without any user action
UPDATE qac_integrations
SET field_mappings = '{
  "recording_url":   ["RecordingUrl",      "recording_url",    "audioUrl",        "audio_url",      "recordingUrl",     "file_url"],
  "agent_name":      ["agent_name",        "To",               "user_name",       "extension",      "sip_user",         "called_number"],
  "customer_phone":  ["From",              "caller_id",        "customer_phone",  "ani",            "calling_number",   "callerNumber"],
  "call_id":         ["CallSid",           "call_id",          "callId",          "session_id",     "external_call_id", "call_uuid"],
  "duration":        ["RecordingDuration", "duration",         "call_duration",   "callDuration",   "duration_seconds", "length"],
  "transcript":      ["transcript",        "transcription",    "text",            "call_transcript"],
  "agent_id":        ["agent_id",          "user_id",          "extension_id",    "sip_user_id",    "agent_ext"],
  "direction":       ["direction",         "call_direction",   "callDirection",   "call_type"],
  "outcome":         ["outcome",           "call_outcome",     "disposition",     "hangup_cause"],
  "language":        ["language",          "lang",             "transcript_lang", "locale"],
  "customer_name":   ["customer_name",     "contact_name",     "callerName",      "caller_name"]
}'::jsonb
WHERE field_mappings = '{}'::jsonb;
