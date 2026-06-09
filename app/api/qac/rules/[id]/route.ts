import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

async function resolveWorkspace(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .single();
  return data as { id: string } | null;
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

  const body = (await req.json()) as Record<string, unknown>;

  const VALID_CATEGORIES = new Set([
    "compliance",
    "quality",
    "disclosure",
    "prohibited",
    "coaching",
  ]);
  const VALID_SEVERITIES = new Set(["low", "medium", "high", "critical"]);

  const update: Record<string, unknown> = {};
  if ("name" in body && typeof body.name === "string")
    update.name = body.name.trim();
  if ("description" in body && typeof body.description === "string")
    update.description = body.description.trim();
  if ("category" in body && VALID_CATEGORIES.has(body.category as string))
    update.category = body.category;
  if ("severity" in body && VALID_SEVERITIES.has(body.severity as string))
    update.severity = body.severity;
  if ("regulation" in body)
    update.regulation = (body.regulation as string)?.trim() || null;
  if ("is_active" in body && typeof body.is_active === "boolean")
    update.is_active = body.is_active;

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_rules")
    .update(update)
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
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

  const admin = createAdminClient();
  const { error } = await admin
    .from("qac_rules")
    .delete()
    .eq("id", id)
    .eq("workspace_id", ws.id);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
