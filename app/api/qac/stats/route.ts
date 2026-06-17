import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { resolveQacWorkspace } from "@/lib/qac-workspace";

export async function GET() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = await resolveQacWorkspace(user.id);
  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const admin = createAdminClient();

  const [
    { count: totalInteractions },
    { count: analyzedInteractions },
    { count: pendingInteractions },
    { data: evaluations },
    { data: flags },
    { data: agentStats },
  ] = await Promise.all([
    admin
      .from("qac_interactions")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", ws.id),
    admin
      .from("qac_interactions")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", ws.id)
      .eq("status", "analyzed"),
    admin
      .from("qac_interactions")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", ws.id)
      .in("status", ["pending", "failed"]),
    admin
      .from("qac_evaluations")
      .select("overall_score, risk_score")
      .eq("workspace_id", ws.id),
    admin
      .from("qac_flags")
      .select("severity, category")
      .eq("workspace_id", ws.id),
    // Top 5 agents by avg risk score
    admin
      .from("qac_evaluations")
      .select(
        `
      risk_score,
      qac_interactions!inner ( agent_name )
    `,
      )
      .eq("workspace_id", ws.id),
  ]);

  const evals = (evaluations ?? []) as {
    overall_score: number;
    risk_score: number;
  }[];
  const avgOverallScore =
    evals.length > 0
      ? Math.round(
          evals.reduce((s, e) => s + Number(e.overall_score), 0) / evals.length,
        )
      : null;
  const avgRiskScore =
    evals.length > 0
      ? Math.round(
          evals.reduce((s, e) => s + Number(e.risk_score), 0) / evals.length,
        )
      : null;
  const complianceRate =
    evals.length > 0
      ? Math.round(
          (evals.filter((e) => Number(e.risk_score) < 30).length /
            evals.length) *
            100,
        )
      : null;

  const allFlags = (flags ?? []) as { severity: string; category: string }[];
  const flagsBySeverity = {
    low: allFlags.filter((f) => f.severity === "low").length,
    medium: allFlags.filter((f) => f.severity === "medium").length,
    high: allFlags.filter((f) => f.severity === "high").length,
    critical: allFlags.filter((f) => f.severity === "critical").length,
  };
  const flagsByCategory = {
    compliance: allFlags.filter((f) => f.category === "compliance").length,
    quality: allFlags.filter((f) => f.category === "quality").length,
    disclosure: allFlags.filter((f) => f.category === "disclosure").length,
    prohibited: allFlags.filter((f) => f.category === "prohibited").length,
    coaching: allFlags.filter((f) => f.category === "coaching").length,
  };

  // Agent leaderboard (top risk agents)
  type EvalWithAgent = {
    risk_score: number;
    qac_interactions: { agent_name: string }[];
  };
  const evalWithAgents = (agentStats ?? []) as unknown as EvalWithAgent[];
  const agentMap: Record<
    string,
    { name: string; total: number; risk_sum: number; flags: number }
  > = {};
  for (const e of evalWithAgents) {
    const name = e.qac_interactions?.[0]?.agent_name ?? "Unknown";
    if (!agentMap[name])
      agentMap[name] = { name, total: 0, risk_sum: 0, flags: 0 };
    agentMap[name].total++;
    agentMap[name].risk_sum += Number(e.risk_score);
  }
  const topRiskAgents = Object.values(agentMap)
    .map((a) => ({
      name: a.name,
      interactions: a.total,
      avg_risk: Math.round(a.risk_sum / a.total),
    }))
    .sort((a, b) => b.avg_risk - a.avg_risk)
    .slice(0, 5);

  return NextResponse.json({
    totalInteractions: totalInteractions ?? 0,
    analyzedInteractions: analyzedInteractions ?? 0,
    pendingInteractions: pendingInteractions ?? 0,
    avgOverallScore,
    avgRiskScore,
    complianceRate,
    totalFlags: allFlags.length,
    flagsBySeverity,
    flagsByCategory,
    topRiskAgents,
  });
}
