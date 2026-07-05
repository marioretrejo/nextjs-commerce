/**
 * PATCH /api/admin/workspaces/:id/plan
 * Changes the billing plan for a workspace.
 * Body: { plan: 'free' | 'pro' | 'scale' | 'enterprise' }
 * Superadmin only.
 */
import { requireSuperadmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";

type Params = Promise<{ id: string }>;

const VALID_PLANS = ["free", "pro", "scale", "enterprise"] as const;
type Plan = (typeof VALID_PLANS)[number];

export async function PATCH(req: Request, { params }: { params: Params }) {
  const { id: workspaceId } = await params;

  const gate = await requireSuperadmin();
  if (!gate.ok) return gate.response;
  const { admin, user } = gate;

  let body: { plan?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const plan = body.plan as Plan;
  if (!VALID_PLANS.includes(plan)) {
    return NextResponse.json(
      { error: `plan must be one of: ${VALID_PLANS.join(", ")}` },
      { status: 400 },
    );
  }

  const { error } = await admin
    .from("workspaces")
    .update({ plan })
    .eq("id", workspaceId);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  void Promise.resolve(
    admin.from("audit_logs").insert({
      actor_id: user.id,
      action: "plan_changed",
      target_id: workspaceId,
      target_type: "workspace",
      metadata: { plan },
    }),
  ).catch(() => null);

  return NextResponse.json({ ok: true, plan });
}
