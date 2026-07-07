/**
 * GET /api/cron/campaign-dial
 *
 * Vercel Cron — runs every 5 minutes.
 * 1. Finds all active campaigns.
 * 2. For each: resets eligible no_answer/voicemail contacts back to "pending"
 *    (retry gate: attempts < max_retries AND last_called_at + retry_interval_hours ago).
 * 3. Dials up to max_concurrency pending contacts per campaign using LiveKit/SIP/Twilio.
 *
 * The per-contact dialer lives in _lib/dial, the TCPA-hours check + area-code
 * timezone map in _lib/tcpa, and shared row shapes in _lib/types.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getRegionalHttpUrl } from "@/lib/livekit/edge";
import { NextResponse } from "next/server";
import { timingSafeEqual } from "node:crypto";
import { isWithinTcpaHours } from "./_lib/tcpa";
import { dialContact } from "./_lib/dial";
import type {
  CampaignRow,
  ContactRow,
  AgentRow,
  WorkspaceRow,
} from "./_lib/types";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

function verifyCronSecret(req: Request): boolean {
  const secret =
    process.env["CRON_SECRET"] ?? process.env["INTERNAL_API_SECRET"];
  if (!secret || secret.trim().length < 16) return false;
  const authHeader = req.headers.get("Authorization");
  const provided = authHeader?.startsWith("Bearer ")
    ? authHeader.slice(7)
    : null;
  if (!provided) return false;
  const a = Buffer.from(secret, "utf8");
  const b = Buffer.from(provided.trim(), "utf8");
  if (a.length !== b.length) return false;
  try {
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function GET(req: Request) {
  if (!verifyCronSecret(req)) {
    return new NextResponse("Unauthorized", { status: 401 });
  }

  const admin = createAdminClient();
  const apiKey = process.env["LIVEKIT_API_KEY"];
  const apiSecret = process.env["LIVEKIT_API_SECRET"];
  const httpUrl = getRegionalHttpUrl();

  if (!apiKey || !apiSecret || !httpUrl) {
    return NextResponse.json(
      { error: "LiveKit not configured" },
      { status: 500 },
    );
  }

  // Load all active campaigns
  const { data: campaigns } = await admin
    .from("campaigns")
    .select(
      "id, workspace_id, agent_id, max_concurrency, retry_enabled, retry_interval_hours, max_retries",
    )
    .eq("status", "active");

  if (!campaigns?.length) return NextResponse.json({ ok: true, dialed: 0 });

  let totalDialed = 0;

  for (const campaign of campaigns as CampaignRow[]) {
    if (!campaign.agent_id) continue;

    // ── 1. Reset eligible contacts to pending (retry gate) ──────────────────
    if (campaign.retry_enabled) {
      const retryBefore = new Date(
        Date.now() - campaign.retry_interval_hours * 3_600_000,
      ).toISOString();

      await admin
        .from("campaign_contacts")
        .update({ status: "pending" })
        .eq("campaign_id", campaign.id)
        .in("status", ["no_answer", "voicemail"])
        .lt("attempts", campaign.max_retries)
        .lt("last_called_at", retryBefore);
    }

    // ── 2. Load workspace for limit checks ──────────────────────────────────
    const { data: ws } = await admin
      .from("workspaces")
      .select("id, minutes_used, minutes_limit, is_suspended")
      .eq("id", campaign.workspace_id)
      .single();

    const workspace = ws as WorkspaceRow | null;
    if (!workspace || workspace.is_suspended) continue;
    if (Number(workspace.minutes_used) >= Number(workspace.minutes_limit))
      continue;

    // ── 3. Load agent ────────────────────────────────────────────────────────
    const { data: agentData } = await admin
      .from("agents")
      .select(
        "id, name, system_prompt, first_message, voice_id, voice_emotion, flow_json, flow_config, transfer_number, amd_enabled, amd_action",
      )
      .eq("id", campaign.agent_id)
      .single();
    if (!agentData) continue;
    const agent = agentData as AgentRow;

    // ── 4. Load pending contacts up to concurrency limit ────────────────────
    const { data: contacts } = await admin
      .from("campaign_contacts")
      .select("id, phone, name, variables, attempts")
      .eq("campaign_id", campaign.id)
      .eq("status", "pending")
      .limit(campaign.max_concurrency * 3); // fetch 3x to account for DNC/TCPA exclusions

    if (!contacts?.length) continue;

    // ── 4a. DNC check — filter out numbers on the workspace DNC list ─────────
    const phones = (contacts as ContactRow[]).map((c) => c.phone);
    const { data: dncHits } = await admin
      .from("dnc_list")
      .select("phone")
      .eq("workspace_id", campaign.workspace_id)
      .in("phone", phones);
    const dncSet = new Set(
      (dncHits ?? []).map((d: { phone: string }) => d.phone),
    );

    // Mark DNC contacts as rejected so they don't get retried
    const dncContacts = (contacts as ContactRow[]).filter((c) =>
      dncSet.has(c.phone),
    );
    if (dncContacts.length) {
      await admin
        .from("campaign_contacts")
        .update({ status: "rejected" })
        .in(
          "id",
          dncContacts.map((c) => c.id),
        );
    }

    // ── 4b. TCPA hours check — skip contacts outside 9 AM–6 PM local time ───
    const dialable = (contacts as ContactRow[])
      .filter((c) => !dncSet.has(c.phone) && isWithinTcpaHours(c.phone))
      .slice(0, campaign.max_concurrency);

    if (!dialable.length) continue;

    // ── 5. Dial in parallel ──────────────────────────────────────────────────
    await Promise.allSettled(
      dialable.map((contact) =>
        dialContact({
          admin,
          workspace,
          campaign,
          agent,
          contact,
          apiKey,
          apiSecret,
          httpUrl,
        }),
      ),
    );

    totalDialed += dialable.length;
  }

  return NextResponse.json({ ok: true, dialed: totalDialed });
}
