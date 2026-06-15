/**
 * QA Center — Department Extensions API
 * GET    /api/qac/departments/[id]/extensions  — list extensions for a department
 * POST   /api/qac/departments/[id]/extensions  — add an extension (owner/admin only)
 * DELETE /api/qac/departments/[id]/extensions  — remove an extension (owner/admin only)
 *                                                body: { agent_extension: string }
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

// ─── Workspace + role resolver ────────────────────────────────────────────────

async function resolveWorkspace(
  userId: string,
): Promise<{ id: string; role: string } | null> {
  const admin = createAdminClient();

  const { data: owned } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .single();
  if (owned) return { id: (owned as { id: string }).id, role: "owner" };

  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .limit(1)
    .single();
  if (member) {
    return {
      id: (member as { workspace_id: string; role: string }).workspace_id,
      role: (member as { workspace_id: string; role: string }).role,
    };
  }

  return null;
}

// ─── Verify department belongs to workspace ───────────────────────────────────

async function verifyDepartment(
  departmentId: string,
  workspaceId: string,
): Promise<boolean> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("qac_departments")
    .select("id")
    .eq("id", departmentId)
    .eq("workspace_id", workspaceId)
    .single();
  return !!data;
}

// ─── GET /api/qac/departments/[id]/extensions ────────────────────────────────

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

  const ws = await resolveWorkspace(user.id);
  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const exists = await verifyDepartment(id, ws.id);
  if (!exists)
    return NextResponse.json({ error: "Department not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_department_extensions")
    .select("id, agent_extension, agent_name, created_at")
    .eq("department_id", id)
    .eq("workspace_id", ws.id)
    .order("agent_extension", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ extensions: data ?? [] });
}

// ─── POST /api/qac/departments/[id]/extensions ───────────────────────────────

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

  if (!["owner", "admin"].includes(ws.role)) {
    return NextResponse.json(
      { error: "Only workspace owners and admins can manage extensions" },
      { status: 403 },
    );
  }

  const exists = await verifyDepartment(id, ws.id);
  if (!exists)
    return NextResponse.json({ error: "Department not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agentExtension = body["agent_extension"];
  if (
    !agentExtension ||
    typeof agentExtension !== "string" ||
    agentExtension.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "agent_extension is required and must be a non-empty string" },
      { status: 400 },
    );
  }
  if (agentExtension.trim().length > 50) {
    return NextResponse.json(
      { error: "agent_extension must be 50 characters or fewer" },
      { status: 400 },
    );
  }

  const agentName =
    typeof body["agent_name"] === "string"
      ? body["agent_name"].trim() || null
      : null;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_department_extensions")
    .insert({
      workspace_id: ws.id,
      department_id: id,
      agent_extension: agentExtension.trim(),
      agent_name: agentName,
    })
    .select("id, agent_extension, agent_name, created_at")
    .single();

  if (error) {
    if (error.code === "23505") {
      return NextResponse.json(
        {
          error: `Extension "${agentExtension.trim()}" is already assigned to a department in this workspace`,
        },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ extension: data }, { status: 201 });
}

// ─── DELETE /api/qac/departments/[id]/extensions ─────────────────────────────
// Body: { agent_extension: string }

export async function DELETE(
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

  if (!["owner", "admin"].includes(ws.role)) {
    return NextResponse.json(
      { error: "Only workspace owners and admins can manage extensions" },
      { status: 403 },
    );
  }

  const exists = await verifyDepartment(id, ws.id);
  if (!exists)
    return NextResponse.json({ error: "Department not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const agentExtension = body["agent_extension"];
  if (
    !agentExtension ||
    typeof agentExtension !== "string" ||
    agentExtension.trim().length === 0
  ) {
    return NextResponse.json(
      { error: "agent_extension is required" },
      { status: 400 },
    );
  }

  const admin = createAdminClient();
  const { error, count } = await admin
    .from("qac_department_extensions")
    .delete({ count: "exact" })
    .eq("workspace_id", ws.id)
    .eq("department_id", id)
    .eq("agent_extension", agentExtension.trim());

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!count || count === 0)
    return NextResponse.json({ error: "Extension not found" }, { status: 404 });

  return NextResponse.json({ deleted: true, agent_extension: agentExtension.trim() });
}
