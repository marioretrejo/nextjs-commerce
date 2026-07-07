// ─── Integration type ─────────────────────────────────────────────────────────

export interface QACIntegration {
  id: string;
  workspace_id: string;
  twilio_account_sid: string | null;
  twilio_auth_token: string | null;
  auto_analyze: boolean;
  agent_name_field: string;
  is_active: boolean;
  field_mappings: Record<string, string[]> | null;
  provider_name: string | null;
}

// ─── Diarization types ───────────────────────────────────────────────────────

export interface DeepgramUtterance {
  speaker: number;
  start: number;
  end: number;
  confidence: number;
  transcript: string;
}

export interface DeepgramResponse {
  results?: {
    channels?: Array<{ alternatives?: Array<{ transcript?: string }> }>;
    utterances?: DeepgramUtterance[];
  };
}

export interface DiarizedTranscript {
  provider: "deepgram";
  model: "nova-3";
  language: string;
  utterances: Array<{
    speaker: string;
    speaker_type: "unknown";
    text: string;
    start_ms: number;
    end_ms: number;
    confidence: number;
  }>;
}
