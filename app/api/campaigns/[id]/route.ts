import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { z } from "zod";
import { apiError, apiOk, parseBody } from "@/lib/api";
import { writeAuditLog } from "@/lib/admin-audit";
import type { CampaignStatus } from "@/lib/supabase/types";

// Valid status transitions: maps from-status → allowed to-statuses
const ALLOWED_TRANSITIONS: Record<CampaignStatus, CampaignStatus[]> = {
  draft: ["active", "scheduled", "paused"],
  scheduled: ["active", "paused", "draft"],
  active: ["paused", "completed"],
  paused: ["active", "completed", "draft"],
  completed: [],
};

const PatchCampaignSchema = z
  .object({
    status: z
      .enum(["draft", "scheduled", "active", "paused", "completed"])
      .optional(),
    name: z.string().min(1).max(100).optional(),
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

  // Verify ownership via RLS before using admin client for writes
  const { data: existing } = await supabase
    .from("campaigns")
    .select("id, status, name, workspace_id")
    .eq("id", id)
    .single();
  if (!existing)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  const current = existing as {
    id: string;
    status: CampaignStatus;
    name: string;
    workspace_id: string;
  };

  const parsed = parseBody(PatchCampaignSchema, await req.json());
  if (!parsed.success) return parsed.response;
  const body = parsed.data;

  // Validate status transition when status is being changed
  if (body.status && body.status !== current.status) {
    const allowed = ALLOWED_TRANSITIONS[current.status] ?? [];
    if (!allowed.includes(body.status)) {
      return apiError(
        `Cannot transition campaign from '${current.status}' to '${body.status}'. ` +
          `Allowed: ${allowed.length ? allowed.join(", ") : "none"}`,
        422,
      );
    }
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("campaigns")
    .update(body)
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
