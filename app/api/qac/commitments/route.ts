/**
 * QA Center — Follow-up Commitments API
 * GET  /api/qac/commitments  — list workspace commitments (filters: status, customer_id, overdue)
 * PATCH /api/qac/commitments — update commitment status
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
  const status = url.searchParams.get("status");
  const customerId = url.searchParams.get("customer_id");
  const overdue = url.searchParams.get("overdue") === "true";

  const admin = createAdminClient();
  let query = admin
    .from("qac_follow_up_commitments")
    .select(
      "id, interaction_id, customer_id, committed_by, commitment_text, due_date, status, fulfilled_at, created_at, updated_at",
    )
    .eq("workspace_id", ws.id)
    .order("created_at", { ascending: false })
    .limit(100);

  const VALID_STATUSES = new Set(["pending", "fulfilled", "missed", "cancelled"]);
  if (status && VALID_STATUSES.has(status)) {
    query = query.eq("status", status);
  }

  if (customerId) {
    query = query.eq("customer_id", customerId);
  }

  if (overdue) {
    const today = new Date().toISOString().split("T")[0]!;
    query = query
      .eq("status", "pending")
      .lt("due_date", today)
      .not("due_date", "is", null);
  }

  const { data, error } = await query;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ commitments: data ?? [] });
}

export async function PATCH(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = await resolveWorkspace(user.id);
  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  let body: { id: string; status: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { id, status } = body;
  if (!id || typeof id !== "string")
    return NextResponse.json({ error: "id is required" }, { status: 400 });

  const VALID_STATUSES = ["pending", "fulfilled", "missed", "cancelled"];
  if (!status || !VALID_STATUSES.includes(status))
    return NextResponse.json(
      { error: `status must be one of: ${VALID_STATUSES.join(", ")}` },
      { status: 400 },
    );

  const admin = createAdminClient();
  const updates: Record<string, unknown> = { status };
  if (status === "fulfilled") {
    updates.fulfilled_at = new Date().toISOString();
  }

  const { data, error } = await admin
    .from("qac_follow_up_commitments")
    .update(updates)
    .eq("id", id)
    .eq("workspace_id", ws.id)
    .select("id, status, fulfilled_at, updated_at")
    .single();

  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });
  if (!data)
    return NextResponse.json({ error: "Commitment not found" }, { status: 404 });

  return NextResponse.json({ commitment: data });
}
