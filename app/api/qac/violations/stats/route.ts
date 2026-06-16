import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

async function resolveWorkspaceId(userId: string): Promise<string | null> {
  const admin = createAdminClient();
  const { data: owned } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .limit(1)
    .maybeSingle();
  if (owned) return (owned as { id: string }).id;

  const { data: member } = await admin
    .from("workspace_members")
    .select("workspace_id")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .limit(1)
    .maybeSingle();
  return member ? (member as { workspace_id: string }).workspace_id : null;
}

export async function GET(_req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = await resolveWorkspaceId(user.id);
  if (!workspaceId)
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_compliance_violations")
    .select("severity, rule_name, qac_interactions!inner(agent_name)")
    .eq("workspace_id", workspaceId)
    .eq("is_false_positive", false)
    .gte("created_at", sevenDaysAgo);

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  type Row = {
    severity: string;
    rule_name: string;
    qac_interactions: { agent_name: string } | { agent_name: string }[] | null;
  };

  const rows = (data ?? []) as unknown as Row[];
  const total = rows.length;
  const critical = rows.filter((r) => r.severity === "critical").length;
  const warning = rows.filter((r) => r.severity === "warning").length;

  function getAgentName(r: Row): string {
    if (!r.qac_interactions) return "Unknown";
    if (Array.isArray(r.qac_interactions)) {
      return r.qac_interactions[0]?.agent_name ?? "Unknown";
    }
    return r.qac_interactions.agent_name ?? "Unknown";
  }

  // Top rules
  const ruleMap = new Map<string, number>();
  for (const r of rows) {
    ruleMap.set(r.rule_name, (ruleMap.get(r.rule_name) ?? 0) + 1);
  }
  const topRules = Array.from(ruleMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([rule_name, count]) => ({ rule_name, count }));

  // Top agents
  const agentMap = new Map<string, number>();
  for (const r of rows) {
    const name = getAgentName(r);
    agentMap.set(name, (agentMap.get(name) ?? 0) + 1);
  }
  const topAgents = Array.from(agentMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([agent_name, count]) => ({ agent_name, count }));

  return NextResponse.json({ total, critical, warning, topRules, topAgents });
}
