/**
 * QA Center — Agent Profile Detail API
 * GET    /api/qac/agents/[id] — profile + call history + metrics + coaching
 * PATCH  /api/qac/agents/[id] — update profile fields
 * DELETE /api/qac/agents/[id] — soft-delete (is_active = false)
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

  // Fetch profile
  const { data: profile, error: profileErr } = await admin
    .from("qac_agent_profiles")
    .select("*")
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .single();

  if (profileErr || !profile)
    return NextResponse.json({ error: "Agent not found" }, { status: 404 });

  // Fetch call history (most recent 50)
  const { data: interactions } = await admin
    .from("qac_interactions")
    .select(
      `id, created_at, channel, status, review_status, risk_level, duration_s, customer_name,
       qac_evaluations(overall_score, compliance_score, sales_score, soft_skills_score, risk_score, summary)`,
    )
    .eq("workspace_id", ws.id)
    .eq("agent_id", profile.agent_id)
    .order("created_at", { ascending: false })
    .limit(50);

  // Fetch coaching reports
  const { data: coaching } = await admin
    .from("qac_coaching_reports")
    .select("*")
    .eq("workspace_id", ws.id)
    .eq("agent_id", profile.agent_id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Aggregate metrics
  const evals = (interactions ?? []).flatMap((i) => {
    const ev = i.qac_evaluations;
    return Array.isArray(ev) ? ev : ev ? [ev] : [];
  });

  const avg = (arr: (number | null | undefined)[]) => {
    const nums = arr.filter((v): v is number => v != null);
    return nums.length
      ? Math.round(nums.reduce((s, v) => s + v, 0) / nums.length)
      : 0;
  };

  // Score trend: split into 4 quartiles to show progression
  const scoreTrend = (interactions ?? [])
    .filter((i) => i.status === "analyzed")
    .sort(
      (a, b) =>
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
    )
    .map((i) => {
      const ev = Array.isArray(i.qac_evaluations)
        ? i.qac_evaluations[0]
        : i.qac_evaluations;
      return {
        date: i.created_at,
        score: (ev as { overall_score?: number } | null)?.overall_score ?? null,
      };
    })
    .filter((p) => p.score != null);

  writeAuditLog({
    workspace_id: ws.id,
    user_id: user.id,
    action: "agent.view",
    entity_type: "agent",
    entity_id: id,
  });

  return NextResponse.json({
    profile,
    metrics: {
      call_count: interactions?.length ?? 0,
      avg_score: avg(
        evals.map((e) => (e as { overall_score?: number }).overall_score),
      ),
      avg_compliance: avg(
        evals.map(
          (e) => (e as { compliance_score?: number | null }).compliance_score,
        ),
      ),
      avg_sales: avg(
        evals.map((e) => (e as { sales_score?: number | null }).sales_score),
      ),
      avg_soft_skills: avg(
        evals.map(
          (e) => (e as { soft_skills_score?: number | null }).soft_skills_score,
        ),
      ),
      avg_risk: avg(
        evals.map((e) => (e as { risk_score?: number }).risk_score),
      ),
      score_trend: scoreTrend,
    },
    interactions: interactions ?? [],
    coaching: coaching ?? [],
  });
}

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

  const body = (await req.json()) as {
    name?: string;
    email?: string;
    team?: string;
    role?: string;
    hire_date?: string;
    is_active?: boolean;
    metadata?: Record<string, unknown>;
  };

  const update: Record<string, unknown> = {};
  if (body.name !== undefined) update.name = body.name.trim();
  if (body.email !== undefined) update.email = body.email?.trim() || null;
  if (body.team !== undefined) update.team = body.team?.trim() || null;
  if (body.role !== undefined) update.role = body.role?.trim() || null;
  if (body.hire_date !== undefined) update.hire_date = body.hire_date || null;
  if (body.is_active !== undefined) update.is_active = body.is_active;
  if (body.metadata !== undefined) update.metadata = body.metadata;

  if (!Object.keys(update).length)
    return NextResponse.json({ error: "No fields to update" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_agent_profiles")
    .update(update)
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .select()
    .single();

  if (error || !data)
    return NextResponse.json(
      { error: error?.message ?? "Agent not found" },
      { status: error ? 500 : 404 },
    );

  writeAuditLog({
    workspace_id: ws.id,
    user_id: user.id,
    action: "agent.update",
    entity_type: "agent",
    entity_id: id,
    details: { fields: Object.keys(update) },
  });

  return NextResponse.json(data);
}

export async function DELETE(
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
  const { data, error } = await admin
    .from("qac_agent_profiles")
    .update({ is_active: false })
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .select("id, name, agent_id")
    .single();

  if (error || !data)
    return NextResponse.json(
      { error: error?.message ?? "Agent not found" },
      { status: error ? 500 : 404 },
    );

  writeAuditLog({
    workspace_id: ws.id,
    user_id: user.id,
    action: "agent.deactivate",
    entity_type: "agent",
    entity_id: id,
    details: { name: data.name, agent_id: data.agent_id },
  });

  return NextResponse.json({ success: true });
}
