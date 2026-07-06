import type { NotificationType } from "@/lib/supabase/types";

export const TIMEZONES = [
  "UTC",
  "America/New_York",
  "America/Chicago",
  "America/Denver",
  "America/Los_Angeles",
  "America/Sao_Paulo",
  "Europe/London",
  "Europe/Paris",
  "Europe/Berlin",
  "Europe/Madrid",
  "Asia/Dubai",
  "Asia/Kolkata",
  "Asia/Singapore",
  "Asia/Tokyo",
  "Australia/Sydney",
];

export const LANGUAGES = [
  { code: "en", label: "English" },
  { code: "es", label: "Spanish" },
  { code: "fr", label: "French" },
  { code: "de", label: "German" },
  { code: "pt", label: "Portuguese" },
  { code: "it", label: "Italian" },
];

export const NOTIFICATION_TYPES: {
  type: NotificationType;
  label: string;
  description: string;
}[] = [
  {
    type: "minutes_80",
    label: "80% minutes used",
    description: "Alert when usage reaches 80% of limit.",
  },
  {
    type: "minutes_100",
    label: "100% minutes used",
    description: "Alert when all minutes are consumed.",
  },
  {
    type: "campaign_completed",
    label: "Campaign completed",
    description: "Notify when a campaign finishes.",
  },
  {
    type: "contact_converted",
    label: "Contact converted",
    description: "Notify on each conversion.",
  },
  {
    type: "qa_alert",
    label: "QA score alert",
    description: "Alert when a call scores below threshold.",
  },
  {
    type: "team_invite",
    label: "Team invitations",
    description: "Notify when someone joins the workspace.",
  },
  {
    type: "payment_failed",
    label: "Payment failed",
    description: "Critical billing failure alerts.",
  },
];

export interface ProfileForm {
  name: string;
  company: string;
  timezone: string;
  language: string;
}

export interface PasswordForm {
  current: string;
  next: string;
  confirm: string;
}
