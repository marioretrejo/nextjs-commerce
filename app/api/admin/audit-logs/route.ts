/**
 * GET /api/admin/audit-logs
 * Params: workspace_id, action, action_prefix, search, limit, offset
 * Superadmin only.
 */
import { requireSuperadmin } from "@/lib/admin/guard";
import { NextResponse } from "next/server";

export async function GET(req: Request) {
  const gate = await requireSuperadmin();
  if (!gate.ok) return gate.response;
  const { admin } = gate;

  const url = new URL(req.url);
  const wsId = url.searchParams.get("workspace_id");
  const action = url.searchParams.get("action");
  const actionPrefix = url.searchParams.get("action_prefix");
  const limit = Math.min(Number(url.searchParams.get("limit") ?? 50), 200);
  const offset = Number(url.searchParams.get("offset") ?? 0);

  let q = admin
    .from("audit_logs")
    .select("*, actor:actor_id(id, name, email)", { count: "exact" })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (wsId) q = q.eq("workspace_id", wsId);
  if (action) q = q.eq("action", action);
  if (actionPrefix) q = q.like("action", `${actionPrefix}.%`);

  const { data, count, error } = await q;
  if (error)
    return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ logs: data ?? [], total: count ?? 0 });
}
