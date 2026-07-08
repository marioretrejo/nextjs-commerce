import { createClient } from "@/lib/supabase/server";
import { resolveQacWorkspace } from "@/lib/qac-workspace";
import { randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import type { CallProviderIntegration } from "@/lib/supabase/types";

export const PROVIDERS = [
  "squaretalk",
  "voiso",
  "commpeak",
  "custom_webhook",
  "n8n",
] as const;
export const CONNECTION_METHODS = ["webhook_receiver", "api_sync"] as const;
export const STATUSES = ["active", "paused", "error", "disabled"] as const;

export type AuthOk = { workspaceId: string; userId: string };

// Resolve the session user + workspace. Returns a NextResponse (401/404) on
// failure so callers can `if (res instanceof NextResponse) return res;`.
export async function authWorkspace(): Promise<AuthOk | NextResponse> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const ws = await resolveQacWorkspace(user.id);
  if (!ws) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }
  return { workspaceId: ws.id, userId: user.id };
}

export function generateWebhookSecret(): string {
  return `whsec_${randomBytes(24).toString("base64url")}`;
}

function maskSecret(secret: string | null): string | null {
  if (!secret) return null;
  return `••••${secret.slice(-4)}`;
}

function webhookUrl(id: string): { path: string; url: string | null } {
  const path = `/api/import/calls/${id}`;
  const base = process.env["NEXT_PUBLIC_APP_URL"] ?? "";
  return { path, url: base ? `${base}${path}` : null };
}

export interface SerializedIntegration {
  id: string;
  workspace_id: string;
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

// Convert a DB row into a client-safe shape. NEVER returns raw webhook_secret or
// credential values — only a masked secret + the list of credential keys.
export function serializeIntegration(
  row: CallProviderIntegration,
): SerializedIntegration {
  const { path, url } = webhookUrl(row.id);
  const credentials = (row.credentials ?? {}) as Record<string, unknown>;
  return {
    id: row.id,
    workspace_id: row.workspace_id,
    name: row.name,
    provider: row.provider,
    connection_method: row.connection_method,
    status: row.status,
    default_agent_id: row.default_agent_id,
    default_department: row.default_department,
    webhook_secret_set: !!row.webhook_secret,
    webhook_secret_masked: maskSecret(row.webhook_secret),
    credential_keys: Object.keys(credentials),
    config: (row.config ?? {}) as Record<string, unknown>,
    last_event_at: row.last_event_at,
    last_sync_at: row.last_sync_at,
    last_error: row.last_error,
    created_at: row.created_at,
    updated_at: row.updated_at,
    webhook_path: path,
    webhook_url: url,
  };
}
