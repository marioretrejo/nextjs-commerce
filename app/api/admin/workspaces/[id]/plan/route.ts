/**
 * PATCH /api/admin/workspaces/:id/plan
 * Changes the billing plan for a workspace.
 * Body: { plan: 'free' | 'pro' | 'scale' | 'enterprise' }
 * Superadmin only.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

type Params = Promise<{ id: string }>;

const VALID_PLANS = ["free", "pro", "scale", "enterprise"] as const;
type Plan = (typeof VALID_PLANS)[number];

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
