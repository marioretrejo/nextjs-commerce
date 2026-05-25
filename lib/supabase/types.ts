export type Plan = 'free' | 'pro' | 'scale';
export type VoiceEngine = 'standard' | 'ultra_fast' | 'premium';
export type AgentStatus = 'active' | 'paused';
export type CampaignStatus = 'draft' | 'scheduled' | 'active' | 'paused' | 'completed';
export type ContactStatus = 'pending' | 'calling' | 'converted' | 'no_answer' | 'invalid' | 'rejected' | 'voicemail' | 'max_attempts';
export type CallOutcome = 'converted' | 'no_answer' | 'rejected' | 'transferred' | 'voicemail';
export type CallSentiment = 'positive' | 'neutral' | 'negative';
export type CallDirection = 'inbound' | 'outbound';
export type MemberRole = 'admin' | 'editor' | 'viewer';
export type MemberStatus = 'active' | 'pending';
export type PhoneStatus = 'available' | 'in_use' | 'suspended';
export type DocType = 'pdf' | 'docx' | 'text' | 'url';
export type DocStatus = 'processing' | 'ready' | 'error';
export type IntegrationType = 'hubspot' | 'gohighlevel' | 'salesforce' | 'zapier' | 'make' | 'calendly' | 'google_calendar' | 'twilio' | 'telnyx' | 'webhook';
export type IntegrationStatus = 'connected' | 'disconnected';
export type NotificationType = 'minutes_80' | 'minutes_100' | 'campaign_completed' | 'contact_converted' | 'qa_alert' | 'team_invite' | 'payment_failed' | 'broadcast';

export interface User {
  id: string;
  email: string;
  name: string | null;
  company: string | null;
  avatar_url: string | null;
  plan: Plan;
  minutes_used: number;
  minutes_limit: number;
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  subscription_status: string | null;
  is_superadmin: boolean;
  is_suspended: boolean;
  onboarding_completed: boolean;
  notification_preferences: NotificationType[];
  created_at: string;
}

export interface Workspace {
  id: string;
  owner_id: string;
  name: string;
  logo_url: string | null;
  plan: Plan;
  minutes_used: number;
  minutes_limit: number;
  is_white_label: boolean;
  custom_domain: string | null;
  branding: WorkspaceBranding | null;
  created_at: string;
}

export interface WorkspaceMember {
  id: string;
  workspace_id: string;
  user_id: string | null;
  role: MemberRole;
  status: MemberStatus;
  invite_email: string | null;
  invite_token: string | null;
  invited_at: string;
  joined_at: string | null;
  user?: User;
}

export interface FlowNode {
  id: string;
  type: string;
  position: { x: number; y: number };
  data: Record<string, unknown>;
}

export interface FlowEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
}

export interface FlowJSON {
  nodes: FlowNode[];
  edges: FlowEdge[];
}

export interface WorkspaceBranding {
  primary_color: string;
  logo_url: string | null;
  app_name: string;
  favicon_url?: string | null;
  custom_css?: string | null;
}

export interface CampaignTemplate {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  agent_id: string | null;
  config: Record<string, unknown>;
  created_at: string;
}

export interface Agent {
  id: string;
  workspace_id: string;
  name: string;
  language: string;
  auto_language_detection: boolean;
  voice_engine: VoiceEngine;
  voice_id: string | null;
  voice_name: string | null;
  emotional_speed: number;
  emotional_pitch: number;
  emotional_expressiveness: number;
  objective: string | null;
  personality: string | null;
  system_prompt: string | null;
  first_message: string | null;
  voicemail_message: string | null;
  schedule_days: string[];
  schedule_start_time: string;
  schedule_end_time: string;
  timezone: string;
  max_attempts: number;
  retry_interval_minutes: number;
  phone_number_id: string | null;
  branded_caller_id: string | null;
  transfer_enabled: boolean;
  transfer_number: string | null;
  transfer_type: 'warm' | 'cold';
  transfer_condition: string | null;
  interruption_handling: boolean;
  noise_cancellation: boolean;
  ivr_mode: boolean;
  dtmf_enabled: boolean;
  post_call_analysis_enabled: boolean;
  dynamic_variables: Record<string, string>;
  status: AgentStatus;
  retell_agent_id: string | null;
  elevenlabs_agent_id: string | null;
  flow_json: FlowJSON | null;
  widget_config: Record<string, unknown> | null;
  avg_qa_score: number;
  total_calls: number;
  created_at: string;
}

export interface PhoneNumber {
  id: string;
  workspace_id: string;
  number: string;
  country_code: string;
  country_name: string;
  provider: 'twilio' | 'telnyx';
  agent_id: string | null;
  status: PhoneStatus;
  branded_name: string | null;
  twilio_sid: string | null;
  created_at: string;
  agent?: Agent;
}

export interface KnowledgeDocument {
  id: string;
  agent_id: string;
  workspace_id: string;
  name: string;
  type: DocType;
  file_url: string | null;
  content_text: string | null;
  status: DocStatus;
  page_count: number | null;
  retell_kb_id: string | null;
  elevenlabs_kb_id: string | null;
  retention_days: number;
  created_at: string;
}

export interface Campaign {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  name: string;
  description: string | null;
  status: CampaignStatus;
  start_at: string | null;
  end_at: string | null;
  timezone: string;
  max_concurrency: number;
  retry_enabled: boolean;
  retry_interval_hours: number;
  respect_schedule: boolean;
  total_contacts: number;
  completed_contacts: number;
  converted_contacts: number;
  retell_batch_call_id: string | null;
  ab_enabled: boolean;
  ab_agent_id: string | null;
  ab_split_ratio: number;
  created_at: string;
  agent?: Agent;
}

