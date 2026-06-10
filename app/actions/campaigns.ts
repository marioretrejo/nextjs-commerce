"use server";

import { createClient } from "@/lib/supabase/server";

/**
 * Wakes the campaign dispatcher for the given campaign.
 *
 * Verifies that the authenticated user owns the campaign and that its status
 * is 'active', then fires a non-blocking call to /api/cron/campaign-dial.
 * If the cron call fails or is not configured, the campaign will still be
 * picked up on the next 5-minute cron cycle.
 *
 * No-ops in load-test mode to avoid triggering real outbound calls.
 *
 * Throws on auth / ownership errors so the caller can surface them.
 */
export async function triggerCampaignDispatcher(
  campaignId: string,
): Promise<void> {
  // Skip real dispatcher wake in load-test mode — the simulator handles pacing.
  if (process.env["VOICEOS_LOAD_TEST_MODE"] === "true") return;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Unauthorized");

  // RLS-scoped — only returns the row if the user owns the campaign's workspace
  const { data: campaign } = await supabase
    .from("campaigns")
    .select("id, status, workspace_id")
    .eq("id", campaignId)
    .single();

  if (!campaign) throw new Error("Campaign not found");
  if (campaign.status !== "active")
    throw new Error(
      `Campaign must be active to dispatch (current status: ${campaign.status})`,
    );

  // Fire the cron handler immediately — non-blocking, best-effort.
  // If CRON_SECRET or NEXT_PUBLIC_APP_URL are absent (e.g. local dev without
  // a tunnel), the 5-minute Vercel Cron will pick up the campaign instead.
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"];
  const cronSecret = process.env["CRON_SECRET"];

  if (appUrl && cronSecret) {
    void fetch(`${appUrl}/api/cron/campaign-dial`, {
      method: "GET",
      headers: { Authorization: `Bearer ${cronSecret}` },
      signal: AbortSignal.timeout(10_000),
    }).catch(() => null);
  }
}
