// QA Customer Journey helpers
import { createClient } from "@/lib/supabase/server";
import type { QACustomerJourney, QAJourneyCall } from "@/lib/supabase/types";

/**
 * Normalize phone number for journey grouping
 * Removes all non-digit characters to enable consistent matching
 */
export function normalizePhone(phone: string | null): string | null {
  if (!phone) return null;
  return phone.replace(/\D/g, "").slice(-10); // Last 10 digits for consistency
}

/**
 * Find or create a customer journey
 * Groups calls by: workspace + normalized phone + agent + department
 */
export async function findOrCreateJourney(
  workspaceId: string,
  contactPhone: string | null,
  contactName: string | null,
  agentId: string | null,
  department: string | null
): Promise<QACustomerJourney | null> {
  if (!contactPhone) return null;

  const client = createClient();
  const normalized = normalizePhone(contactPhone);
  if (!normalized) return null;

  try {
    // Find existing journey
    const { data: existing, error: findError } = await client
      .from("qa_customer_journeys")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("contact_phone", normalized)
      .eq("agent_id", agentId)
      .eq("department", department || "")
      .single();

    if (findError && findError.code !== "PGRST116") {
      console.error("Error finding journey:", findError);
      return null;
    }

    if (existing) {
      return existing as QACustomerJourney;
    }

    // Create new journey
    const { data: created, error: createError } = await client
      .from("qa_customer_journeys")
      .insert({
        workspace_id: workspaceId,
        contact_phone: normalized,
        contact_name: contactName,
        agent_id: agentId,
        department: department || null,
        first_call_at: new Date().toISOString(),
        last_call_at: new Date().toISOString(),
        total_calls: 0,
        final_outcome: null,
        final_score: null,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating journey:", createError);
      return null;
    }

    return created as QACustomerJourney;
  } catch (error) {
    console.error("Error in findOrCreateJourney:", error);
    return null;
  }
}

/**
 * Add a call to a journey and determine its role
 */
export async function addCallToJourney(
  journeyId: string,
  callId: string,
  sequenceIndex: number,
  roleInJourney: QAJourneyCall["role_in_journey"] = "other"
): Promise<QAJourneyCall | null> {
  const client = createClient();

  try {
    const { data, error } = await client
      .from("qa_journey_calls")
      .insert({
        journey_id: journeyId,
        call_id: callId,
        sequence_index: sequenceIndex,
        role_in_journey: roleInJourney,
      })
      .select()
      .single();

    if (error) {
      console.error("Error adding call to journey:", error);
      return null;
    }

    return data as QAJourneyCall;
  } catch (error) {
    console.error("Error in addCallToJourney:", error);
    return null;
  }
}

/**
 * Get all calls in a journey, ordered by sequence
 */
export async function getJourneyCalls(
  journeyId: string
): Promise<QAJourneyCall[] | null> {
  const client = createClient();

  try {
    const { data, error } = await client
      .from("qa_journey_calls")
      .select("*")
      .eq("journey_id", journeyId)
      .order("sequence_index", { ascending: true });

    if (error) {
      console.error("Error fetching journey calls:", error);
      return null;
    }

    return data as QAJourneyCall[];
  } catch (error) {
    console.error("Error in getJourneyCalls:", error);
    return null;
  }
}

/**
 * Update journey metadata after call analysis
 * Recalculates: last_call_at, total_calls, final_outcome, final_score
 */
export async function updateJourneyAfterAnalysis(
  journeyId: string,
  finalOutcome?: string | null,
  callScore?: number | null
): Promise<QACustomerJourney | null> {
  const client = createClient();

  try {
    // Get all calls in journey
    const calls = await getJourneyCalls(journeyId);
    if (!calls) return null;

    // Get all call scores
    const { data: callsData, error: callsError } = await client
      .from("calls")
      .select("qa_score")
      .in(
        "id",
        calls.map((c) => c.call_id)
      );

    if (callsError) {
      console.error("Error fetching call scores:", callsError);
      return null;
    }

    const scores = callsData
      ?.map((c: { qa_score: number | null }) => c.qa_score)
      .filter((s: number | null) => s !== null) as number[];

    const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b) / scores.length : null;

    // Update journey
    const { data, error } = await client
      .from("qa_customer_journeys")
      .update({
        last_call_at: new Date().toISOString(),
        total_calls: calls.length,
        final_outcome: finalOutcome ?? null,
        final_score: avgScore ?? callScore ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", journeyId)
      .select()
      .single();

    if (error) {
      console.error("Error updating journey:", error);
      return null;
    }

    return data as QACustomerJourney;
  } catch (error) {
    console.error("Error in updateJourneyAfterAnalysis:", error);
    return null;
  }
}

/**
 * Get journey context for display
 * Returns journey + all calls with minimal data
 */
export async function getJourneyContext(
  journeyId: string
): Promise<{
  journey: QACustomerJourney;
  calls: Array<{
    id: string;
    created_at: string;
    duration_seconds: number;
    outcome: string | null;
    qa_score: number | null;
    sentiment: string | null;
    sequence_index: number;
    role_in_journey: string;
  }>;
} | null> {
  const client = createClient();

  try {
    const { data: journey, error: journeyError } = await client
      .from("qa_customer_journeys")
      .select("*")
      .eq("id", journeyId)
      .single();

    if (journeyError) {
      console.error("Error fetching journey:", journeyError);
      return null;
    }

    const journeyCallsData = await getJourneyCalls(journeyId);
    if (!journeyCallsData) return null;

    const { data: calls, error: callsError } = await client
      .from("calls")
      .select(
        "id, created_at, duration_seconds, outcome, qa_score, sentiment, qa_journey_calls(sequence_index, role_in_journey)"
      )
      .in(
        "id",
        journeyCallsData.map((c) => c.call_id)
      )
      .order("created_at", { ascending: false });

    if (callsError) {
      console.error("Error fetching calls:", callsError);
      return null;
    }

    return {
      journey: journey as QACustomerJourney,
      calls: (calls || []).map((call: any) => ({
        id: call.id,
        created_at: call.created_at,
        duration_seconds: call.duration_seconds,
        outcome: call.outcome,
        qa_score: call.qa_score,
        sentiment: call.sentiment,
        sequence_index: call.qa_journey_calls?.[0]?.sequence_index || 0,
        role_in_journey: call.qa_journey_calls?.[0]?.role_in_journey || "other",
      })),
    };
  } catch (error) {
    console.error("Error in getJourneyContext:", error);
    return null;
  }
}
