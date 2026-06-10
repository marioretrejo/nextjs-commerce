import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, parseBody } from "@/lib/api";
import { writeAuditLog } from "@/lib/admin-audit";
import {
  isTransitionAllowed,
  sanitizeConfiguration,
  ALLOWED_TRANSITIONS,
} from "@/lib/campaigns/validation";
import type { CampaignStatus } from "@/lib/supabase/types";

const PatchCampaignSchema = z
  .object({
    status: z
      .enum(["draft", "scheduled", "active", "paused", "completed"])
      .optional(),
    name: z.string().min(1).max(100).optional(),
    agent_id: z.string().uuid().optional().nullable(),
    description: z.string().max(500).optional().nullable(),
    start_at: z.string().datetime().optional().nullable(),
    end_at: z.string().datetime().optional().nullable(),
    timezone: z.string().optional(),
    max_concurrency: z.number().int().min(1).max(100).optional(),
    retry_enabled: z.boolean().optional(),
    retry_interval_hours: z.number().int().min(1).optional(),
    max_retries: z.number().int().min(0).max(10).optional(),
    configuration: z.record(z.unknown()).optional().nullable(),
  })
  .refine((d) => Object.keys(d).length > 0, "At least one field required");

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data, error } = await supabase
    .from("campaigns")
    .select("*, agent:agents!campaigns_agent_id_fkey(name, voice_engine)")
    .eq("id", id)
    .single();

  if (error || !data)
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(data);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Verify ownership via RLS before using admin client for writes.
  // Include agent_id and total_contacts for activation precondition checks.
  const { data: existing } = await supabase
    .from("campaigns")
    .select("id, status, name, workspace_id, agent_id, total_contacts")
    .eq("id", id)
    .single();
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current = existing as {
    id: string;
    status: CampaignStatus;
    name: string;
    workspace_id: string;
    agent_id: string | null;
    total_contacts: number;
  };

  const parsed = parseBody(PatchCampaignSchema, await req.json());
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  // Validate status transition when status is being changed
  if (body.status && body.status !== current.status) {
    if (!isTransitionAllowed(current.status, body.status)) {
      const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
      return apiError(
        `Cannot transition campaign from '${current.status}' to '${body.status}'. ` +
          `Allowed: ${allowed.length ? allowed.join(", ") : "none"}`,
        422,
      );
    }

    // Activation preconditions: campaign must have an agent and at least one lead
    if (body.status === "active") {
      const agentId = body.agent_id ?? current.agent_id;
      if (!agentId) {
        return apiError(
          "Cannot activate campaign: no agent assigned. Set agent_id first.",
          422,
        );
      }
      if (current.total_contacts < 1) {
        return apiError(
          "Cannot activate campaign: no contacts loaded. Upload leads first.",
          422,
        );
      }

      // Verify workspace is not suspended
      const { data: workspace } = await supabase
        .from("workspaces")
        .select("billing_status")
        .eq("id", current.workspace_id)
        .single();
      if (workspace?.billing_status === "suspended_for_nonpayment") {
        return apiError(
          "Cannot activate campaign: workspace is suspended for non-payment.",
          402,
        );
      }
    }
  }

  // Sanitize configuration if provided
  let configPatch: Record<string, unknown> | undefined;
  if ("configuration" in body) {
    const configResult = sanitizeConfiguration(body.configuration ?? null);
    if (configResult.error) return apiError(configResult.error, 422);
    configPatch = configResult.sanitized;
  }

  const updatePayload = {
    ...body,
    ...(configPatch !== undefined ? { configuration: configPatch } : {}),
  };

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campaigns")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("[campaigns] PATCH error:", error);
    return apiError("Internal server error", 500);
  }

  if (body.status && body.status !== current.status) {
    void writeAuditLog({
      actorId: user.id,
      actorType: "user",
      action: `campaign.${body.status}`,
      targetType: "campaign",
      targetId: id,
      workspaceId: current.workspace_id,
      metadata: {
        campaign_name: current.name,
        from_status: current.status,
        to_status: body.status,
      },
    });
  }

  return apiOk(data);
}
