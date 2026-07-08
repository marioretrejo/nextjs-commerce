// Local, loosely-typed call shape for the QA Center v2 panels. Decoupled from
// the global Call interface so the UI is robust to schema differences — the
// /api/calls endpoint returns sanitized rows with these fields.

export interface QaCall {
  id: string;
  contact_name: string | null;
  contact_phone: string | null;
  department: string | null;
  duration_seconds: number;
  created_at: string;
  analysis_status: string | null;
  qa_score: number | null;
  qa_feedback: string | null;
  qa_details: QaDetails | null;
  sentiment: string | null;
  disposition: string | null;
  recording_url: string | null;
  recording_storage_path: string | null;
  transcript: string | null;
  external_source: string | null;
  external_agent_name: string | null;
  qa_journey_id: string | null;
  agent?: { name: string } | null;
}

export interface QaDetails {
  overall?: number;
  feedback?: string;
  scores?: Array<{ name: string; score: number }>;
  strengths?: string[];
  weaknesses?: string[];
  opportunities?: string[];
  recommendations?: string[];
  criteria_count?: number;
}

export function agentName(call: QaCall): string {
  return call.agent?.name ?? call.external_agent_name ?? "—";
}

export function formatDuration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds || 0));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${String(m).padStart(2, "0")}:${String(rem).padStart(2, "0")}`;
}
