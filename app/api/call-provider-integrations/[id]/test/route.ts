/**
 * POST /api/call-provider-integrations/[id]/test
 *
 * Lightweight self-check for an integration. Does NOT create a real call — it
 * validates configuration (secret set, default agent resolvable) and records a
 * diagnostic entry in call_import_logs so it appears in the logs view.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { CallProviderIntegration } from "@/lib/supabase/types";
import { authWorkspace } from "../../_lib/helpers";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authWorkspace();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const admin = createAdminClient();
  const { data } = await admin
    .from("call_provider_integrations")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .maybeSingle();
  const integration = data as CallProviderIntegration | null;
  if (!integration) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const checks: Record<string, boolean> = {
    active: integration.status === "active",
    secret_set: !!integration.webhook_secret,
    default_agent_set: false,
  };

  if (integration.default_agent_id) {
    const { data: agent } = await admin
      .from("agents")
      .select("id")
      .eq("id", integration.default_agent_id)
      .eq("workspace_id", auth.workspaceId)
      .maybeSingle();
    checks["default_agent_set"] = !!agent;
  }

  // A default agent is not strictly required (fuzzy name matching may resolve
  // it), so it's a warning, not a hard failure.
  const passed = checks["active"] && checks["secret_set"];
  const message = passed
    ? "Configuration looks good. Send a test event from your provider to verify end-to-end."
    : !checks["active"]
      ? "Integration is not active."
      : "No webhook secret configured — rotate the secret.";

  await admin.from("call_import_logs").insert({
    workspace_id: auth.workspaceId,
    integration_id: integration.id,
    provider: integration.provider,
    external_call_id: null,
    status: passed ? "success" : "error",
    message: `Test: ${message}`,
    payload: { test: true },
    response: { checks },
    call_id: null,
  });

  return NextResponse.json({ ok: passed, checks, message });
}
