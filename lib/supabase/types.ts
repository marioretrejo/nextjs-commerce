export type Plan = "free" | "pro" | "scale";
export type VoiceEngine = "standard" | "ultra_fast" | "premium";
export type AgentStatus = "active" | "paused";
export type CampaignStatus =
  | "draft"
  | "scheduled"
  | "active"
  | "paused"
  | "completed";
export type ContactStatus =
  | "pending"
  | "calling"
  | "converted"
  | "no_answer"
  | "invalid"
  | "rejected"
  | "voicemail"
  | "max_attempts"
  | "excluded"
  | "completed"
  | "failed";
export type CallOutcome =
  | "converted"
  | "no_answer"
  | "rejected"
  | "transferred"
  | "voicemail";
export type CallSentiment = "positive" | "neutral" | "negative";
export type CallDirection = "inbound" | "outbound";
export type CallDisposition =
  | "meeting_booked"
  | "not_interested"
  | "voicemail"
  | "follow_up"
  | "callback_requested"
  | "completed"
  | "transferred"
  | "other";
export type MemberRole = "admin" | "editor" | "viewer";
export type MemberStatus = "active" | "pending";
export type PhoneStatus = "available" | "in_use" | "suspended";
export type DocType = "pdf" | "docx" | "text" | "url";
export type DocStatus = "processing" | "ready" | "error";
export type IntegrationType =
  | "hubspot"
  | "gohighlevel"
  | "salesforce"
  | "zapier"
  | "make"
  | "calendly"
  | "google_calendar"
  | "twilio"
  | "telnyx"
  | "webhook"
  | "telegram"
  | "n8n"
  | "teams";
export type IntegrationStatus = "connected" | "disconnected";
export type NotificationType =
  | "minutes_80"
  | "minutes_100"
  | "campaign_completed"
  | "contact_converted"
  | "qa_alert"
  | "team_invite"
  | "payment_failed"
  | "broadcast"
  | "activity";

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
  // Enterprise billing fields (migration 020)
  minute_cap: number | null;
  billing_status: "active" | "suspended_for_nonpayment";
  stripe_balance_cents: number;
  // Stripe subscription fields (migration 036)
  stripe_customer_id: string | null;
  stripe_subscription_id: string | null;
  stripe_price_id: string | null;
  subscription_status: string;
  // Legacy suspension (kept for backwards compat)
  is_suspended?: boolean;
  api_rate_limit_rps?: number | null;
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
  visible_modules: string[];
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
  transfer_type: "warm" | "cold";
  transfer_condition: string | null;
  interruption_handling: boolean;
  noise_cancellation: boolean;
  ivr_mode: boolean;
  dtmf_enabled: boolean;
  post_call_analysis_enabled: boolean;
  amd_enabled: boolean;
  amd_action: "hangup" | "leave_voicemail" | null;
  response_delay_ms: number;
  speak_first: boolean;
  ambient_sound:
    | "coffee-shop"
    | "convention-hall"
    | "summer-outdoor"
    | "mountain-outdoor"
    | "static-noise"
    | "call-center"
    | null;
  ambient_sound_volume: number;
  voice_emotion:
    | "calm"
    | "sympathetic"
    | "happy"
    | "sad"
    | "angry"
    | "fearful"
    | "surprised"
    | null;
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
  provider: "twilio" | "telnyx" | "sip_trunk" | "custom";
  agent_id: string | null;
  status: PhoneStatus;
  branded_name: string | null;
  twilio_sid: string | null;
  sip_trunk_uri: string | null;
  display_name: string | null;
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

