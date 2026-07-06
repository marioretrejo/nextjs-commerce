/** Types for the campaign detail page. */

export interface Campaign {
  id: string;
  name: string;
  status: string;
  agent_id: string | null;
  total_contacts: number;
  completed_contacts: number;
  converted_contacts: number;
  max_concurrency: number;
  max_retries: number;
  start_at: string | null;
  workspace_id: string;
  agent?: { name: string } | null;
}

export interface Contact {
  id: string;
  name: string | null;
  phone: string;
  email: string | null;
  status: string;
  attempts: number;
  last_called_at: string | null;
  call_id: string | null;
  variables: Record<string, unknown> | null;
}

// ── Status config ──────────────────────────────────────────────────────────────

export const STATUS_META: Record<
  string,
  { label: string; color: string; bar: string }
> = {
  converted: {
    label: "Interested",
    color: "bg-emerald-50 text-emerald-700",
    bar: "bg-emerald-500",
  },
  rejected: {
    label: "Not Interested",
    color: "bg-amber-50 text-amber-700",
    bar: "bg-amber-400",
  },
  no_answer: {
    label: "No Answer",
    color: "bg-yellow-50 text-yellow-700",
    bar: "bg-yellow-400",
  },
  voicemail: {
    label: "Voicemail",
    color: "bg-slate-100 text-slate-600",
    bar: "bg-slate-400",
  },
  invalid: {
    label: "Wrong Number",
    color: "bg-pink-50 text-pink-700",
    bar: "bg-pink-400",
  },
  max_attempts: {
    label: "Max Attempts",
    color: "bg-red-50 text-red-700",
    bar: "bg-red-500",
  },
  calling: {
    label: "In Progress",
    color: "bg-blue-50 text-blue-700",
    bar: "bg-blue-500",
  },
  pending: {
    label: "Pending Retry",
    color: "bg-[#f5f5f5] text-[#6b6b6b]",
    bar: "bg-[#d0d0d0]",
  },
};

export const BAR_ORDER = [
  "converted",
  "rejected",
  "no_answer",
  "voicemail",
  "invalid",
  "max_attempts",
  "calling",
  "pending",
];

// ── Helpers ───────────────────────────────────────────────────────────────────
