/**
 * PATCH /api/admin/workspaces/:id/compliance-qa
 * Toggles has_compliance_qa entitlement for a workspace.
 * Body: { enabled: boolean }
 * Superadmin only.
 */
import { requireSuperadmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id: workspaceId } = await params;

  const gate = await requireSuperadmin();
  if (!gate.ok) return gate.response;
  const { admin, user } = gate;

  let body: { enabled?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body.enabled !== "boolean") {
    return NextResponse.json(
      { error: "enabled must be a boolean" },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("workspaces")
    .update({ has_compliance_qa: body.enabled })
    .eq("id", workspaceId);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  void Promise.resolve(
    admin.from("audit_logs").insert({
      actor_id: user.id,
      action: body.enabled ? "compliance_qa_enabled" : "compliance_qa_disabled",
      target_id: workspaceId,
      target_type: "workspace",
      metadata: { has_compliance_qa: body.enabled },
    }),
  ).catch(() => null);

  return NextResponse.json({ ok: true, has_compliance_qa: body.enabled });
}
