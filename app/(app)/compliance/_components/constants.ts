import type { ComplianceSettings } from "@/lib/supabase/types";

export const DEFAULT_SETTINGS: Partial<ComplianceSettings> = {
  calling_hours_enabled: false,
  calling_hours_start: "09:00",
  calling_hours_end: "20:00",
  calling_days: ["mon", "tue", "wed", "thu", "fri"],
  call_recording_retention_days: 90,
  transcript_retention_days: 365,
  require_consent: false,
  consent_message: "",
  tcpa_compliance_enabled: false,
  gdpr_compliance_enabled: false,
};

export const DAYS = [
  { id: "mon", label: "Mon" },
  { id: "tue", label: "Tue" },
  { id: "wed", label: "Wed" },
  { id: "thu", label: "Thu" },
  { id: "fri", label: "Fri" },
  { id: "sat", label: "Sat" },
  { id: "sun", label: "Sun" },
];

export interface ComplianceCheck {
  label: string;
  pass: boolean;
}
