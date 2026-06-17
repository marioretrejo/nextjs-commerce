import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/qac-audit";
import { resolveQacWorkspace as resolveWorkspace } from "@/lib/qac-workspace";

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
  const VALID_SCOPES = new Set(["global", "department"]);
  const VALID_ALERT_SEVERITIES = new Set(["critical", "warning"]);

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
  if ("scope" in body && VALID_SCOPES.has(body.scope as string))
    update.scope = body.scope;
  if ("department_id" in body)
    update.department_id = body.department_id ?? null;
  if (
    "alert_severity" in body &&
    VALID_ALERT_SEVERITIES.has(body.alert_severity as string)
  )
    update.alert_severity = body.alert_severity;
  if ("examples" in body && Array.isArray(body.examples))
    update.examples = (body.examples as unknown[]).filter(
      (e) => typeof e === "string",
    );
  if ("counter_examples" in body && Array.isArray(body.counter_examples))
    update.counter_examples = (body.counter_examples as unknown[]).filter(
      (e) => typeof e === "string",
    );
  if ("sort_order" in body && typeof body.sort_order === "number")
    update.sort_order = body.sort_order;

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

  writeAuditLog({
    workspace_id: ws.id,
    user_id: user.id,
    action: "rule.update",
    entity_type: "rule",
    entity_id: id,
    details: { fields: Object.keys(update) },
  });

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

  writeAuditLog({
    workspace_id: ws.id,
    user_id: user.id,
    action: "rule.delete",
    entity_type: "rule",
    entity_id: id,
  });

  return NextResponse.json({ ok: true });
}
