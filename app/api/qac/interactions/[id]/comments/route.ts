/**
 * QA Center — Call Review Comments API
 * GET  /api/qac/interactions/[id]/comments — list QA comments
 * POST /api/qac/interactions/[id]/comments — add a QA comment
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/qac-audit";

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

export async function GET(
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

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_review_comments")
    .select("id, comment, user_id, created_at, updated_at")
    .eq("interaction_id", id)
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}

export async function POST(
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

  const body = (await req.json()) as { comment: string };
  const comment = body.comment?.trim();

  if (!comment)
    return NextResponse.json({ error: "comment is required" }, { status: 400 });
  if (comment.length > 2000)
    return NextResponse.json(
      { error: "comment must be ≤ 2000 characters" },
      { status: 400 },
    );

  const admin = createAdminClient();

  // Verify interaction belongs to workspace
  const { data: interaction } = await admin
    .from("qac_interactions")
    .select("id")
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .single();

  if (!interaction)
    return NextResponse.json(
      { error: "Interaction not found" },
      { status: 404 },
    );

  const { data, error } = await admin
    .from("qac_review_comments")
    .insert({
      workspace_id: ws.id,
      interaction_id: id,
      user_id: user.id,
      comment,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  writeAuditLog({
    workspace_id: ws.id,
    user_id: user.id,
    action: "comment.create",
    entity_type: "review_comment",
    entity_id: data.id,
    details: { interaction_id: id },
  });

  return NextResponse.json(data, { status: 201 });
}
