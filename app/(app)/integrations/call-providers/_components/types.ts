export interface CallProviderIntegrationDTO {
  id: string;
  name: string;
  provider: string;
  connection_method: string;
  status: string;
  default_agent_id: string | null;
  default_department: string | null;
  webhook_secret_set: boolean;
  webhook_secret_masked: string | null;
  credential_keys: string[];
  config: Record<string, unknown>;
  last_event_at: string | null;
  last_sync_at: string | null;
  last_error: string | null;
  created_at: string;
  updated_at: string;
  webhook_path: string;
  webhook_url: string | null;
}

export interface ImportLogDTO {
  id: string;
  provider: string;
  external_call_id: string | null;
  status: "success" | "error" | "duplicate";
  message: string | null;
  call_id: string | null;
  created_at: string;
}

export interface AgentOption {
  id: string;
  name: string;
}

export const PROVIDER_OPTIONS = [
  { value: "squaretalk", label: "Squaretalk" },
  { value: "voiso", label: "Voiso" },
  { value: "commpeak", label: "CommPeak" },
  { value: "n8n", label: "n8n" },
  { value: "custom_webhook", label: "Custom Webhook" },
];

export const METHOD_OPTIONS = [
  { value: "webhook_receiver", label: "Webhook Receiver" },
  { value: "api_sync", label: "API Sync" },
];

export function providerLabel(v: string): string {
  return PROVIDER_OPTIONS.find((p) => p.value === v)?.label ?? v;
}

export function methodLabel(v: string): string {
  return METHOD_OPTIONS.find((m) => m.value === v)?.label ?? v;
}

// Resolve the full webhook URL, preferring the server value and falling back to
// the current origin + path (works when NEXT_PUBLIC_APP_URL isn't configured).
export function resolveWebhookUrl(dto: CallProviderIntegrationDTO): string {
  if (dto.webhook_url) return dto.webhook_url;
  if (typeof window !== "undefined")
    return `${window.location.origin}${dto.webhook_path}`;
  return dto.webhook_path;
}
