import { buildNormalized } from "./base";
import type { NormalizedExternalCall, FieldMap } from "../types";

// Voiso webhook field names, overlaid on the canonical map.
const VOISO_MAP: FieldMap = {
  external_call_id: ["call_id", "session_id", "uuid"],
  agent_name: ["agent_name", "agent", "operator"],
  duration_seconds: ["talk_time", "duration", "call_duration"],
  department: ["queue", "campaign", "ring_group"],
  timestamp: ["start_time", "connected_at", "date"],
  recording_url: ["recording_url", "record_url"],
  call_type: ["direction", "call_direction"],
  extension: ["agent_extension", "extension"],
  contact_phone: ["customer_number", "phone", "from", "to"],
  contact_name: ["customer_name", "contact_name"],
};

export function normalizeVoiso(payload: unknown): NormalizedExternalCall {
  return buildNormalized("voiso", payload, VOISO_MAP);
}
