/**
 * QA Center — Call Review Workflow API
 * PATCH /api/qac/interactions/[id]/review — update review_status + reviewer_notes
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/qac-audit";

const VALID_STATUSES = new Set([
  "pending_review",
  "in_review",
  "reviewed",
  "approved",
  "disputed",
]);

async function resolveWorkspace(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .single();
  if (data) return data as { id: string };
  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  return member ? { id: member.workspace_id } : null;
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

  const ws = await resolveWorkspace(user.id);
  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const body = (await req.json()) as {
    review_status?: string;
    reviewer_notes?: string;
  };

  if (body.review_status && !VALID_STATUSES.has(body.review_status))
    return NextResponse.json(
      { error: "Invalid review_status" },
      { status: 400 },
    );

  const now = new Date().toISOString();
  const update: Record<string, unknown> = {};

  if (body.review_status) {
    update.review_status = body.review_status;

    if (
      body.review_status === "reviewed" ||
      body.review_status === "in_review"
    ) {
      update.reviewed_by = user.id;
      update.reviewed_at = now;
    }
    if (body.review_status === "approved") {
      update.approved_by = user.id;
      update.approved_at = now;
    }
  }
  if (body.reviewer_notes !== undefined) {
    update.reviewer_notes = body.reviewer_notes;
  }

  if (!Object.keys(update).length)
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });

  const admin = createAdminClient();

  // Fetch current status for audit diff
  const { data: current } = await admin
    .from("qac_interactions")
    .select("review_status")
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .single();

  const { data, error } = await admin
    .from("qac_interactions")
    .update(update)
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .select(
      "id, review_status, reviewer_notes, reviewed_by, reviewed_at, approved_by, approved_at",
    )
    .single();

  if (error || !data)
    return NextResponse.json(
      { error: error?.message ?? "Interaction not found" },
      { status: error ? 500 : 404 },
    );

  writeAuditLog({
    workspace_id: ws.id,
    user_id: user.id,
    action: "review_status.change",
    entity_type: "interaction",
    entity_id: id,
    details: {
      from: current?.review_status ?? null,
      to: data.review_status,
    },
  });

  return NextResponse.json(data);
}
