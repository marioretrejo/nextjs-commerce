/**
 * QA Center — Customer Memory Detail API
 * GET /api/qac/customers/[id] — full customer profile with recent interactions, journey, and insights
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";
import { getCustomerById } from "@/lib/qac-customer";

// ─── Score computation (on-read, no migration required) ───────────────────────

function computeScores(
  customer: { total_calls: number; lifetime_sentiment: string | null; first_seen_at: string },
  interactions: Array<{ qac_evaluations: Array<{ overall_score: number | null }> | null }>,
  journey: Array<{
    sequence_number: number;
    sentiment_at_call: string | null;
    unresolved_items: string[] | null;
  }>,
) {
  // call_quality_score: average overall_score across evaluated interactions
  const evalScores = interactions
    .map((i) => i.qac_evaluations?.[0]?.overall_score)
    .filter((s): s is number => s != null);
  const call_quality_score =
    evalScores.length > 0
      ? Math.round(evalScores.reduce((a, b) => a + b, 0) / evalScores.length)
      : null;

  // sentiment_trend: sort journey ASC (oldest first), compare early vs recent half
  const ordered = [...journey].sort((a, b) => a.sequence_number - b.sequence_number);
  const sentiments = ordered
    .map((j) => j.sentiment_at_call)
    .filter((s): s is string => s != null);
  let sentiment_trend: "improving" | "stable" | "declining" | "unknown" = "unknown";
  if (sentiments.length >= 2) {
    const half = Math.ceil(sentiments.length / 2);
    const early = sentiments.slice(0, half);
    const recent = sentiments.slice(half);
    const sentScore = (arr: string[]) =>
      arr.filter((s) => s === "positive").length -
      arr.filter((s) => s === "negative").length;
    const diff = sentScore(recent) - sentScore(early);
    sentiment_trend = diff > 0 ? "improving" : diff < 0 ? "declining" : "stable";
  }

  // unresolved_pressure: 0 items → 0, 10+ items → 100
  const totalUnresolved = journey.reduce(
    (sum, j) => sum + (j.unresolved_items?.length ?? 0),
    0,
  );
  const unresolved_pressure = Math.min(100, totalUnresolved * 10);

  // health_score: weighted composite (quality 40%, sentiment 35%, resolution 25%)
  const sentimentNumeric = (s: string | null) =>
    s === "positive" ? 100 : s === "negative" ? 0 : 50;
  const health_score = Math.round(
    (call_quality_score ?? 50) * 0.4 +
      sentimentNumeric(customer.lifetime_sentiment) * 0.35 +
      (100 - unresolved_pressure) * 0.25,
  );

  // customer_risk: derived from health_score
  const customer_risk: "low" | "medium" | "high" | "critical" =
    health_score >= 70
      ? "low"
      : health_score >= 50
        ? "medium"
        : health_score >= 30
          ? "high"
          : "critical";

  // engagement_score: calls per month, normalized (10 calls/month → 100)
  const daysSinceFirst = customer.first_seen_at
    ? Math.max(1, (Date.now() - new Date(customer.first_seen_at).getTime()) / 86400000)
    : 30;
  const engagement_score = Math.min(
    100,
    Math.round(((customer.total_calls / daysSinceFirst) * 30) * 10),
  );

  return {
    health_score,
    call_quality_score,
    sentiment_trend,
    unresolved_pressure,
    engagement_score,
    customer_risk,
  };
}

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

  const scores = computeScores(
    customer,
    (interactions ?? []) as Array<{ qac_evaluations: Array<{ overall_score: number | null }> | null }>,
    (journey ?? []) as Array<{
      sequence_number: number;
      sentiment_at_call: string | null;
      unresolved_items: string[] | null;
    }>,
  );

  return NextResponse.json({
    ...customer,
    recent_interactions: interactions ?? [],
    journey: journey ?? [],
    insights: insights ?? [],
    scores,
  });
}
