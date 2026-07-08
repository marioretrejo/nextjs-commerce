import type { JsonRecord, NormalizedCdrCall, QacProviderType } from "./types";

export interface CdrAdapterContext {
  providerSlug: string;
  mappings?: Record<string, string[]> | null;
}

export interface CdrProviderAdapter {
  readonly type: QacProviderType;
  normalize(payload: unknown, context: CdrAdapterContext): NormalizedCdrCall;
}

const SENSITIVE_KEY_PARTS = [
  "apikey",
  "api_key",
  "token",
  "secret",
  "password",
  "authorization",
  "auth",
  "bearer",
];

const DEFAULT_MAPPINGS: Record<string, string[]> = {
  external_call_id: [
    "external_call_id",
    "call_id",
    "callId",
    "CallSid",
    "id",
    "uuid",
    "uniqueid",
    "recording_id",
    "interaction_id",
  ],
  agent_name: [
    "agent_name",
    "agent.name",
    "agent",
    "user_name",
    "user.name",
    "operator_name",
    "To",
    "callee",
  ],
  agent_extension: [
    "agent_extension",
    "extension",
    "agent.extension",
    "user.extension",
    "agent_ext",
    "sip_user",
  ],
  external_agent_id: [
    "external_agent_id",
    "agent_id",
    "agent.id",
    "user_id",
    "user.id",
    "operator_id",
  ],
  agent_email: ["agent_email", "agent.email", "user_email", "user.email"],
  department_name: [
    "department_name",
    "department",
    "unit_id",
    "team",
    "queue",
    "queue_name",
    "agent_type",
    "agent_department",
    "metadata.agent_department",
  ],
  caller_id: [
    "caller_id",
    "customer_phone",
    "phone",
    "From",
    "ani",
    "src",
    "clid",
    "caller.number",
  ],
  prospect_id: ["prospect_id", "prospectId", "lead_id", "contact_id"],
  recording_url: [
    "recording_url",
    "RecordingUrl",
    "recordingUrl",
    "audio_url",
    "audioUrl",
    "download_url",
    "__external_interaction_url",
    "external_interaction_url",
    "file_url",
    "media.url",
  ],
  recording_base64: ["recording_base64", "recordingBase64", "audio_base64"],
  transcript: ["transcript", "transcription", "text", "call_transcript"],
  duration_seconds: [
    "duration_seconds",
    "duration",
    "duration_sec",
    "total_duration_sec",
    "call_duration",
    "RecordingDuration",
    "billsec",
  ],
  direction: ["direction", "call_direction", "callDirection", "call_type"],
  disposition: ["disposition", "status", "call_status", "outcome", "result"],
  call_started_at: [
    "call_started_at",
    "started_at",
    "start_time",
    "timestamp",
    "call_date_utc",
    "created_at",
  ],
  call_ended_at: ["call_ended_at", "ended_at", "end_time"],
};

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function sanitizePayload(payload: unknown): JsonRecord {
  if (!isRecord(payload)) return {};
  const clean: JsonRecord = {};

  for (const [key, value] of Object.entries(payload)) {
    const normalizedKey = key.toLowerCase().replace(/[-_\s.]/g, "");
    if (SENSITIVE_KEY_PARTS.some((part) => normalizedKey.includes(part))) {
      continue;
    }
    clean[key] = isRecord(value) ? sanitizePayload(value) : value;
  }

  return clean;
}

export function flattenPayload(payload: unknown): JsonRecord {
  if (!isRecord(payload)) return {};
  const flat: JsonRecord = {};

  function walk(value: unknown, prefix = "") {
    if (!isRecord(value)) return;
    for (const [key, entry] of Object.entries(value)) {
      const path = prefix ? `${prefix}.${key}` : key;
      flat[path] = entry;
      if (!(key in flat)) flat[key] = entry;
      if (isRecord(entry)) walk(entry, path);
    }
  }

  walk(payload);
  return flat;
}

function readString(
  flat: JsonRecord,
  field: keyof typeof DEFAULT_MAPPINGS,
  mappings: Record<string, string[]> | null | undefined,
): string | null {
  const candidates = [
    ...(mappings?.[field] ?? []),
    ...(DEFAULT_MAPPINGS[field] ?? []),
  ];

  for (const candidate of candidates) {
    const direct = flat[candidate];
    if (direct !== undefined && direct !== null && String(direct).trim()) {
      return String(direct).trim();
    }
    const lower = candidate.toLowerCase();
    const match = Object.entries(flat).find(
      ([key, value]) =>
        key.toLowerCase() === lower &&
        value !== undefined &&
        value !== null &&
        String(value).trim(),
    );
    if (match) return String(match[1]).trim();
  }

  return null;
}

