/**
 * PATCH /api/admin/workspaces/:id/compliance-qa
 * Toggles has_compliance_qa entitlement for a workspace.
 * Body: { enabled: boolean }
 * Superadmin only.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type Params = Promise<{ id: string }>;

export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id: workspaceId } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();
  const { data: profile } = await admin
    .from("users")
    .select("is_superadmin")
    .eq("id", user.id)
    .single();
  if (!(profile as { is_superadmin: boolean } | null)?.is_superadmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

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
