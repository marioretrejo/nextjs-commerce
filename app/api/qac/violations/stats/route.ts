import { createClient } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { resolveQacWorkspace } from "@/lib/qac-workspace";
import { createAdminClient } from "@/lib/supabase/admin";

export async function GET(_req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = await resolveQacWorkspace(user.id);
  if (!ws)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sevenDaysAgo = new Date(
    Date.now() - 7 * 24 * 60 * 60 * 1000,
  ).toISOString();

  const admin = createAdminClient();

  const baseQuery = () =>
    admin
      .from("qac_compliance_violations")
      .select("*", { count: "exact", head: true })
      .eq("workspace_id", ws.id)
      .eq("is_false_positive", false)
      .gte("created_at", sevenDaysAgo);

  const [
    { count: total },
    { count: critical },
    { count: warning },
    { data: topRowsRaw, error },
  ] = await Promise.all([
    baseQuery(),
    baseQuery().eq("severity", "critical"),
    baseQuery().eq("severity", "warning"),
    // Fetch just the fields needed for top-N aggregation, capped at 500
    admin
      .from("qac_compliance_violations")
      .select("rule_name, severity, qac_interactions!inner(agent_name)")
      .eq("workspace_id", ws.id)
      .eq("is_false_positive", false)
      .gte("created_at", sevenDaysAgo)
      .limit(500),
  ]);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    rule_name: string;
    severity: string;
    qac_interactions: { agent_name: string } | { agent_name: string }[] | null;
  };

  const rows = (topRowsRaw ?? []) as unknown as Row[];

  function getAgentName(r: Row): string {
    if (!r.qac_interactions) return "Unknown";
    if (Array.isArray(r.qac_interactions))
      return r.qac_interactions[0]?.agent_name ?? "Unknown";
    return r.qac_interactions.agent_name ?? "Unknown";
  }

  const ruleMap = new Map<string, number>();
  const agentMap = new Map<string, number>();
  for (const r of rows) {
    ruleMap.set(r.rule_name, (ruleMap.get(r.rule_name) ?? 0) + 1);
    const name = getAgentName(r);
    agentMap.set(name, (agentMap.get(name) ?? 0) + 1);
  }

  const topRules = Array.from(ruleMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([rule_name, count]) => ({ rule_name, count }));

  const topAgents = Array.from(agentMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([agent_name, count]) => ({ agent_name, count }));

  return NextResponse.json({
    total: total ?? 0,
    critical: critical ?? 0,
    warning: warning ?? 0,
    topRules,
    topAgents,
  });
}
