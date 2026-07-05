/** Static field-mapping data and config shape for the QAC integrations panel. */

export interface QACIntegrationConfig {
  id: string;
  webhook_token: string;
  twilio_account_sid: string | null;
  auto_analyze: boolean;
  agent_name_field: string;
  is_active: boolean;
  provider_name: string | null;
  field_mappings: Record<string, string[]> | null;
}

export const DEFAULT_FIELD_MAPPINGS: Record<string, string[]> = {
  recording_url: [
    "RecordingUrl",
    "recording_url",
    "audioUrl",
    "audio_url",
    "recordingUrl",
    "file_url",
  ],
  agent_name: [
    "agent_name",
    "To",
    "user_name",
    "extension",
    "sip_user",
    "called_number",
  ],
  customer_phone: [
    "From",
    "caller_id",
    "customer_phone",
    "ani",
    "calling_number",
  ],
  call_id: [
    "CallSid",
    "call_id",
    "callId",
    "session_id",
    "external_call_id",
    "call_uuid",
  ],
  duration: [
    "RecordingDuration",
    "duration",
    "call_duration",
    "callDuration",
    "duration_seconds",
  ],
  transcript: ["transcript", "transcription", "text", "call_transcript"],
  agent_id: ["agent_id", "user_id", "extension_id", "sip_user_id"],
  direction: ["direction", "call_direction", "callDirection", "call_type"],
  outcome: ["outcome", "call_outcome", "disposition", "hangup_cause"],
  language: ["language", "lang", "transcript_lang"],
  customer_name: ["customer_name", "contact_name", "callerName"],
};

export const PROVIDER_PRESETS: Record<string, Record<string, string[]>> = {
  twilio: {
    recording_url: ["RecordingUrl"],
    agent_name: ["To"],
    customer_phone: ["From"],
    call_id: ["CallSid"],
    duration: ["RecordingDuration"],
  },
  squaretalk: {
    recording_url: ["recording_url", "audio_url", "file_url"],
    agent_name: ["agent_name", "user_name", "extension"],
    customer_phone: ["caller_id", "from_number", "ani"],
    call_id: ["call_id", "call_uuid", "session_id"],
    duration: ["duration", "call_duration"],
    direction: ["direction", "call_type"],
    outcome: ["outcome", "disposition"],
  },
  voiso: {
    recording_url: ["recording_url", "audioUrl", "recordingUrl"],
    agent_name: ["agent", "agent_name", "operator"],
    customer_phone: ["customer_phone", "caller", "from"],
    call_id: ["call_id", "callId"],
    duration: ["duration", "billsec"],
    direction: ["direction"],
    outcome: ["disposition", "outcome"],
  },
  genesys: {
    recording_url: ["mediaUrl", "recording_url"],
    agent_name: ["participantName", "agentName", "agent_name"],
    customer_phone: ["ani", "caller_id", "from"],
    call_id: ["conversationId", "call_id"],
    duration: ["duration", "talkTime"],
    direction: ["direction"],
    outcome: ["wrapUpCode", "disposition"],
  },
};
