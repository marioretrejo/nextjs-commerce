/**
 * POST /api/call-provider-integrations/[id]/rotate-secret
 *
 * Generates a new webhook secret and returns the plaintext ONCE. Any provider
 * still sending the old secret will start receiving 401 until reconfigured.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { CallProviderIntegration } from "@/lib/supabase/types";
import {
  authWorkspace,
  serializeIntegration,
  generateWebhookSecret,
} from "../../_lib/helpers";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authWorkspace();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const admin = createAdminClient();
  const secret = generateWebhookSecret();

  const { data: updated, error } = await admin
    .from("call_provider_integrations")
    .update({ webhook_secret: secret, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .select("*")
    .single();

  if (error || !updated) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({
    integration: serializeIntegration(updated as CallProviderIntegration),
    webhook_secret: secret,
  });
}
