// ─── Normalized external call ─────────────────────────────────────────────────
// The single internal shape every provider payload is converted into before it
// is imported into the `calls` table.

export type NormalizedCallType = "inbound" | "outbound";

export interface NormalizedExternalCall {
  external_call_id: string;
  provider: string;
  agent_name?: string;
  duration_seconds?: number;
  department?: string;
  timestamp?: string;
  prospect_id?: string;
  crm_id?: string;
  recording_url?: string;
  recording_base64?: string;
  transcript?: string;
  call_type?: NormalizedCallType;
  extension?: string;
  contact_name?: string;
  contact_phone?: string;
  raw_payload: unknown;
}

// A field map lists candidate source keys (checked in order) for each target
// field. Keys are matched case-insensitively against the flattened payload.
export type NormalizedField = keyof Omit<
  NormalizedExternalCall,
  "provider" | "raw_payload"
>;

export type FieldMap = Partial<Record<NormalizedField, string[]>>;
