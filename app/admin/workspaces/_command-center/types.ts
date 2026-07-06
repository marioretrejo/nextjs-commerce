/** Types + constants for the workspace command center. */

export const ABUSE_THRESHOLD = 100; // 429 rejections per hour to flag

export interface WorkspaceRow {
  id: string;
  name: string;
  plan: string;
  minutes_used: number;
  minutes_limit: number;
  is_suspended: boolean;
  suspended_reason: string | null;
  suspended_at: string | null;
  active_calls: number;
  concurrent_calls_limit: number;
  created_at: string;
  owner: { id: string; name: string; email: string } | null;
  flags: { flag: string; enabled: boolean; value: unknown }[];
  // Enterprise billing (migration 020)
  minute_cap?: number | null;
  billing_status?: "active" | "suspended_for_nonpayment";
  stripe_balance_cents?: number;
  // White-label branding
  branding?: {
    app_name: string;
    logo_url: string | null;
    primary_color: string;
    favicon_url?: string | null;
  } | null;
  // Upsell entitlements
  has_compliance_qa?: boolean;
}

export const FLAG_LABELS: Record<string, string> = {
  allow_outbound_calls: "Outbound Calls",
  allow_sip_trunking: "SIP Trunking",
  allow_custom_voices: "Custom Voices",
  allow_api_access: "API Access",
  allow_campaign_dialer: "Campaign Dialer",
  max_concurrent_channels: "Concurrent Channels",
  max_agents: "Max Agents",
};
