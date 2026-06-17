/**
 * QA Center — Rules API
 * Own rules engine, separate from compliance_rules.
 * qac_rules include regulation references (FDCPA, TCPA, GDPR…)
 * and map to the 5 QA dimensions (opening, compliance, objection_handling, closing, empathy).
 * v2: adds scope, department_id, alert_severity, examples, counter_examples, sort_order
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { writeAuditLog } from "@/lib/qac-audit";
import { resolveQacWorkspace as resolveWorkspace } from "@/lib/qac-workspace";

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

  const { searchParams } = new URL(req.url);
  const scope = searchParams.get("scope"); // 'global' | 'department'
  const departmentId = searchParams.get("department_id");

  const admin = createAdminClient();
  let query = admin
    .from("qac_rules")
    .select("*")
    .eq("workspace_id", ws.id)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: false });

  if (scope === "global") {
    query = query.eq("scope", "global");
  } else if (scope === "department") {
    query = query.eq("scope", "department");
    if (departmentId) {
      query = query.eq("department_id", departmentId);
    }
  }

  const { data, error } = await query;

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data ?? []);
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
    name: string;
    description: string;
    category?: string;
    severity?: string;
    regulation?: string;
    scope?: string;
    department_id?: string | null;
    alert_severity?: string;
    examples?: string[];
    counter_examples?: string[];
    sort_order?: number;
    is_active?: boolean;
  };

  if (!body.name?.trim())
    return NextResponse.json({ error: "name is required" }, { status: 400 });
  if (!body.description?.trim())
    return NextResponse.json(
      { error: "description is required" },
      { status: 400 },
    );

  const VALID_CATEGORIES = new Set([
    "compliance",
    "quality",
    "disclosure",
    "prohibited",
    "coaching",
  ]);
  const VALID_SEVERITIES = new Set(["low", "medium", "high", "critical"]);
  const VALID_SCOPES = new Set(["global", "department"]);
  const VALID_ALERT_SEVERITIES = new Set(["critical", "warning"]);

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_rules")
    .insert({
      workspace_id: ws.id,
      name: body.name.trim(),
      description: body.description.trim(),
      category: VALID_CATEGORIES.has(body.category ?? "")
        ? body.category
        : "quality",
      severity: VALID_SEVERITIES.has(body.severity ?? "")
        ? body.severity
        : "medium",
      regulation: body.regulation?.trim() || null,
      scope: VALID_SCOPES.has(body.scope ?? "") ? body.scope : "department",
      department_id: body.department_id ?? null,
      alert_severity: VALID_ALERT_SEVERITIES.has(body.alert_severity ?? "")
        ? body.alert_severity
        : "warning",
      examples: Array.isArray(body.examples)
        ? body.examples.filter((e) => typeof e === "string" && e.trim())
        : [],
      counter_examples: Array.isArray(body.counter_examples)
        ? body.counter_examples.filter((e) => typeof e === "string" && e.trim())
        : [],
      sort_order: typeof body.sort_order === "number" ? body.sort_order : 0,
      is_active: body.is_active !== false,
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  writeAuditLog({
    workspace_id: ws.id,
    user_id: user.id,
    action: "rule.create",
    entity_type: "rule",
    entity_id: data.id,
    details: { name: data.name, scope: data.scope },
  });

  return NextResponse.json(data, { status: 201 });
}
