/**
 * agent/services/campaign-dispatcher.ts
 *
 * Outbound campaign dialing dispatcher (Fase 13).
 *
 * processNextLeads():
 *   1. Claims pending contacts via claim_campaign_contacts RPC (FOR UPDATE SKIP LOCKED)
 *   2. Validates each via checkDialEligibility (Fase 12 compliance engine)
 *   3. Excluded leads: status → 'excluded', reason logged, no Twilio call
 *   4. Eligible leads: LiveKit room created → Twilio outbound call initiated
 *
 * Race-condition safety: the Postgres RPC uses FOR UPDATE SKIP LOCKED so
 * multiple concurrent dispatcher invocations never claim the same contact row.
 */
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  checkDialEligibility,
  recordDialEligibilityCheck,
} from "../../lib/compliance/dial-eligibility.js";
import { RoomServiceClient } from "livekit-server-sdk";

// ── Types ─────────────────────────────────────────────────────────────────────

export interface DispatcherConfig {
  livekitHttpUrl: string;
  livekitApiKey: string;
  livekitApiSecret: string;
  twilioAccountSid?: string;
  twilioAuthToken?: string;
  twilioPhoneNumber?: string;
  appUrl?: string;
  livekitSipHost?: string;
}

export interface DispatchResult {
  contacted: number;
  excluded: number;
  errors: number;
  details: Array<{
    contactId: string;
    outcome: "called" | "excluded" | "error";
    reason?: string;
  }>;
}

interface ClaimedContact {
  id: string;
  campaign_id: string;
  phone: string;
  name: string | null;
  variables: Record<string, string> | null;
  attempts: number;
  campaign_lead_id: string | null;
}

interface CampaignRow {
  id: string;
  workspace_id: string;
  agent_id: string | null;
  status: string;
  configuration: Record<string, unknown> | null;
}

interface AgentRow {
  id: string;
  name: string;
  system_prompt: string | null;
  first_message: string | null;
  voice_id: string | null;
  voice_emotion: string | null;
  flow_json: unknown | null;
  flow_config: unknown | null;
  transfer_number: string | null;
  amd_enabled: boolean;
  amd_action: "hangup" | "leave_voicemail" | null;
}

// ── Main entry point ──────────────────────────────────────────────────────────

export async function processNextLeads(
  campaignId: string,
  limit: number,
  supabase: SupabaseClient,
  config: DispatcherConfig,
): Promise<DispatchResult> {
  const result: DispatchResult = {
    contacted: 0,
    excluded: 0,
    errors: 0,
    details: [],
  };

  // Load campaign + validate it's active
  const { data: campaignRow } = await supabase
    .from("campaigns")
    .select("id, workspace_id, agent_id, status, configuration")
    .eq("id", campaignId)
    .maybeSingle();

  if (!campaignRow) {
    result.details.push({
      contactId: campaignId,
      outcome: "error",
      reason: "campaign_not_found",
    });
    return result;
  }

  const campaign = campaignRow as CampaignRow;

  if (campaign.status === "paused") {
    result.details.push({
      contactId: campaignId,
      outcome: "excluded",
      reason: "campaign_paused",
    });
    return result;
  }
  if (campaign.status !== "active") {
    result.details.push({
      contactId: campaignId,
      outcome: "excluded",
      reason: `campaign_${campaign.status}`,
    });
    return result;
  }
  if (!campaign.agent_id) {
    result.details.push({
      contactId: campaignId,
      outcome: "error",
      reason: "no_agent",
    });
    return result;
  }

  // Load agent config
  const { data: agentRow } = await supabase
    .from("agents")
    .select(
      "id, name, system_prompt, first_message, voice_id, voice_emotion, flow_json, flow_config, transfer_number, amd_enabled, amd_action",
    )
    .eq("id", campaign.agent_id)
    .maybeSingle();

  if (!agentRow) {
    result.details.push({
      contactId: campaignId,
      outcome: "error",
      reason: "agent_not_found",
    });
    return result;
  }
  const agent = agentRow as AgentRow;

  // Claim leads with FOR UPDATE SKIP LOCKED
  const { data: claimed, error: claimErr } = await supabase.rpc(
    "claim_campaign_contacts",
    { p_campaign_id: campaignId, p_limit: Math.min(limit, 50) },
  );

  if (claimErr || !claimed?.length) return result;

  // Process each claimed contact
  for (const row of claimed as ClaimedContact[]) {
    try {
      await _processContact(row, campaign, agent, supabase, config, result);
    } catch (err) {
      result.errors++;
      result.details.push({
        contactId: row.id,
        outcome: "error",
        reason: String(err).slice(0, 200),
      });
      // Revert contact to pending so it can be retried
      await supabase
        .from("campaign_contacts")
        .update({ status: "pending", attempts: Math.max(0, row.attempts - 1) })
        .eq("id", row.id)
        .then(
          () => null,
          () => null,
        );
    }
  }

  return result;
}

// ── Per-contact dialing logic ─────────────────────────────────────────────────

