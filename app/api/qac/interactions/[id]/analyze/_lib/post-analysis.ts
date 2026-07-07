import { createAdminClient } from "@/lib/supabase/admin";
import { groqJSON } from "./groq";
import { buildCommitmentsPrompt } from "./prompts";
import type { CommitmentsResult, SummaryResult } from "./types";

// Post-response (non-blocking) work: extract follow-up commitments, append a
// customer-journey entry, and generate a cross-call insight from the 2nd call on.
export async function runCommitmentsAndJourney(params: {
  workspaceId: string;
  interactionId: string;
  formattedTranscript: string;
  summary: SummaryResult;
  customerId: string | null;
}): Promise<void> {
  const {
    workspaceId,
    interactionId: id,
    formattedTranscript,
    summary,
  } = params;
  const customerId = params.customerId;

  try {
    const adminPost = createAdminClient();

    // Extract follow-up commitments (runs for all interactions, customer_id nullable)
    const rawCommitments = await groqJSON<CommitmentsResult>(
      buildCommitmentsPrompt(formattedTranscript),
      512,
    );
    const VALID_COMMITTED_BY = new Set(["agent", "customer"]);
    const validItems = (rawCommitments?.items ?? [])
      .filter(
        (c) =>
          VALID_COMMITTED_BY.has(c.committed_by) &&
          typeof c.text === "string" &&
          c.text.trim().length > 0 &&
          (c.due_date === null || /^\d{4}-\d{2}-\d{2}$/.test(c.due_date)),
      )
      .slice(0, 5);

    if (validItems.length > 0) {
      const commitmentRows = validItems.map((c) => ({
        workspace_id: workspaceId,
        interaction_id: id,
        customer_id: customerId ?? null,
        committed_by: c.committed_by,
        commitment_text: c.text.slice(0, 1000),
        due_date: c.due_date ?? null,
        status: "pending" as const,
      }));
      const { error: commitErr } = await adminPost
        .from("qac_follow_up_commitments")
        .insert(commitmentRows);
      if (commitErr)
        console.error(
          "[qac-analyze] commitments insert failed:",
          commitErr.message,
        );
    }

    if (!customerId) return;

    // Count prior journey entries for this customer to determine sequence_number
    const { count } = await adminPost
      .from("qac_customer_journey")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("customer_id", customerId);

    const priorCount = count ?? 0;

    // Insert journey entry for this call
    const { error: journeyErr } = await adminPost
      .from("qac_customer_journey")
      .insert({
        workspace_id: workspaceId,
        customer_id: customerId,
        interaction_id: id,
        sequence_number: priorCount + 1,
        intent_at_call:
          summary.customer_intent !== "Unknown"
            ? summary.customer_intent
            : null,
        sentiment_at_call: (
          ["positive", "neutral", "negative"] as const
        ).includes(
          summary.overall_sentiment as "positive" | "neutral" | "negative",
        )
          ? summary.overall_sentiment
          : "neutral",
        key_topics: summary.key_moments.slice(0, 10),
        unresolved_items: summary.objections.slice(0, 10),
      });
    if (journeyErr)
      console.error("[qac-analyze] journey insert failed:", journeyErr.message);

    // Generate a cross-call insight only from the 2nd call onward
    if (priorCount < 1) return;
    if (!summary.summary || summary.summary === "Analysis unavailable.") return;

    const { error: insightErr } = await adminPost
      .from("qac_journey_insights")
      .insert({
        workspace_id: workspaceId,
        customer_id: customerId,
        insight_type: "journey_summary",
        content: summary.summary,
        confidence: 0.75,
      });
    if (insightErr)
      console.error("[qac-analyze] insight insert failed:", insightErr.message);
  } catch (err) {
    console.error("[qac-analyze] customer journey after() block failed:", err);
  }
}
