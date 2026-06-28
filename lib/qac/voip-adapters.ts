/**
 * lib/qac/voip-adapters.ts
 *
 * Provider-agnostic VoIP adapter pattern for QA Center External Ingestion.
 *
 * Each VoipProviderAdapter normalizes a raw (flattened) provider payload into
 * NormalizedExternalCall. The GenericAdapter preserves full backward compatibility
 * with the field-mapping engine used for Twilio, Voiso, Genesys, and any
 * provider configured via the workspace Integrations UI.
 *
 * To add a new provider:
 *   1. Implement VoipProviderAdapter
 *   2. Register it in ADAPTERS with the lowercase provider name as key
 *   3. Set integration.provider_name to that key in the QA Center UI
 */

// ─── Normalized output ────────────────────────────────────────────────────────

export interface NormalizedExternalCall {
  provider: string;
  external_call_id: string | null;
  direction: "inbound" | "outbound" | null;
  agent_name: string | null;
  agent_id: string | null;
  agent_extension: string | null;
  agent_email: string | null;
  department_name: string | null;
  customer_phone: string | null;
  customer_name: string | null;
  started_at: string | null;
  duration_seconds: number | null;
  talk_time_seconds: number | null;
  recording_url: string | null;
  recording_type: string | null;
  transcript: string | null;
  disposition: string | null;
  language: string;
  unit_id: string | null;
  unit_org_id: string | null;
}

// ─── Adapter interface ────────────────────────────────────────────────────────

export interface VoipProviderAdapter {
  readonly providerName: string;
  /**
   * Normalizes a flattened provider payload.
   * @param payload       Already-flattened via flattenPayload()
   * @param fieldMappings Workspace-level overrides (from qac_integrations.field_mappings)
   */
  normalize(
    payload: Record<string, unknown>,
    fieldMappings: Record<string, string[]> | null,
  ): NormalizedExternalCall;
}

// ─── Payload utilities ────────────────────────────────────────────────────────

const SENSITIVE_FRAGMENTS = [
  "apikey",
  "accesstoken",
  "authtoken",
  "secret",
  "clientsecret",
  "password",
  "passwd",
  "pwd",
  "authorization",
  "bearer",
];