function readNumber(
  flat: JsonRecord,
  field: keyof typeof DEFAULT_MAPPINGS,
  mappings?: Record<string, string[]> | null,
): number | null {
  const raw = readString(flat, field, mappings);
  if (!raw) return null;
  const n = Number(raw);
  return Number.isFinite(n) ? Math.max(0, Math.round(n)) : null;
}

function normalizeDirection(
  value: string | null,
): NormalizedCdrCall["direction"] {
  if (!value) return null;
  const raw = value.toLowerCase();
  if (raw.includes("out") || raw === "egress") return "outbound";
  if (raw.includes("in") || raw === "ingress") return "inbound";
  if (raw.includes("internal")) return "internal";
  return "unknown";
}

function cleanString(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function cleanUrl(value: unknown): string | null {
  const url = cleanString(value);
  return url && /^https?:\/\//i.test(url) ? url : null;
}

function normalizeGeneric(
  payload: unknown,
  context: CdrAdapterContext,
): NormalizedCdrCall {
  const raw_payload = sanitizePayload(payload);
  const flat = flattenPayload(raw_payload);
  const mappings = context.mappings;

  return {
    provider: context.providerSlug,
    external_call_id: readString(flat, "external_call_id", mappings),
    agent_name: readString(flat, "agent_name", mappings),
    agent_extension: readString(flat, "agent_extension", mappings),
    external_agent_id: readString(flat, "external_agent_id", mappings),
    agent_email: readString(flat, "agent_email", mappings),
    department_name: readString(flat, "department_name", mappings),
    caller_id: readString(flat, "caller_id", mappings),
    prospect_id: readString(flat, "prospect_id", mappings),
    recording_url: readString(flat, "recording_url", mappings),
    recording_base64: readString(flat, "recording_base64", mappings),
    transcript: readString(flat, "transcript", mappings),
    duration_seconds: readNumber(flat, "duration_seconds", mappings),
    direction: normalizeDirection(readString(flat, "direction", mappings)),
    disposition: readString(flat, "disposition", mappings),
    call_started_at: readString(flat, "call_started_at", mappings),
    call_ended_at: readString(flat, "call_ended_at", mappings),
    raw_payload,
  };
}

const genericAdapter: CdrProviderAdapter = {
  type: "generic",
  normalize: normalizeGeneric,
};

const squaretalkAdapter: CdrProviderAdapter = {
  type: "squaretalk",
  normalize(payload, context) {
    const base = normalizeGeneric(payload, context);
    const flat = flattenPayload(base.raw_payload);
    return {
      ...base,
      external_call_id:
        readString(flat, "external_call_id", {
          external_call_id: ["external_interaction_id", "interaction_id"],
        }) ?? base.external_call_id,
      agent_name:
        cleanString(flat["agent_name"]) ??
        cleanString(flat["user_id"]) ??
        base.agent_name,
      agent_extension: cleanString(flat["extension"]) ?? base.agent_extension,
      external_agent_id:
        cleanString(flat["extension"]) ??
        cleanString(flat["user_id"]) ??
        base.external_agent_id,
      department_name:
        cleanString(flat["agent_type"]) ??
        cleanString(flat["agent_department"]) ??
        cleanString(flat["unit_id"]) ??
        cleanString(flat["department"]) ??
        base.department_name,
      prospect_id:
        cleanString(flat["prospect_id"]) ??
        cleanString(flat["destination"]) ??
        base.prospect_id,
      caller_id:
        cleanString(flat["prospect_id"]) ??
        cleanString(flat["destination"]) ??
        base.caller_id,
      recording_url:
        cleanUrl(flat["download_url"]) ??
        cleanUrl(flat["__external_interaction_url"]) ??
        cleanUrl(flat["external_interaction_url"]) ??
        cleanUrl(flat["recording_file"]) ??
        base.recording_url,
      duration_seconds:
        Number(flat["total_duration_sec"] ?? base.duration_seconds) || null,
      direction: normalizeDirection(
        cleanString(flat["call_type"]) ?? base.direction,
      ),
      call_started_at:
        cleanString(flat["call_date_utc"]) ?? base.call_started_at ?? null,
    };
  },
};

const twilioAdapter: CdrProviderAdapter = {
  type: "twilio",
  normalize: normalizeGeneric,
};

const aircallAdapter: CdrProviderAdapter = {
  type: "aircall",
  normalize: normalizeGeneric,
};

const ringCentralAdapter: CdrProviderAdapter = {
  type: "ringcentral",
  normalize: normalizeGeneric,
};

const ADAPTERS: Record<QacProviderType, CdrProviderAdapter> = {
  squaretalk: squaretalkAdapter,
  twilio: twilioAdapter,
  aircall: aircallAdapter,
  ringcentral: ringCentralAdapter,
  generic: genericAdapter,
};

export function getCdrAdapter(
  type: string | null | undefined,
): CdrProviderAdapter {
  const normalized = (type ?? "generic").toLowerCase();
  return ADAPTERS[normalized as QacProviderType] ?? genericAdapter;
}