export interface CampaignLeadCounts {
  pending: number;
  completed: number;
  failed: number;
  calling: number;
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
  max_retries: number;
  respect_schedule: boolean;
  total_contacts: number;
  completed_contacts: number;
  converted_contacts: number;
  retell_batch_call_id: string | null;
  ab_enabled: boolean;
  ab_agent_id: string | null;
  ab_split_ratio: number;
  configuration: Record<string, unknown> | null;
  created_at: string;
  agent?: Agent;
  lead_counts?: CampaignLeadCounts;
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
  campaign_lead_id: string | null;
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
  disposition: CallDisposition | null;
  transcript: string | null;
  recording_url: string | null;
  summary: string | null;
  task_completed: boolean;
  extracted_name: string | null;
  extracted_email: string | null;
  extracted_interest: string | null;
  extracted_objections: string | null;
  qa_score: number | null;
  qa_feedback: string | null;
  qa_details: Record<string, unknown> | null;
  retell_call_id: string | null;
  cost_usd: number;
  tokens_used: number | null;
  extracted_data: Record<string, unknown> | null;
  created_at: string;
  // External-import fields (migration 075)
  external_source: string | null;
  external_call_id: string | null;
  external_agent_name: string | null;
  department: string | null;
  prospect_id: string | null;
  crm_id: string | null;
  extension: string | null;
  imported_payload: Record<string, unknown> | null;
  analysis_status: CallAnalysisStatus | null;
  analysis_error: string | null;
  recording_storage_path: string | null;
  import_integration_id: string | null;
  agent?: Agent;
  campaign?: Campaign;
}

export interface QACriteria {
  id: string;
  agent_id: string;
  workspace_id: string | null;
  name: string;
  description: string | null;
  weight: number;
  created_at: string;
}

export type CallAnalysisStatus =
  | "pending"
  | "processing"
  | "analyzed"
  | "error";

export type CallProvider =
  | "squaretalk"
  | "voiso"
  | "commpeak"
  | "custom_webhook"
  | "n8n";

export type CallConnectionMethod = "webhook_receiver" | "api_sync";

export type CallProviderIntegrationStatus =
  | "active"
  | "paused"
  | "error"
  | "disabled";

export interface CallProviderIntegration {
  id: string;
  workspace_id: string;
  name: string;
  provider: CallProvider;
  connection_method: CallConnectionMethod;
  status: CallProviderIntegrationStatus;
  default_agent_id: string | null;
  default_department: string | null;
  webhook_secret: string | null;
  config: Record<string, unknown>;
  credentials: Record<string, unknown>;
  last_event_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
}

