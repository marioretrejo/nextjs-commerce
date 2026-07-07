import type {
  NormalizedExternalCall,
  NormalizedCallType,
  FieldMap,
} from "../types";

// Flatten a (possibly nested) payload into a single-level map keyed by the
// lower-cased leaf key. Nested `a.b` also gets a lower-cased dotted key so maps
// can target either the leaf name or the full path. Arrays are left as-is.
export function flattenPayload(
  input: unknown,
  prefix = "",
  out: Record<string, unknown> = {},
): Record<string, unknown> {
  if (!input || typeof input !== "object") return out;
  for (const [key, value] of Object.entries(input as Record<string, unknown>)) {
    const dotted = prefix ? `${prefix}.${key}` : key;
    if (value && typeof value === "object" && !Array.isArray(value)) {
      // Record both the leaf key and the dotted path
      out[key.toLowerCase()] = value;
      out[dotted.toLowerCase()] = value;
      flattenPayload(value, dotted, out);
    } else {
      if (out[key.toLowerCase()] === undefined) out[key.toLowerCase()] = value;
      out[dotted.toLowerCase()] = value;
    }
  }
  return out;
}

function firstDefined(
  flat: Record<string, unknown>,
  keys: string[] | undefined,
): unknown {
  if (!keys) return undefined;
  for (const k of keys) {
    const v = flat[k.toLowerCase()];
    if (v !== undefined && v !== null && v !== "") return v;
  }
  return undefined;
}

export function pickString(
  flat: Record<string, unknown>,
  keys: string[] | undefined,
): string | undefined {
  const v = firstDefined(flat, keys);
  if (v === undefined) return undefined;
  const s = String(v).trim();
  return s.length > 0 ? s : undefined;
}

export function pickNumber(
  flat: Record<string, unknown>,
  keys: string[] | undefined,
): number | undefined {
  const v = firstDefined(flat, keys);
  if (v === undefined) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

export function normalizeCallType(
  raw: string | undefined,
): NormalizedCallType | undefined {
  if (!raw) return undefined;
  const s = raw.toLowerCase();
  if (s.includes("in")) return "inbound";
  if (s.includes("out")) return "outbound";
  return undefined;
}

// Candidate keys that apply to every provider (the canonical / n8n field names).
// Provider-specific maps are merged ON TOP of these, taking precedence.
const CANONICAL_MAP: FieldMap = {
  external_call_id: ["call_id", "external_call_id", "id", "uniqueid", "uuid"],
  agent_name: ["agent_name", "agent", "agentname", "user_name"],
  duration_seconds: [
    "duration_seconds",
    "duration",
    "call_duration",
    "billsec",
  ],
  department: ["department", "team", "queue", "group"],
  timestamp: ["timestamp", "started_at", "start_time", "call_time", "date"],
  prospect_id: ["prospect_id", "lead_id", "contact_id"],
  crm_id: ["crm_id", "unit_id", "deal_id"],
  recording_url: ["recording_url", "recording", "record_url", "audio_url"],
  recording_base64: ["recording_base64", "audio_base64", "recording_data"],
  transcript: ["transcript", "transcription", "text"],
  call_type: ["call_type", "direction", "type"],
  extension: ["extension", "ext", "agent_extension"],
  contact_name: ["contact_name", "customer_name", "caller_name", "name"],
  contact_phone: [
    "contact_phone",
    "phone",
    "caller_id",
    "caller_id_number",
    "customer_phone",
    "from",
    "to",
  ],
};

// Build a NormalizedExternalCall from a raw payload using a provider field map
// merged over the canonical defaults. external_call_id may be "" — the caller
// (webhook route) validates it and rejects empties.
export function buildNormalized(
  provider: string,
  payload: unknown,
  providerMap: FieldMap = {},
): NormalizedExternalCall {
  const flat = flattenPayload(payload);
  const merge = (field: keyof FieldMap): string[] => [
    ...(providerMap[field] ?? []),
    ...(CANONICAL_MAP[field] ?? []),
  ];

  return {
    provider,
    external_call_id: pickString(flat, merge("external_call_id")) ?? "",
    agent_name: pickString(flat, merge("agent_name")),
    duration_seconds: pickNumber(flat, merge("duration_seconds")),
    department: pickString(flat, merge("department")),
    timestamp: pickString(flat, merge("timestamp")),
    prospect_id: pickString(flat, merge("prospect_id")),
    crm_id: pickString(flat, merge("crm_id")),
    recording_url: pickString(flat, merge("recording_url")),
    recording_base64: pickString(flat, merge("recording_base64")),
    transcript: pickString(flat, merge("transcript")),
    call_type: normalizeCallType(pickString(flat, merge("call_type"))),
    extension: pickString(flat, merge("extension")),
    contact_name: pickString(flat, merge("contact_name")),
    contact_phone: pickString(flat, merge("contact_phone")),
    raw_payload: payload,
  };
}
