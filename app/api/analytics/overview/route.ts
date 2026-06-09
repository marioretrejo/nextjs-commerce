/**
 * Analytics Overview Endpoint — GET /api/analytics/overview
 *
 * Aggregates call-level metrics for a workspace over a date range.
 * Auth: session cookie (same as all app-facing routes).
 *
 * Query params:
 *   start_date  — ISO 8601 date (inclusive), e.g. "2025-01-01"
 *   end_date    — ISO 8601 date (inclusive), e.g. "2025-01-31"
 *   agent_id    — optional UUID to filter to a single agent
 */
import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { computeCallAnalytics, type CallRow } from "@/lib/analytics/compute";

async function getWorkspace(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspaces")
    .select("id")
    .eq("owner_id", userId)
    .single();
  return data as { id: string } | null;
}

export async function GET(req: Request) {
  // ── Auth ─────────────────────────────────────────────────────────────────────
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspace = await getWorkspace(user.id);
  if (!workspace)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  // ── Query params ─────────────────────────────────────────────────────────────
  const url = new URL(req.url);
  const startDate = url.searchParams.get("start_date");
  const endDate = url.searchParams.get("end_date");
  const agentId = url.searchParams.get("agent_id");

  // Validate date format — must be YYYY-MM-DD when provided
  const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
  if (startDate && !DATE_RE.test(startDate))
    return NextResponse.json(
      { error: "Invalid start_date: expected YYYY-MM-DD" },
      { status: 400 },
    );
  if (endDate && !DATE_RE.test(endDate))
    return NextResponse.json(
      { error: "Invalid end_date: expected YYYY-MM-DD" },
      { status: 400 },
    );

  // ── Fetch calls ──────────────────────────────────────────────────────────────
  const admin = createAdminClient();
  let query = admin
    .from("calls")
    .select(
      "id, duration_seconds, cost_usd, cost_breakdown, cost_status, business_outcome, technical_status, end_reason",
    )
    .eq("workspace_id", workspace.id)
    // Hard cap: callers should supply a date range in production.
    .limit(2000)
    .order("created_at", { ascending: false });

  if (startDate) query = query.gte("created_at", startDate);
  if (endDate) query = query.lte("created_at", endDate + "T23:59:59.999Z");
  if (agentId) query = query.eq("agent_id", agentId);

  const { data: calls, error } = await query;
  if (error) {
    console.error("[analytics/overview] query error:", error.message);
    return NextResponse.json({ error: "Query failed" }, { status: 500 });
  }

  const result = computeCallAnalytics(
    (calls ?? []) as CallRow[],
    workspace.id,
    startDate,
    endDate,
  );

  return NextResponse.json(result);
}