export interface CampaignContact {
  id: string;
  campaign_id: string;
  name: string | null;
  phone: string;
  email: string | null;
  variables: Record<string, string>;
  status: ContactStatus;
  attempts: number;
  last_called_at: string | null;
  call_id: string | null;
  created_at: string;
}

export interface Call {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  campaign_id: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  direction: CallDirection;
  duration_seconds: number;
  status: string | null;
  outcome: CallOutcome | null;
  sentiment: CallSentiment | null;
  transcript: string | null;
  recording_url: string | null;
  summary: string | null;
  task_completed: boolean;
  extracted_name: string | null;
  extracted_email: string | null;
  extracted_interest: string | null;
  extracted_objections: string | null;
  qa_score: number | null;
  retell_call_id: string | null;
  cost_usd: number;
  created_at: string;
  agent?: Agent;
  campaign?: Campaign;
}

export interface QACriteria {
  id: string;
  agent_id: string;
  name: string;
  description: string | null;
  weight: number;
  created_at: string;
}

export interface Integration {
  id: string;
  workspace_id: string;
  type: IntegrationType;
  status: IntegrationStatus;
  credentials: Record<string, unknown>;
  webhook_url: string | null;
  webhook_events: string[];
  created_at: string;
}

export interface Notification {
  id: string;
  workspace_id: string | null;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  read: boolean;
  created_at: string;
}

export interface BillingInvoice {
  id: string;
  workspace_id: string;
  stripe_invoice_id: string;
  amount: number;
  currency: string;
  status: string;
  period_start: string | null;
  period_end: string | null;
  pdf_url: string | null;
  created_at: string;
}

export interface ApiKey {
  id: string;
  workspace_id: string;
  name: string;
  key_hash: string;
  key_prefix: string;
  last_used_at: string | null;
  created_at: string;
}

export type AutomationTrigger = 'converted' | 'no_answer' | 'voicemail' | 'rejected' | 'transferred' | 'any';
export type AutomationActionType = 'webhook' | 'tag_contact' | 'send_sms' | 'notify_team' | 'add_to_campaign';

export interface AutomationRule {
  id: string;
  agent_id: string;
  workspace_id: string;
  name: string;
  trigger_outcome: AutomationTrigger;
  action_type: AutomationActionType;
  action_config: Record<string, unknown>;
  enabled: boolean;
  created_at: string;
}

export interface DncEntry {
  id: string;
  workspace_id: string;
  phone: string;
  reason: string | null;
  added_at: string;
}

export interface ComplianceSettings {
  id: string;
  workspace_id: string;
  calling_hours_enabled: boolean;
  calling_hours_start: string;
  calling_hours_end: string;
  calling_days: string[];
  call_recording_retention_days: number;
  transcript_retention_days: number;
  require_consent: boolean;
  consent_message: string | null;
  tcpa_compliance_enabled: boolean;
  gdpr_compliance_enabled: boolean;
  created_at: string;
  updated_at: string;
}

// Database type map for Supabase generics
export type Database = {
  public: {
    Tables: {
      users: { Row: User; Insert: Partial<User> & { id: string; email: string }; Update: Partial<User> };
      workspaces: { Row: Workspace; Insert: Omit<Workspace, 'id' | 'created_at'>; Update: Partial<Workspace> };
      workspace_members: { Row: WorkspaceMember; Insert: Omit<WorkspaceMember, 'id' | 'invited_at'>; Update: Partial<WorkspaceMember> };
      agents: { Row: Agent; Insert: Omit<Agent, 'id' | 'created_at' | 'avg_qa_score' | 'total_calls'>; Update: Partial<Agent> };
      phone_numbers: { Row: PhoneNumber; Insert: Omit<PhoneNumber, 'id' | 'created_at'>; Update: Partial<PhoneNumber> };
      knowledge_documents: { Row: KnowledgeDocument; Insert: Omit<KnowledgeDocument, 'id' | 'created_at'>; Update: Partial<KnowledgeDocument> };
      campaigns: { Row: Campaign; Insert: Omit<Campaign, 'id' | 'created_at' | 'total_contacts' | 'completed_contacts' | 'converted_contacts'>; Update: Partial<Campaign> };
      campaign_contacts: { Row: CampaignContact; Insert: Omit<CampaignContact, 'id' | 'created_at'>; Update: Partial<CampaignContact> };
      calls: { Row: Call; Insert: Omit<Call, 'id' | 'created_at'>; Update: Partial<Call> };
      qa_criteria: { Row: QACriteria; Insert: Omit<QACriteria, 'id' | 'created_at'>; Update: Partial<QACriteria> };
      integrations: { Row: Integration; Insert: Omit<Integration, 'id' | 'created_at'>; Update: Partial<Integration> };
      notifications: { Row: Notification; Insert: Omit<Notification, 'id' | 'created_at'>; Update: Partial<Notification> };
      billing_invoices: { Row: BillingInvoice; Insert: Omit<BillingInvoice, 'id' | 'created_at'>; Update: Partial<BillingInvoice> };
      api_keys: { Row: ApiKey; Insert: Omit<ApiKey, 'id' | 'created_at'>; Update: Partial<ApiKey> };
      campaign_templates: { Row: CampaignTemplate; Insert: Omit<CampaignTemplate, 'id' | 'created_at'>; Update: Partial<CampaignTemplate> };
    };
  };
};
