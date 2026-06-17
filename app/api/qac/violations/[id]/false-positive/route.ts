import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/qac-audit";
import { resolveQacWorkspace as resolveWorkspace } from "@/lib/qac-workspace";

export async function PUT(
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

  let reason: string | null = null;
  try {
    const body = (await req.json()) as { reason?: string };
    reason = body.reason?.trim() || null;
  } catch {
    // reason is optional
  }

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_compliance_violations")
    .update({
      is_false_positive: true,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewed_reason: reason,
    })
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .select("id, is_false_positive")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  writeAuditLog({
    workspace_id: ws.id,
    user_id: user.id,
    action: "violation.false_positive",
    entity_type: "compliance_violation",
    entity_id: id,
    details: reason ? { reason } : undefined,
  });

  return NextResponse.json(data);
}
