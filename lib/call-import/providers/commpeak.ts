import { buildNormalized } from "./base";
import type { NormalizedExternalCall, FieldMap } from "../types";

// CommPeak Dialer webhook field names, overlaid on the canonical map.
const COMMPEAK_MAP: FieldMap = {
  external_call_id: ["call_id", "cdr_id", "unique_id"],
  agent_name: ["agent_name", "agent", "operator_name"],
  duration_seconds: ["talk_duration", "duration", "billsec"],
  department: ["campaign_name", "queue", "team"],
  timestamp: ["call_date", "start_time"],
  prospect_id: ["lead_id", "prospect_id"],
  recording_url: ["recording_url", "record_file"],
  call_type: ["direction", "call_type"],
  extension: ["extension", "agent_ext"],
  contact_phone: ["phone", "lead_phone", "destination"],
  contact_name: ["lead_name", "contact_name"],
};

export function normalizeCommpeak(payload: unknown): NormalizedExternalCall {
  return buildNormalized("commpeak", payload, COMMPEAK_MAP);
}