async function _processContact(
  contact: ClaimedContact,
  campaign: CampaignRow,
  agent: AgentRow,
  supabase: SupabaseClient,
  config: DispatcherConfig,
  result: DispatchResult,
): Promise<void> {
  // ── Compliance gate (Fase 12) ────────────────────────────────────────────
  const eligibility = await checkDialEligibility({
    workspaceId: campaign.workspace_id,
    campaignId: campaign.id,
    leadId: contact.id,
    phoneNumber: contact.phone,
    supabase,
  });

  void recordDialEligibilityCheck(
    eligibility,
    {
      workspaceId: campaign.workspace_id,
      campaignId: campaign.id,
      leadId: contact.id,
      phoneNumber: contact.phone,
    },
    supabase,
  );

  if (!eligibility.allowed) {
    const permanentBlocks = ["dnc", "opt_out", "invalid_phone_number"];
    const newStatus = permanentBlocks.includes(eligibility.reason_code ?? "")
      ? "rejected"
      : "excluded";

    await supabase
      .from("campaign_contacts")
      .update({ status: newStatus })
      .eq("id", contact.id);

    result.excluded++;
    result.details.push({
      contactId: contact.id,
      outcome: "excluded",
      reason: eligibility.reason_code ?? "compliance_blocked",
    });
    return;
  }

  // ── Claim call slot ───────────────────────────────────────────────────────
  const { data: slotClaimed } = await supabase.rpc("try_claim_call_slot", {
    p_workspace_id: campaign.workspace_id,
  });
  if (!slotClaimed) {
    // Revert to pending — concurrency limit reached
    await supabase
      .from("campaign_contacts")
      .update({
        status: "pending",
        attempts: Math.max(0, contact.attempts - 1),
      })
      .eq("id", contact.id);
    return;
  }

  // ── Create LiveKit room ───────────────────────────────────────────────────
  const roomName = `agent-${campaign.agent_id}-${Date.now()}`;

  try {
    await new RoomServiceClient(
      config.livekitHttpUrl,
      config.livekitApiKey,
      config.livekitApiSecret,
    ).createRoom({
      name: roomName,
      metadata: JSON.stringify({
        agent_id: campaign.agent_id,
        agent_name: agent.name,
        system_prompt: agent.system_prompt,
        first_message: agent.first_message,
        voice_id: agent.voice_id,
        voice_emotion: agent.voice_emotion,
        workspace_id: campaign.workspace_id,
        call_direction: "outbound",
        campaign_id: campaign.id,
        contact_id: contact.id, // worker uses this for lead context
        campaign_lead_id: contact.campaign_lead_id ?? contact.id,
        dynamic_variables: contact.variables ?? {},
        recipient_number: contact.phone,
        flow_json: agent.flow_json ?? null,
        flow_config: agent.flow_config ?? null,
        transfer_number: agent.transfer_number ?? null,
      }),
      departureTimeout: 600,
    });
  } catch (roomErr) {
    void supabase
      .rpc("release_call_slot", { p_workspace_id: campaign.workspace_id })
      .then(
        () => null,
        () => null,
      );
    await supabase
      .from("campaign_contacts")
      .update({ status: "no_answer" })
      .eq("id", contact.id);
    throw roomErr;
  }

  // ── Twilio outbound call ─────────────────────────────────────────────────
  const {
    twilioAccountSid,
    twilioAuthToken,
    twilioPhoneNumber,
    appUrl,
    livekitSipHost,
  } = config;

  if (!twilioAccountSid || !twilioAuthToken) {
    void supabase
      .rpc("release_call_slot", { p_workspace_id: campaign.workspace_id })
      .then(
        () => null,
        () => null,
      );
    await supabase
      .from("campaign_contacts")
      .update({ status: "invalid" })
      .eq("id", contact.id);
    throw new Error("Twilio credentials not configured");
  }

  const callerId = twilioPhoneNumber ?? "";
  const sipHost = livekitSipHost ?? "sip.livekit.run";
  const baseUrl = appUrl ?? "";
  const twimlUrl = `${baseUrl}/api/v1/outbound/twiml?room=${encodeURIComponent(roomName)}&host=${encodeURIComponent(sipHost)}`;

  const twilioParams = new URLSearchParams({
    To: contact.phone,
    From: callerId,
    Url: twimlUrl,
    StatusCallback: `${baseUrl}/api/webhooks/twilio/status`,
    StatusCallbackMethod: "POST",
    StatusCallbackEvent: "completed failed busy no-answer canceled",
    Timeout: "25",
  });

  if (agent.amd_enabled) {
    twilioParams.set("MachineDetection", "Enable");
    twilioParams.set("MachineDetectionTimeout", "30");
    twilioParams.set(
      "AsyncAmdStatusCallback",
      `${baseUrl}/api/webhooks/twilio/status`,
    );
    twilioParams.set("AsyncAmdStatusCallbackMethod", "POST");
  }

  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${twilioAccountSid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilioAccountSid}:${twilioAuthToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: twilioParams.toString(),
      signal: AbortSignal.timeout(10_000),
    },
  );

  if (!res.ok) {
    void supabase
      .rpc("release_call_slot", { p_workspace_id: campaign.workspace_id })
      .then(
        () => null,
        () => null,
      );
    await supabase
      .from("campaign_contacts")
      .update({ status: "no_answer" })
      .eq("id", contact.id);
    throw new Error(`Twilio call failed: HTTP ${res.status}`);
  }

  const { sid } = (await res.json()) as { sid: string };

  await supabase.from("calls").insert({
    workspace_id: campaign.workspace_id,
    agent_id: campaign.agent_id,
    campaign_id: campaign.id,
    retell_call_id: roomName,
    direction: "outbound",
    contact_phone: contact.phone,
    contact_name: contact.name,
    status: "dialing",
    cost_usd: 0,
    routing_data: {
      method: "twilio_twiml",
      twilio_call_sid: sid,
      campaign_dial: true,
      campaign_lead_id: contact.campaign_lead_id ?? contact.id,
      amd_action: agent.amd_enabled ? (agent.amd_action ?? "hangup") : null,
    },
  });

  result.contacted++;
  result.details.push({ contactId: contact.id, outcome: "called" });
}
