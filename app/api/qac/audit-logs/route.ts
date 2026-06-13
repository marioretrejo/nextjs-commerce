/**
 * QA Center — Audit Log API
 * GET /api/qac/audit-logs — paginated audit trail for workspace admins.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

async function resolveWorkspace(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspace_members")
    .select("workspace_id, role")
    .eq("user_id", userId)
    .in("role", ["owner", "admin"])
    .limit(1)
    .single();
  return data as { workspace_id: string; role: string } | null;
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
    return NextResponse.json(
      { error: "Admin access required" },
      { status: 403 },
    );

  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10));
  const limit = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("limit") ?? "50", 10)),
  );
  const action = url.searchParams.get("action") ?? null;
  const entityType = url.searchParams.get("entity_type") ?? null;
  const userId = url.searchParams.get("user_id") ?? null;
  const from = url.searchParams.get("from") ?? null;
  const to = url.searchParams.get("to") ?? null;

  const admin = createAdminClient();
  let query = admin
    .from("qac_audit_logs")
    .select(
      `id, action, entity_type, entity_id, details, ip_address, created_at,
       user_id`,
      { count: "exact" },
    )
    .eq("workspace_id", ws.workspace_id)
    .order("created_at", { ascending: false })
    .range((page - 1) * limit, page * limit - 1);

  if (action) query = query.eq("action", action);
  if (entityType) query = query.eq("entity_type", entityType);
  if (userId) query = query.eq("user_id", userId);
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
