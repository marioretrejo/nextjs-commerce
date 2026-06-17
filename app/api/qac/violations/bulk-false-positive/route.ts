import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/qac-audit";
import { resolveQacWorkspace } from "@/lib/qac-workspace";

export async function PUT(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = await resolveQacWorkspace(user.id);
  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  let ids: string[] = [];
  let reason: string | null = null;
  try {
    const body = (await req.json()) as { ids?: unknown; reason?: string };
    if (!Array.isArray(body.ids) || body.ids.length === 0)
      return NextResponse.json({ error: "ids array required" }, { status: 400 });
    ids = body.ids.filter((id): id is string => typeof id === "string").slice(0, 100);
    reason = body.reason?.trim() || null;
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (ids.length === 0)
    return NextResponse.json({ error: "No valid IDs provided" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_compliance_violations")
    .update({
      is_false_positive: true,
      reviewed_by: user.id,
      reviewed_at: new Date().toISOString(),
      reviewed_reason: reason,
    })
    .in("id", ids)
    .eq("workspace_id", ws.id)
    .select("id");

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  const updatedIds = (data ?? []).map((r: { id: string }) => r.id);

  // Fire audit logs for each updated violation
  for (const id of updatedIds) {
    writeAuditLog({
      workspace_id: ws.id,
      user_id: user.id,
      action: "violation.false_positive",
      entity_type: "compliance_violation",
      entity_id: id,
      details: reason ? { reason, bulk: true } : { bulk: true },
    });
  }

  return NextResponse.json({ updated: updatedIds.length, ids: updatedIds });
}
