export const STEPS = [
  "Campaign Info",
  "Upload Contacts",
  "A/B Test",
  "Schedule",
  "Review",
];

export interface Agent {
  id: string;
  name: string;
}

export interface Contact {
  name?: string;
  phone: string;
  email?: string;
  [key: string]: string | undefined;
}

export interface CampaignForm {
  name: string;
  description: string;
  agent_id: string;
  max_concurrency: number;
  retry_enabled: boolean;
  retry_interval_hours: number;
  max_retries: number;
  respect_schedule: boolean;
  timezone: string;
  start_at: string;
  end_at: string;
  ab_enabled: boolean;
  ab_agent_id: string;
  ab_split_ratio: number;
}

export const DEFAULT_FORM: CampaignForm = {
  name: "",
  description: "",
  agent_id: "",
  max_concurrency: 5,
  retry_enabled: true,
  retry_interval_hours: 24,
  max_retries: 3,
  respect_schedule: true,
  timezone: "America/New_York",
  start_at: "",
  end_at: "",
  ab_enabled: false,
  ab_agent_id: "",
  ab_split_ratio: 50,
};
