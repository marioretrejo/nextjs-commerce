/**
 * QA Center — Customer Memory Detail API
 * GET /api/qac/customers/[id] — full customer profile with recent interactions, journey, and insights
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getCustomerById } from "@/lib/qac-customer";

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

export async function GET(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ws = await resolveWorkspace(user.id);
  if (!ws)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const customer = await getCustomerById(ws.id, id);
  if (!customer)
    return NextResponse.json({ error: "Customer not found" }, { status: 404 });

  const admin = createAdminClient();

  // Recent interactions linked to this customer (last 20)
  const { data: interactions } = await admin
    .from("qac_interactions")
    .select(
      "id, agent_name, channel, duration_s, created_at, risk_level, review_status, qac_evaluations(overall_score)",
    )
    .eq("workspace_id", ws.id)
    .eq("customer_id", id)
    .order("created_at", { ascending: false })
    .limit(20);

  // Journey entries ordered by most recent sequence first
  const { data: journey } = await admin
    .from("qac_customer_journey")
    .select(
      "id, thread_id, interaction_id, sequence_number, intent_at_call, sentiment_at_call, key_topics, unresolved_items, created_at",
    )
    .eq("workspace_id", ws.id)
    .eq("customer_id", id)
    .order("sequence_number", { ascending: false })
    .limit(10);

  // Active insights (exclude expired)
  const { data: insights } = await admin
    .from("qac_journey_insights")
    .select(
      "id, thread_id, insight_type, content, confidence, generated_at, expires_at",
    )
    .eq("workspace_id", ws.id)
    .eq("customer_id", id)
    .or(`expires_at.is.null,expires_at.gt.${new Date().toISOString()}`)
    .order("generated_at", { ascending: false })
    .limit(10);

  return NextResponse.json({
    ...customer,
    recent_interactions: interactions ?? [],
    journey: journey ?? [],
    insights: insights ?? [],
  });
}