export interface CallImportLog {
  id: string;
  workspace_id: string;
  integration_id: string | null;
  provider: string;
  external_call_id: string | null;
  status: "success" | "error" | "duplicate";
  message: string | null;
  payload: Record<string, unknown> | null;
  response: Record<string, unknown> | null;
  call_id: string | null;
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
  link: string | null;
  actor_name: string | null;
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

export interface KnowledgeBase {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  created_at: string;
}

export interface DocumentChunk {
  id: string;
  kb_id: string;
  workspace_id: string;
  source_name: string;
  chunk_index: number;
  content: string;
  created_at: string;
}

export interface CustomVoice {
  id: string;
  workspace_id: string;
  name: string;
  provider: string;
  provider_voice_id: string;
  preview_url: string | null;
  language: string;
  gender: string | null;
  status: "cloning" | "ready" | "error";
  error_message: string | null;
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

// ─── SIP / Dialing strategy (migration 037) ───────────────────────────────────

export type SipProvider =
  | "commpeak"
  | "squaretalk"
  | "telnyx"
  | "vonage"
  | "twilio"
  | "custom";
export type SipTrunkStatus = "active" | "testing" | "error" | "disabled";

export type SipProtocol = "UDP" | "TCP" | "TLS" | "TLS/SRTP";

export interface SipTrunk {
  id: string;
  workspace_id: string;
  name: string;
  provider: SipProvider;
  sip_host: string;
  port: number;
  username: string;
  password: string;
  netmask: number;
  protocol: SipProtocol;
  livekit_trunk_id: string | null;
  priority: number;
  region: string | null;
  status: SipTrunkStatus;
  last_tested_at: string | null;
  test_result: Record<string, unknown> | null;
  created_at: string;
}

export interface SipTrunkNumber {
  id: string;
  trunk_id: string;
  workspace_id: string;
  number: string;
  area_code: string | null;
  country_code: string;
  region: string | null;
  is_primary: boolean;
  created_at: string;
}

export type ScheduleWindow = {
  day: "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
  start: string; // "HH:MM" 24-hour
  end: string; // "HH:MM" 24-hour
};

export interface DialingSchedule {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  name: string;
  timezone: string;
  windows: ScheduleWindow[];
  is_default: boolean;
  created_at: string;
}

export type ActionTrigger =
  | "pre_call"
  | "post_call"
  | "on_transfer"
  | "on_voicemail"
  | "on_converted"
  | "on_no_answer"
  | "on_error";

export type ActionType = "webhook" | "sms" | "email" | "crm_update";

export interface CallAction {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  name: string;
  trigger: ActionTrigger;
  type: ActionType;
  config: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
}

export type ScenarioType =
  | "voicemail_short"
  | "voicemail_long"
  | "bot_detected"
  | "disinterest"
  | "objection"
  | "no_response"
  | "human_requested";

export type ScenarioActionType =
  | "hangup"
  | "leave_voicemail"
  | "navigate_ivr"
  | "transfer"
  | "retry_later"
  | "custom_response";

export interface ScenarioHandlerRow {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  scenario: ScenarioType;
  action: ScenarioActionType;
  config: Record<string, unknown>;
  max_attempts: number;
  is_active: boolean;
  created_at: string;
}

export type AutomationTrigger =
  | "converted"
  | "no_answer"
  | "voicemail"
  | "rejected"
  | "transferred"
  | "any";
export type AutomationActionType =
  | "webhook"
  | "tag_contact"
  | "send_sms"
  | "notify_team"
  | "add_to_campaign";

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

// QA Center v2 Types

export interface QACustomerJourney {
  id: string;
  workspace_id: string;
  contact_phone: string;
  contact_name: string | null;
  agent_id: string | null;
  department: string | null;
  first_call_at: string | null;
  last_call_at: string | null;
  total_calls: number;
  final_outcome: string | null;
  final_score: number | null;
  journey_summary: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface QAJourneyCall {
  id: string;
  journey_id: string;
  call_id: string;
  sequence_index: number;
  role_in_journey:
    | "first_touch"
    | "follow_up"
    | "closing_call"
    | "support_call"
    | "other";
  created_at: string;
}

export interface QADepartment {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  department_type: string;
  scoring_prompt: string;
  compliance_prompt: string | null;
  coaching_prompt: string | null;
  forbidden_terms_prompt: string | null;
  scoring_weights: Record<string, number>;
  telegram_alert_enabled: boolean;
  telegram_chat_id: string | null;
  critical_score_threshold: number;
  high_risk_keywords_enabled: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface QAForbiddenRule {
  id: string;
  workspace_id: string;
  department_id: string | null;
  name: string;
  description: string | null;
  severity: "low" | "medium" | "high" | "critical";
  match_type: "keyword" | "semantic" | "regex" | "combined";
  patterns: string[];
  interpretation_prompt: string | null;
  alert_enabled: boolean;
  auto_block_enabled: boolean;
  action_on_trigger:
    | "notify_qa_manager"
    | "escalate"
    | "flag_for_review"
    | "stop_analysis"
    | "suspend_agent";
  metadata: Record<string, unknown>;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface QAAlert {
  id: string;
  workspace_id: string;
  call_id: string;
  journey_id: string | null;
  agent_id: string | null;
  department_id: string | null;
  rule_id: string | null;
  severity: "low" | "medium" | "high" | "critical";
  title: string;
  summary: string;
  transcript_excerpt: string | null;
  timestamp_seconds: number | null;
  timestamp_label: string | null;
  status: "open" | "acknowledged" | "resolved" | "dismissed";
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  resolution_notes: string | null;
  telegram_sent: boolean;
  telegram_message_id: string | null;
  telegram_retry_count: number;
  telegram_last_retry_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface QATranscriptSegment {
  id: string;
  call_id: string;
  workspace_id: string;
  speaker: "agent" | "customer" | "system" | "ivr";
  text: string;
  start_seconds: number;
  end_seconds: number;
  confidence: number | null;
  language: string | null;
  is_key_moment: boolean;
  key_moment_label: string | null;
  embedding: number[] | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface QACallTranscriptSummary {
  id: string;
  call_id: string;
  workspace_id: string;
  total_segments: number;
  duration_seconds: number | null;
  language: string;
  agent_turn_count: number;
  customer_turn_count: number;
  agent_avg_turn_length: number | null;
  customer_avg_turn_length: number | null;
  key_moments_count: number;
  key_moments_types: string[];
  first_agent_line_at: number | null;
  last_customer_line_at: number | null;
  has_embedding: boolean;
  embeddings_updated_at: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export type QAPermission =
  | "view_qa_center"
  | "view_all_calls"
  | "view_team_calls"
  | "view_own_calls"
  | "view_scores"
  | "export_reports"
  | "manage_qa_rules"
  | "manage_departments"
  | "manage_forbidden_rules"
  | "manage_roles"
  | "acknowledge_alerts"
  | "resolve_alerts"
  | "configure_telegram";

export interface QARole {
  id: string;
  workspace_id: string;
  name: string;
  description: string | null;
  permissions: QAPermission[];
  is_system: boolean;
  color: string;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface QAUserRole {
  id: string;
  workspace_id: string;
  user_id: string;
  role_id: string;
  assigned_at: string;
  assigned_by: string | null;
  expires_at: string | null;
  metadata: Record<string, unknown>;
}

// Database type map for Supabase generics
export type Database = {
  public: {
    Tables: {
      users: {
        Row: User;
        Insert: Partial<User> & { id: string; email: string };
        Update: Partial<User>;
      };
      workspaces: {
        Row: Workspace;
        Insert: Omit<Workspace, "id" | "created_at">;
        Update: Partial<Workspace>;
      };
      workspace_members: {
        Row: WorkspaceMember;
        Insert: Omit<WorkspaceMember, "id" | "invited_at">;
        Update: Partial<WorkspaceMember>;
      };
      agents: {
        Row: Agent;
        Insert: Omit<
          Agent,
          "id" | "created_at" | "avg_qa_score" | "total_calls"
        >;
        Update: Partial<Agent>;
      };
      phone_numbers: {
        Row: PhoneNumber;
        Insert: Omit<PhoneNumber, "id" | "created_at">;
        Update: Partial<PhoneNumber>;
      };
      knowledge_documents: {
        Row: KnowledgeDocument;
        Insert: Omit<KnowledgeDocument, "id" | "created_at">;
        Update: Partial<KnowledgeDocument>;
      };
      campaigns: {
        Row: Campaign;
        Insert: Omit<
          Campaign,
          | "id"
          | "created_at"
          | "total_contacts"
          | "completed_contacts"
          | "converted_contacts"
        >;
        Update: Partial<Campaign>;
      };
      campaign_contacts: {
        Row: CampaignContact;
        Insert: Omit<CampaignContact, "id" | "created_at">;
        Update: Partial<CampaignContact>;
      };
      calls: {
        Row: Call;
        Insert: Omit<Call, "id" | "created_at">;
        Update: Partial<Call>;
      };
      qa_criteria: {
        Row: QACriteria;
        Insert: Omit<QACriteria, "id" | "created_at">;
        Update: Partial<QACriteria>;
      };
      call_provider_integrations: {
        Row: CallProviderIntegration;
        Insert: Omit<
          CallProviderIntegration,
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<CallProviderIntegration>;
      };
      call_import_logs: {
        Row: CallImportLog;
        Insert: Omit<CallImportLog, "id" | "created_at">;
        Update: Partial<CallImportLog>;
      };
      integrations: {
        Row: Integration;
        Insert: Omit<Integration, "id" | "created_at">;
        Update: Partial<Integration>;
      };
      notifications: {
        Row: Notification;
        Insert: Omit<Notification, "id" | "created_at">;
        Update: Partial<Notification>;
      };
      billing_invoices: {
        Row: BillingInvoice;
        Insert: Omit<BillingInvoice, "id" | "created_at">;
        Update: Partial<BillingInvoice>;
      };
      api_keys: {
        Row: ApiKey;
        Insert: Omit<ApiKey, "id" | "created_at">;
        Update: Partial<ApiKey>;
      };
      campaign_templates: {
        Row: CampaignTemplate;
        Insert: Omit<CampaignTemplate, "id" | "created_at">;
        Update: Partial<CampaignTemplate>;
      };
      // Migration 037
      sip_trunks: {
        Row: SipTrunk;
        Insert: Omit<SipTrunk, "id" | "created_at">;
        Update: Partial<SipTrunk>;
      };
      sip_trunk_numbers: {
        Row: SipTrunkNumber;
        Insert: Omit<SipTrunkNumber, "id" | "created_at">;
        Update: Partial<SipTrunkNumber>;
      };
      dialing_schedules: {
        Row: DialingSchedule;
        Insert: Omit<DialingSchedule, "id" | "created_at">;
        Update: Partial<DialingSchedule>;
      };
      call_actions: {
        Row: CallAction;
        Insert: Omit<CallAction, "id" | "created_at">;
        Update: Partial<CallAction>;
      };
      scenario_handlers: {
        Row: ScenarioHandlerRow;
        Insert: Omit<ScenarioHandlerRow, "id" | "created_at">;
        Update: Partial<ScenarioHandlerRow>;
      };
      qa_customer_journeys: {
        Row: QACustomerJourney;
        Insert: Omit<QACustomerJourney, "id" | "created_at" | "updated_at">;
        Update: Partial<QACustomerJourney>;
      };
      qa_journey_calls: {
        Row: QAJourneyCall;
        Insert: Omit<QAJourneyCall, "id" | "created_at">;
        Update: Partial<QAJourneyCall>;
      };
      qa_departments: {
        Row: QADepartment;
        Insert: Omit<QADepartment, "id" | "created_at" | "updated_at">;
        Update: Partial<QADepartment>;
      };
      qa_forbidden_rules: {
        Row: QAForbiddenRule;
        Insert: Omit<QAForbiddenRule, "id" | "created_at" | "updated_at">;
        Update: Partial<QAForbiddenRule>;
      };
      qa_alerts: {
        Row: QAAlert;
        Insert: Omit<QAAlert, "id" | "created_at" | "updated_at">;
        Update: Partial<QAAlert>;
      };
      qa_transcript_segments: {
        Row: QATranscriptSegment;
        Insert: Omit<QATranscriptSegment, "id" | "created_at">;
        Update: Partial<QATranscriptSegment>;
      };
      qa_call_transcript_summary: {
        Row: QACallTranscriptSummary;
        Insert: Omit<
          QACallTranscriptSummary,
          "id" | "created_at" | "updated_at"
        >;
        Update: Partial<QACallTranscriptSummary>;
      };
      qa_roles: {
        Row: QARole;
        Insert: Omit<QARole, "id" | "created_at" | "updated_at">;
        Update: Partial<QARole>;
      };
      qa_user_roles: {
        Row: QAUserRole;
        Insert: Omit<QAUserRole, "id" | "assigned_at">;
        Update: Partial<QAUserRole>;
      };
    };
  };
};
