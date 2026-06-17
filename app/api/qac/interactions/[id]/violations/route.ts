import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { resolveQacWorkspace as resolveWorkspace } from "@/lib/qac-workspace";

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
  if (!ws.has_compliance_qa)
    return NextResponse.json({ error: "Compliance module not enabled" }, { status: 403 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_compliance_violations")
    .select("*")
    .eq("interaction_id", id)
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: true });

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json(data ?? []);
}
