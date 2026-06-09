import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { NextResponse } from "next/server";

async function getWorkspace(userId: string) {
  const admin = createAdminClient();
  const { data } = await admin
    .from("workspaces")
    .select("id, has_compliance_qa, owner_id")
    .eq("owner_id", userId)
    .single();
  return data as { id: string; has_compliance_qa: boolean } | null;
}

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

  const workspace = await getWorkspace(user.id);
  if (!workspace)
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("qac_interactions")
    .select(
      `
      id, agent_name, agent_id, channel, direction, duration_s, status,
      transcript, audio_url, language, customer_id, campaign_id, outcome,
      risk_level, overall_sentiment, created_at, metadata,
      qac_evaluations (
        id, overall_score, risk_score, tone, summary, criteria_scores,
        compliance_score, sales_score, soft_skills_score, conversation_score,
        coaching_summary, strengths, weaknesses, opportunities,
        recommended_training, sentiment_timeline, key_moments,
        customer_intent, call_outcome, objections,
        evaluated_at, rules_applied,
        qac_flags (
          id, category, severity, label, transcript_fragment,
          regulation, coaching_note, timestamp_s, suggested_correction,
          violation_type, start_ms, end_ms
        )
      )
    `,
    )
    .eq("id", id)
    .eq("workspace_id", workspace.id)
    .single();

  if (error || !data) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json(data);
}
