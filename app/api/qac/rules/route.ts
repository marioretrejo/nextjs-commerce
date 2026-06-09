/**
 * QA Center — Rules API
 * Own rules engine, separate from compliance_rules.
 * qac_rules include regulation references (FDCPA, TCPA, GDPR…)
 * and map to the 5 QA dimensions (opening, compliance, objection_handling, closing, empathy).
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
  return data as { id: string } | null;
}

export async function GET() {
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
    .from("qac_rules")
    .select("*")
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: false });

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
    })
    .select()
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data, { status: 201 });
}
