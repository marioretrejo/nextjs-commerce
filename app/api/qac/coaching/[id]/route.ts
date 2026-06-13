/**
 * QA Center — Coaching Report Detail API
 * GET /api/qac/coaching/[id] — full report + interaction + agent profile
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/qac-audit";

async function resolveWorkspace(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .single();
  if (data) return data as { id: string };
  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .limit(1)
    .single();
  return member ? { id: member.workspace_id } : null;
}

export async function GET(
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

  const admin = createAdminClient();

  const { data: report, error } = await admin
    .from("qac_coaching_reports")
    .select(
      `*, qac_interactions(
        id, agent_name, agent_id, channel, duration_s, created_at,
        risk_level, customer_name, review_status,
        qac_evaluations(overall_score, compliance_score, sales_score,
                         soft_skills_score, summary, coaching_summary)
      )`,
    )
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .single();

  if (error || !report)
    return NextResponse.json(
      { error: "Coaching report not found" },
      { status: 404 },
    );

  // Attach agent profile if available
  let agentProfile = null;
  if (report.agent_id) {
    const { data: ap } = await admin
      .from("qac_agent_profiles")
      .select("id, name, email, team, role, is_active")
      .eq("workspace_id", ws.id)
      .eq("agent_id", report.agent_id)
      .single();
    agentProfile = ap ?? null;
  }

  writeAuditLog({
    workspace_id: ws.id,
    user_id: user.id,
    action: "coaching_report.view",
    entity_type: "coaching_report",
    entity_id: id,
  });

  return NextResponse.json({ ...report, agent_profile: agentProfile });
}
