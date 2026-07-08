/**
 * GET  /api/call-provider-integrations — list the workspace's integrations
 * POST /api/call-provider-integrations — create one (returns the plaintext
 *      webhook secret ONCE, in the create response only)
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { CallProviderIntegration } from "@/lib/supabase/types";
import {
  authWorkspace,
  serializeIntegration,
  generateWebhookSecret,
  PROVIDERS,
  CONNECTION_METHODS,
} from "./_lib/helpers";

export const dynamic = "force-dynamic";

export async function GET() {
  const auth = await authWorkspace();
  if (auth instanceof NextResponse) return auth;

  const admin = createAdminClient();
  const { data } = await admin
    .from("call_provider_integrations")
    .select("*")
    .eq("workspace_id", auth.workspaceId)
    .order("created_at", { ascending: false });

  const integrations = ((data ?? []) as CallProviderIntegration[]).map(
    serializeIntegration,
  );
  return NextResponse.json({ integrations });
}

export async function POST(req: Request) {
  const auth = await authWorkspace();
  if (auth instanceof NextResponse) return auth;

  let body: {
    name?: string;
    provider?: string;
    connection_method?: string;
    default_agent_id?: string | null;
    default_department?: string | null;
    config?: Record<string, unknown>;
    credentials?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = (body.name ?? "").trim();
  if (!name) {
    return NextResponse.json({ error: "Name is required" }, { status: 400 });
  }
  if (!body.provider || !PROVIDERS.includes(body.provider as never)) {
    return NextResponse.json({ error: "Invalid provider" }, { status: 400 });
  }
  if (
    !body.connection_method ||
    !CONNECTION_METHODS.includes(body.connection_method as never)
  ) {
    return NextResponse.json(
      { error: "Invalid connection method" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();

  // Validate default_agent_id belongs to the workspace, if provided.
  let defaultAgentId: string | null = null;
  if (body.default_agent_id) {
    const { data: agent } = await admin
      .from("agents")
      .select("id")
      .eq("id", body.default_agent_id)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();
    if (!agent) {
      return NextResponse.json(
        { error: "Default agent not found in workspace" },
        { status: 400 },
      );
    }
    defaultAgentId = body.default_agent_id;
  }

  // Webhook receiver integrations always get a secret; api_sync ones may too.
  const secret = generateWebhookSecret();

  const { data: inserted, error } = await admin
    .from("call_provider_integrations")
    .insert({
      workspace_id: auth.workspaceId,
      name,
      provider: body.provider,
      connection_method: body.connection_method,
      status: "active",
      default_agent_id: defaultAgentId,
      default_department: body.default_department?.trim() || null,
      webhook_secret: secret,
      config: body.config ?? {},
      credentials: body.credentials ?? {},
    })
    .select("*")
    .single();

  if (error || !inserted) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to create integration" },
      { status: 500 },
    );
  }

  const serialized = serializeIntegration(inserted as CallProviderIntegration);
  // Return the plaintext secret ONCE — it is never returned again.
  return NextResponse.json(
    { integration: serialized, webhook_secret: secret },
    { status: 201 },
  );
}
