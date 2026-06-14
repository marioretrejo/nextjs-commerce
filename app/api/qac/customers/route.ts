/**
 * QA Center — Customer Memory List API
 * GET /api/qac/customers — list customers with optional search and pagination
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { listCustomers } from "@/lib/qac-customer";

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
  const search = url.searchParams.get("search") ?? undefined;
  const limit = Math.min(Number(url.searchParams.get("limit") ?? "20"), 100);
  const page = Math.max(1, Number(url.searchParams.get("page") ?? "1"));
  const offset = url.searchParams.has("offset")
    ? Number(url.searchParams.get("offset"))
    : (page - 1) * limit;

  const result = await listCustomers({ workspace_id: ws.id, search, limit, offset });

  return NextResponse.json({
    data: result.data,
    total: result.total,
    page,
    pages: Math.ceil(result.total / limit),
    limit,
    offset,
  });
}
