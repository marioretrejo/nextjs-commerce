/**
 * PATCH  /api/call-provider-integrations/[id] — update an integration
 * DELETE /api/call-provider-integrations/[id] — delete an integration
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import type { CallProviderIntegration } from "@/lib/supabase/types";
import { authWorkspace, serializeIntegration, STATUSES } from "../_lib/helpers";

export const dynamic = "force-dynamic";

async function loadOwned(workspaceId: string, id: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("call_provider_integrations")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", workspaceId)
    .maybeSingle();
  return data as CallProviderIntegration | null;
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authWorkspace();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const existing = await loadOwned(auth.workspaceId, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let body: {
    name?: string;
    status?: string;
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

  const admin = createAdminClient();
  const update: Record<string, unknown> = {
    updated_at: new Date().toISOString(),
  };

  if (typeof body.name === "string" && body.name.trim())
    update["name"] = body.name.trim();
  if (body.status) {
    if (!STATUSES.includes(body.status as never)) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    update["status"] = body.status;
    // Clearing an error state resets last_error.
    if (body.status === "active") update["last_error"] = null;
  }
  if (body.default_department !== undefined)
    update["default_department"] = body.default_department?.trim() || null;
  if (body.default_agent_id !== undefined) {
    if (body.default_agent_id === null) {
      update["default_agent_id"] = null;
    } else {
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
      update["default_agent_id"] = body.default_agent_id;
    }
  }
  if (body.config !== undefined) update["config"] = body.config;
  // Merge credentials so partial updates don't wipe existing keys.
  if (body.credentials !== undefined) {
    update["credentials"] = {
      ...((existing.credentials ?? {}) as Record<string, unknown>),
      ...body.credentials,
    };
  }

  const { data: updated, error } = await admin
    .from("call_provider_integrations")
    .update(update)
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId)
    .select("*")
    .single();

  if (error || !updated) {
    return NextResponse.json(
      { error: error?.message ?? "Failed to update" },
      { status: 500 },
    );
  }

  return NextResponse.json({
    integration: serializeIntegration(updated as CallProviderIntegration),
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await authWorkspace();
  if (auth instanceof NextResponse) return auth;
  const { id } = await params;

  const existing = await loadOwned(auth.workspaceId, id);
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const admin = createAdminClient();
  const { error } = await admin
    .from("call_provider_integrations")
    .delete()
    .eq("id", id)
    .eq("workspace_id", auth.workspaceId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
