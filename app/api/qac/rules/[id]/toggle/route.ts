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

export async function POST(
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

  // Read current state
  const { data: current } = await admin
    .from("qac_rules")
    .select("is_active")
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .single();

  if (!current)
    return NextResponse.json({ error: "Rule not found" }, { status: 404 });

  const rule = current as { is_active: boolean };

  const { data, error } = await admin
    .from("qac_rules")
    .update({ is_active: !rule.is_active })
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .select("id, is_active")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data);
}