/** Strip keys containing sensitive patterns (case-insensitive, separator-agnostic). */
export function sanitizePayload(
  raw: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(raw)) {
    const kl = k.toLowerCase().replace(/[-_. ]/g, "");
    const isSensitive = SENSITIVE_FRAGMENTS.some((p) => kl.includes(p));
    if (isSensitive) continue;
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      result[k] = sanitizePayload(v as Record<string, unknown>);
    } else {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Flatten a nested object one level deep so "metadata.recording_url" is
 * accessible alongside top-level keys. Top-level keys always win.
 */
export function flattenPayload(raw: unknown): Record<string, unknown> {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return {};

  const flat: Record<string, unknown> = { ...(raw as Record<string, unknown>) };

  for (const [k, v] of Object.entries(flat)) {
    if (typeof v === "object" && v !== null && !Array.isArray(v)) {
      for (const [nk, nv] of Object.entries(v as Record<string, unknown>)) {
        flat[`${k}.${nk}`] = nv;
        if (!(nk in flat)) flat[nk] = nv;
      }
    }
  }

  return flat;
}

// ─── Field extraction engine (used by GenericAdapter) ────────────────────────

export const DEFAULT_MAPPINGS: Record<string, string[]> = {
  recording_url: [
    "RecordingUrl",
    "recording_url",
    "audioUrl",
    "audio_url",
    "recordingUrl",
    "file_url",
    "mp3_url",
    "wav_url",
  ],
  agent_name: [
    "agent_name",
    "To",
    "user_name",
    "extension",
    "sip_user",
    "called_number",
    "callee",
    "agent",
    "dst",
  ],
  customer_phone: [
    "From",
    "caller_id",
    "customer_phone",
    "ani",
    "calling_number",
    "callerNumber",
    "src",
    "clid",
  ],
  call_id: [
    "CallSid",
    "call_id",
    "callId",
    "session_id",
    "external_call_id",
    "call_uuid",
    "uniqueid",
    "id",
  ],
  duration: [
    "RecordingDuration",
    "duration",
    "call_duration",
    "callDuration",
    "duration_seconds",
    "length",
    "billsec",
  ],
  transcript: [
    "transcript",
    "transcription",
    "text",
    "call_transcript",
    "body",
  ],
  agent_id: [
    "agent_id",
    "user_id",
    "extension_id",
    "sip_user_id",
    "agent_ext",
    "operator_id",
  ],
  direction: [
    "direction",
    "call_direction",
    "callDirection",
    "call_type",
    "type",
  ],
  outcome: [
    "outcome",
    "call_outcome",
    "disposition",
    "hangup_cause",
    "status",
    "lastapp",
  ],
  language: ["language", "lang", "transcript_lang", "locale"],
  customer_name: [
    "customer_name",
    "contact_name",
    "callerName",
    "caller_name",
    "customer",
  ],
};

export function extract(
  payload: Record<string, unknown>,
  field: string,
  customMappings: Record<string, string[]> | null,
): string | null {
  const defaults = DEFAULT_MAPPINGS[field] ?? [];
  const custom = customMappings?.[field] ?? [];
  const candidates = custom.length > 0 ? [...custom, ...defaults] : defaults;

  for (const key of candidates) {
    const val = payload[key];
    if (val !== undefined && val !== null && String(val).trim() !== "") {
      return String(val).trim();
    }
    const lower = key.toLowerCase();
    for (const [k, v] of Object.entries(payload)) {
      if (
        k.toLowerCase() === lower &&
        v !== undefined &&
        v !== null &&
        String(v).trim() !== ""
      ) {
        return String(v).trim();
      }
    }
  }

  return null;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function normalizeDirection(raw: string | null): "inbound" | "outbound" | null {
  if (!raw) return null;
  const d = raw.toLowerCase();
  if (d.includes("out") || d === "egress") return "outbound";
  if (d.includes("in") || d === "ingress") return "inbound";
  return null;
}

function str(payload: Record<string, unknown>, key: string): string | null {
  const v = payload[key];
  if (v === undefined || v === null) return null;
  const s = String(v).trim();
  return s === "" ? null : s;
}

function num(payload: Record<string, unknown>, key: string): number | null {
  const v = payload[key];
  if (v === undefined || v === null) return null;
  const n = Number(v);
  return isNaN(n) ? null : n;
}

// ─── GenericAdapter ───────────────────────────────────────────────────────────
// Backward-compatible: wraps the field-mapping engine for Twilio, Voiso,
// Genesys, and any provider configured via workspace field mappings.

class GenericAdapter implements VoipProviderAdapter {
  readonly providerName = "generic";

  normalize(
    payload: Record<string, unknown>,
    fieldMappings: Record<string, string[]> | null,
  ): NormalizedExternalCall {
    const callId = extract(payload, "call_id", fieldMappings);
    const direction = extract(payload, "direction", fieldMappings);
    const duration = extract(payload, "duration", fieldMappings);

    return {
      provider: this.providerName,
      external_call_id: callId,
      direction: normalizeDirection(direction),
      agent_name: extract(payload, "agent_name", fieldMappings),
      agent_id: extract(payload, "agent_id", fieldMappings),
      agent_extension: null,
      agent_email: null,
      department_name: null,
      customer_phone: extract(payload, "customer_phone", fieldMappings),
      customer_name: extract(payload, "customer_name", fieldMappings),
      started_at: null,
      duration_seconds: duration != null ? Number(duration) || null : null,
      talk_time_seconds: null,
      recording_url: extract(payload, "recording_url", fieldMappings),
      recording_type: null,
      transcript: extract(payload, "transcript", fieldMappings),
      disposition: extract(payload, "outcome", fieldMappings),
      language: extract(payload, "language", fieldMappings) ?? "en",
      unit_id: null,
      unit_org_id: null,
    };
  }
}

// ─── SquaretalkAdapter ────────────────────────────────────────────────────────
// Maps Squaretalk's nested metadata payload to NormalizedExternalCall.
//
// After flattenPayload(), Squaretalk's metadata.xxx fields are hoisted to the
// top level, so they can be accessed directly by key name:
//
//   external_interaction_id → external_call_id
//   user_id                 → agent_name + agent_id
//   extension (from metadata) → agent_extension + agent_id (stable)
//   agent_type (from metadata) → department_name
//   prospect_id             → customer_phone
//   download_url            → recording_url (preferred)
//   __external_interaction_url (from metadata) → recording_url (fallback)
//   call_type (from metadata) → direction
//   call_date_utc (from metadata) → started_at
//   talk_time_sec (from metadata) → talk_time_seconds
//   total_duration_sec (from metadata) → duration_seconds
//   unit_id / unit_org_id   → stored in metadata column

class SquaretalkAdapter implements VoipProviderAdapter {
  readonly providerName = "squaretalk";

  normalize(
    payload: Record<string, unknown>,
    _fieldMappings: Record<string, string[]> | null,
  ): NormalizedExternalCall {
    const extension = str(payload, "extension");
    const recordingUrl =
      str(payload, "download_url") ??
      str(payload, "__external_interaction_url") ??
      str(payload, "metadata.__external_interaction_url");

    return {
      provider: this.providerName,
      external_call_id: str(payload, "external_interaction_id"),
      direction: normalizeDirection(str(payload, "call_type")),
      agent_name: str(payload, "user_id"),
      agent_id: extension ?? str(payload, "user_id"), // extension is more stable
      agent_extension: extension,
      agent_email: null,
      department_name: str(payload, "agent_type"),
      customer_phone: str(payload, "prospect_id"),
      customer_name: null,
      started_at: str(payload, "call_date_utc") ?? str(payload, "timestamp"),
      duration_seconds: num(payload, "total_duration_sec"),
      talk_time_seconds: num(payload, "talk_time_sec"),
      recording_url: recordingUrl,
      recording_type: str(payload, "recording_type"),
      transcript: null, // Squaretalk does not provide transcripts in the webhook
      disposition: null,
      language: "en",
      unit_id: str(payload, "unit_id"),
      unit_org_id: str(payload, "unit_org_id"),
    };
  }
}

// ─── Registry ─────────────────────────────────────────────────────────────────

const ADAPTERS: Record<string, VoipProviderAdapter> = {
  generic: new GenericAdapter(),
  squaretalk: new SquaretalkAdapter(),
};

/**
 * Returns the adapter for the given provider name.
 * Falls back to GenericAdapter for unknown or null provider names.
 */
export function getAdapter(providerName: string | null): VoipProviderAdapter {
  if (providerName) {
    const key = providerName.toLowerCase().trim();
    const adapter = ADAPTERS[key];
    if (adapter) return adapter;
  }
  return ADAPTERS["generic"]!;
}
