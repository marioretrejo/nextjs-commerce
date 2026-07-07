import { buildNormalized } from "./base";
import type { NormalizedExternalCall, FieldMap } from "../types";

// Squaretalk (Asterisk-derived) CDR field names, overlaid on the canonical map.
const SQUARETALK_MAP: FieldMap = {
  external_call_id: ["uniqueid", "linkedid", "callid"],
  agent_name: ["agent", "src_name", "cnam"],
  duration_seconds: ["billsec", "duration"],
  department: ["queue", "did_description"],
  timestamp: ["calldate", "start"],
  recording_url: ["recordingfile", "recording", "monitor_filename"],
  call_type: ["direction", "calltype", "dcontext"],
  extension: ["src", "exten"],
  contact_phone: ["dst", "clid", "caller_id_number"],
};

export function normalizeSquaretalk(payload: unknown): NormalizedExternalCall {
  return buildNormalized("squaretalk", payload, SQUARETALK_MAP);
}
