export interface CampaignRow {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  max_concurrency: number;
  retry_enabled: boolean;
  retry_interval_hours: number;
  max_retries: number;
}

export interface ContactRow {
  id: string;
  phone: string;
  name: string | null;
  variables: Record<string, string>;
  attempts: number;
}

export interface AgentRow {
  id: string;
  name: string;
  system_prompt: string | null;
  first_message: string | null;
  voice_id: string | null;
  voice_emotion: string | null;
  flow_json: unknown | null;
  flow_config: unknown | null;
  transfer_number: string | null;
  amd_enabled: boolean;
  amd_action: "hangup" | "leave_voicemail" | null;
}

export interface WorkspaceRow {
  id: string;
  minutes_used: number;
  minutes_limit: number;
  is_suspended: boolean;
}

export interface SipIntegrationRow {
  id: string;
  credentials: {
    provider_name: string;
    sip_host: string;
    username: string;
    password: string;
    livekit_trunk_id?: string;
  };
}
