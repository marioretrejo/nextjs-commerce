/**
 * QA Center — Agent Profiles API
 * GET  /api/qac/agents — list agents with computed metrics
 * POST /api/qac/agents — create agent profile
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

export async function GET(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = await resolveWorkspace(user.id);
  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const url = new URL(req.url);
  const activeOnly = url.searchParams.get("active") !== "false";
  const team = url.searchParams.get("team") ?? null;

  const admin = createAdminClient();

  // Fetch agents
  let agentQuery = admin
    .from("qac_agent_profiles")
    .select("*")
    .eq("workspace_id", ws.id)
    .order("name");
  if (activeOnly) agentQuery = agentQuery.eq("is_active", true);
  if (team) agentQuery = agentQuery.eq("team", team);

  const { data: agents, error: agentErr } = await agentQuery;
  if (agentErr)
    return NextResponse.json({ error: agentErr.message }, { status: 500 });
  if (!agents?.length) return NextResponse.json([]);

  // Compute metrics per agent_id from interactions + evaluations
  const agentIds = agents.map((a) => a.agent_id).filter(Boolean);

  const { data: metrics } = await admin
    .from("qac_interactions")
    .select(
      `agent_id,
       created_at,
       qac_evaluations!inner(
         overall_score, compliance_score, sales_score,
         soft_skills_score, risk_score
       )`,
    )
    .eq("workspace_id", ws.id)
    .in("agent_id", agentIds)
    .eq("status", "analyzed");

  // Aggregate metrics per agent
  type AgentStats = {
    call_count: number;
    avg_score: number;
    avg_compliance: number;
    avg_sales: number;
    avg_soft_skills: number;
    avg_risk: number;
    last_call_at: string | null;
    improvement_trend: "up" | "down" | "stable";
  };

  const statsMap = new Map<string, AgentStats>();

  if (metrics) {
    // Group by agent_id
    const grouped = new Map<string, typeof metrics>();
    for (const row of metrics) {
      if (!row.agent_id) continue;
      if (!grouped.has(row.agent_id)) grouped.set(row.agent_id, []);
      grouped.get(row.agent_id)!.push(row);
    }

    for (const [agentId, rows] of grouped) {
      const evals = rows
        .flatMap((r) => {
          const ev = r.qac_evaluations;
          return Array.isArray(ev) ? ev : ev ? [ev] : [];
        })
        .filter(Boolean);

      const avg = (arr: (number | null)[]) => {
        const nums = arr.filter((v): v is number => v != null);
        return nums.length ? Math.round(nums.reduce((s, v) => s + v, 0) / nums.length) : 0;
      };

      // Sort by created_at for trend
      const sorted = [...rows].sort(
        (a, b) =>
          new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
      );
      const recentHalf = sorted.slice(Math.floor(sorted.length / 2));
      const oldHalf = sorted.slice(0, Math.floor(sorted.length / 2));

      const recentEvs = recentHalf.flatMap((r) => {
        const ev = r.qac_evaluations;
        return Array.isArray(ev) ? ev : ev ? [ev] : [];
      });
      const oldEvs = oldHalf.flatMap((r) => {
        const ev = r.qac_evaluations;
        return Array.isArray(ev) ? ev : ev ? [ev] : [];
      });

      const recentAvg = avg(recentEvs.map((e: { overall_score: number }) => e.overall_score));
      const oldAvg = avg(oldEvs.map((e: { overall_score: number }) => e.overall_score));
      const diff = recentAvg - oldAvg;
      const trend: "up" | "down" | "stable" =
        diff >= 3 ? "up" : diff <= -3 ? "down" : "stable";

      statsMap.set(agentId, {
        call_count: rows.length,
        avg_score: avg(evals.map((e: { overall_score: number }) => e.overall_score)),
        avg_compliance: avg(evals.map((e: { compliance_score: number | null }) => e.compliance_score)),
        avg_sales: avg(evals.map((e: { sales_score: number | null }) => e.sales_score)),
        avg_soft_skills: avg(evals.map((e: { soft_skills_score: number | null }) => e.soft_skills_score)),
        avg_risk: avg(evals.map((e: { risk_score: number }) => e.risk_score)),
        last_call_at: sorted[sorted.length - 1]?.created_at ?? null,
        improvement_trend: trend,
      });
    }
  }

  const result = agents.map((a) => ({
    ...a,
    metrics: statsMap.get(a.agent_id) ?? {
      call_count: 0,
      avg_score: 0,
      avg_compliance: 0,
      avg_sales: 0,
      avg_soft_skills: 0,
      avg_risk: 0,
      last_call_at: null,
      improvement_trend: "stable" as const,
    },
  }));

  return NextResponse.json(result);
}

export async function POST(req: Request) {
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
    agent_id: string;
    name: string;
    email?: string;
    team?: string;
    role?: string;
    hire_date?: string;
    metadata?: Record<string, unknown>;
  };

  if (!body.agent_id?.trim())
    return NextResponse.json({ error: "agent_id is required" }, { status: 400 });
  if (!body.name?.trim())
    return NextResponse.json({ error: "name is required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_agent_profiles")
    .insert({
      workspace_id: ws.id,
      agent_id: body.agent_id.trim(),
      name: body.name.trim(),
      email: body.email?.trim() || null,
      team: body.team?.trim() || null,
      role: body.role?.trim() || null,
      hire_date: body.hire_date || null,
      metadata: body.metadata ?? null,
    })
    .select()
    .single();

  if (error) {
    if (error.code === "23505")
      return NextResponse.json(
        { error: "An agent with this ID already exists" },
        { status: 409 },
      );
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  writeAuditLog({
    workspace_id: ws.id,
    user_id: user.id,
    action: "agent.create",
    entity_type: "agent",
    entity_id: data.id,
    details: { agent_id: body.agent_id, name: body.name },
  });

  return NextResponse.json(data, { status: 201 });
}
