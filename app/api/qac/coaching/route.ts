/**
 * QA Center — Coaching Reports List API
 * GET /api/qac/coaching — list coaching reports with filters
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

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
  const agentId = url.searchParams.get("agent_id") ?? null;
  const minPriority = parseInt(url.searchParams.get("min_priority") ?? "0", 10);
  const from = url.searchParams.get("from") ?? null;
  const to = url.searchParams.get("to") ?? null;
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "25", 10)),
  );

  const admin = createAdminClient();
  let query = admin
    .from("qac_coaching_reports")
    .select(
      `id, agent_id, priority_score, coaching_plan,
       strengths, weaknesses, opportunities, recommended_training, created_at,
       interaction_id,
       qac_interactions!inner(agent_name, created_at, channel, risk_level)`,
      { count: "exact" },
    )
    .eq("workspace_id", ws.id)
    .gte("priority_score", minPriority)
    .order("priority_score", { ascending: false })
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (agentId) query = query.eq("agent_id", agentId);
  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error, count } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({
    data: data ?? [],
    total: count ?? 0,
    page,
    limit,
    pages: Math.ceil((count ?? 0) / limit),
  });
}
