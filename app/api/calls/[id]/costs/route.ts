import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const admin = createAdminClient();

  const { data: call, error: callErr } = await admin
    .from("calls")
    .select("id, workspace_id, cost_usd, cost_breakdown, cost_status")
    .eq("id", id)
    .single();

  if (callErr || !call)
    return NextResponse.json({ error: "Not found" }, { status: 404 });

  // Verify the requesting user owns the workspace this call belongs to
  const { data: ws } = await supabase
    .from("workspaces")
    .select("id")
    .eq("id", (call as { workspace_id: string }).workspace_id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!ws) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  const { data: events } = await admin
    .from("call_cost_events")
    .select(
      "provider, cost_type, quantity, unit, unit_cost_usd, total_cost_usd, currency, pricing_source, metadata, created_at",
    )
    .eq("call_id", id)
    .order("created_at", { ascending: true });

  const callData = call as {
    id: string;
    cost_usd: number;
    cost_breakdown: Record<string, unknown> | null;
    cost_status: string | null;
  };

  return NextResponse.json({
    call_id: id,
    cost_usd: callData.cost_usd,
    cost_status: callData.cost_status ?? "not_calculated",
    cost_breakdown: callData.cost_breakdown ?? null,
    events: events ?? [],
  });
}
