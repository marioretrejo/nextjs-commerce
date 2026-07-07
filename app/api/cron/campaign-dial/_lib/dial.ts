import { createAdminClient } from "@/lib/supabase/admin";
import { RoomServiceClient, SipClient } from "livekit-server-sdk";
import {
  checkDialEligibility,
  recordDialEligibilityCheck,
} from "@/lib/compliance/dial-eligibility";
import type {
  CampaignRow,
  ContactRow,
  AgentRow,
  WorkspaceRow,
  SipIntegrationRow,
} from "./types";

// Dial a single campaign contact: compliance gate → slot claim → atomic
// contact claim → LiveKit room → SIP-egress (preferred) or Twilio TwiML.
export async function dialContact(params: {
  admin: ReturnType<typeof createAdminClient>;
  workspace: WorkspaceRow;
  campaign: CampaignRow;
  agent: AgentRow;
  contact: ContactRow;
  apiKey: string;
  apiSecret: string;
  httpUrl: string;
}): Promise<void> {
  const {
    admin,
    workspace,
    campaign,
    agent,
    contact,
    apiKey,
    apiSecret,
    httpUrl,
  } = params;

  // ── Compliance pre-dial gate ────────────────────────────────────────────────
  // Must run BEFORE slot acquisition and LiveKit room creation.
  const eligibility = await checkDialEligibility({
    workspaceId: workspace.id,
    campaignId: campaign.id,
    leadId: contact.id,
    phoneNumber: contact.phone,
    supabase: admin,
  });
  void recordDialEligibilityCheck(
    eligibility,
    {
      workspaceId: workspace.id,
      campaignId: campaign.id,
      leadId: contact.id,
      phoneNumber: contact.phone,
    },
    admin,
  );
  if (!eligibility.allowed) {
    // Mark contact as skipped so it is not retried as a technical failure
    if (
      eligibility.reason_code === "dnc" ||
      eligibility.reason_code === "opt_out"
    ) {
      void admin
        .from("campaign_contacts")
        .update({ status: "rejected" })
        .eq("id", contact.id);
    }
    console.log(
      `[cron/campaign-dial] blocked by compliance: ${eligibility.reason_code} for ${eligibility.normalized_phone ?? contact.phone}`,
    );
    return;
  }

  // Auto-heal zombie slots before claiming
  const staleAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  try {
    await admin
      .from("workspaces")
      .update({ active_calls: 0 })
      .eq("id", workspace.id)
      .gt("active_calls", 0)
      .or(
        `active_calls_last_claimed_at.is.null,active_calls_last_claimed_at.lt.${staleAt}`,
      );
  } catch {
    /* non-fatal */
  }

  // Claim concurrent slot
  const { data: claimed } = await admin.rpc("try_claim_call_slot", {
    p_workspace_id: workspace.id,
  });
  if (!claimed) return; // concurrency limit reached

  const roomName = `agent-${campaign.agent_id}-${Date.now()}`;

  // Atomically claim the contact (compare-and-swap): flip pending → calling only
  // if it is still pending. Two concurrent runners (the continuous worker and the
  // Vercel cron, or overlapping worker cycles) can both SELECT the same pending
  // contact; without this guard both would dial it, double-billing the workspace
  // and breaching call-frequency compliance. The runner whose UPDATE affects 0
  // rows lost the race — it releases its call slot and skips.
  const { data: claimedRows } = await admin
    .from("campaign_contacts")
    .update({
      status: "calling",
      attempts: contact.attempts + 1,
      last_called_at: new Date().toISOString(),
    })
    .eq("id", contact.id)
    .eq("status", "pending")
    .select("id");

  if (!claimedRows || claimedRows.length === 0) {
    // Another runner already claimed this contact — release the slot and skip.
    void Promise.resolve(
      admin.rpc("release_call_slot", { p_workspace_id: workspace.id }),
    ).catch(() => null);
    return;
  }

  try {
    await new RoomServiceClient(httpUrl, apiKey, apiSecret).createRoom({
      name: roomName,
      metadata: JSON.stringify({
        agent_id: campaign.agent_id,
        agent_name: agent.name,
        system_prompt: agent.system_prompt,
        first_message: agent.first_message,
        voice_id: agent.voice_id,
        voice_emotion: agent.voice_emotion,
        workspace_id: workspace.id,
        call_direction: "outbound",
        dynamic_variables: contact.variables ?? {},
        recipient_number: contact.phone,
        campaign_id: campaign.id,
        contact_id: contact.id,
        flow_json: agent.flow_json ?? null,
        flow_config: agent.flow_config ?? null,
        transfer_number: agent.transfer_number ?? null,
      }),
      departureTimeout: 600,
    });
  } catch {
    // Room creation failed — release slot and reset contact
    void Promise.resolve(
      admin.rpc("release_call_slot", { p_workspace_id: workspace.id }),
    ).catch(() => null);
    await admin
      .from("campaign_contacts")
      .update({ status: "no_answer" })
      .eq("id", contact.id);
    return;
  }

  // Choose dial path: SIP trunk > Twilio fallback
  const { data: sipIntegration } = await admin
    .from("integrations")
    .select("id, credentials")
    .eq("workspace_id", workspace.id)
    .eq("type", "sip_trunk")
    .eq("status", "connected")
    .maybeSingle();

  // Resolve caller ID (first available workspace number)
  const { data: numberRow } = await admin
    .from("phone_numbers")
    .select("number")
    .eq("workspace_id", workspace.id)
    .eq("status", "available")
    .limit(1)
    .single();
  const callerId =
    (numberRow as { number: string } | null)?.number ??
    process.env["TWILIO_PHONE_NUMBER"] ??
    "";

  if (sipIntegration) {
    const creds = (sipIntegration as SipIntegrationRow).credentials;
    const sipClient = new SipClient(httpUrl, apiKey, apiSecret);

    let trunkId = creds.livekit_trunk_id;
    if (!trunkId) {
      const trunk = await sipClient.createSipOutboundTrunk(
        `voiceos-${workspace.id}`,
        creds.sip_host,
        callerId ? [callerId] : [],
        {
          transport: 0,
          authUsername: creds.username,
          authPassword: creds.password,
        },
      );
      trunkId = trunk.sipTrunkId;
      void admin
        .from("integrations")
        .update({
          credentials: { ...creds, livekit_trunk_id: trunkId },
        })
        .eq("id", (sipIntegration as SipIntegrationRow).id)
        .then(
          () => null,
          () => null,
        );
    }

    try {
      await sipClient.createSipParticipant(trunkId, contact.phone, roomName, {
        participantIdentity: `sip-${contact.phone}`,
        participantName: contact.phone,
        waitUntilAnswered: false,
        playRingtone: false,
      });
      await admin.from("calls").insert({
        workspace_id: workspace.id,
        agent_id: campaign.agent_id,
        campaign_id: campaign.id,
        retell_call_id: roomName,
        direction: "outbound",
        contact_phone: contact.phone,
        contact_name: contact.name,
        status: "dialing",
        cost_usd: 0,
        routing_data: { method: "livekit_sip_egress", campaign_dial: true },
      });
    } catch {
      void Promise.resolve(
        admin.rpc("release_call_slot", { p_workspace_id: workspace.id }),
      ).catch(() => null);
      await admin
        .from("campaign_contacts")
        .update({ status: "no_answer" })
        .eq("id", contact.id);
    }
    return;
  }

  // Twilio fallback
  const twilioSid = process.env["TWILIO_ACCOUNT_SID"];
  const twilioToken = process.env["TWILIO_AUTH_TOKEN"];
  const appUrl = process.env["VERCEL_URL"]
    ? `https://${process.env["VERCEL_URL"]}`
    : (process.env["NEXT_PUBLIC_APP_URL"] ?? "");
  const livekitSipHost = process.env["LIVEKIT_SIP_HOST"] ?? "sip.livekit.run";

  if (!twilioSid || !twilioToken || !callerId) {
    void Promise.resolve(
      admin.rpc("release_call_slot", { p_workspace_id: workspace.id }),
    ).catch(() => null);
    await admin
      .from("campaign_contacts")
      .update({ status: "invalid" })
      .eq("id", contact.id);
    return;
  }

  const twimlCallbackUrl = `${appUrl}/api/v1/outbound/twiml?room=${encodeURIComponent(roomName)}&host=${encodeURIComponent(livekitSipHost)}`;
  const twilioParams = new URLSearchParams({
    To: contact.phone,
    From: callerId,
    Url: twimlCallbackUrl,
    StatusCallback: `${appUrl}/api/webhooks/twilio/status`,
    StatusCallbackMethod: "POST",
    Timeout: "25",
  });
  // Twilio REST API requires separate parameters per event (not space-separated string)
  twilioParams.append("StatusCallbackEvent", "answered");
  twilioParams.append("StatusCallbackEvent", "completed");

  // AMD — always respect the agent's answering-machine-detection setting
  if (agent.amd_enabled) {
    twilioParams.set("MachineDetection", "Enable");
    twilioParams.set("MachineDetectionTimeout", "30");
    // AsyncAMD sends a separate status callback when detection completes,
    // so the main webhook still fires immediately and can act on AnsweredBy.
    twilioParams.set(
      "AsyncAmdStatusCallback",
      `${appUrl}/api/webhooks/twilio/status`,
    );
    twilioParams.set("AsyncAmdStatusCallbackMethod", "POST");
  }

  try {
    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`,
      {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString("base64")}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: twilioParams.toString(),
      },
    );
    if (!res.ok) throw new Error(`Twilio ${res.status}`);
    const { sid } = (await res.json()) as { sid: string };
    await admin.from("calls").insert({
      workspace_id: workspace.id,
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
        amd_action: agent.amd_enabled ? (agent.amd_action ?? "hangup") : null,
      },
    });
  } catch {
    void Promise.resolve(
      admin.rpc("release_call_slot", { p_workspace_id: workspace.id }),
    ).catch(() => null);
    await admin
      .from("campaign_contacts")
      .update({ status: "no_answer" })
      .eq("id", contact.id);
  }
}
