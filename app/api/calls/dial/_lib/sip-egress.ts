import { SipClient } from "livekit-server-sdk";
import { NextResponse } from "next/server";
import { releaseSlot, type Admin } from "./slots";

// ── SIP Egress ────────────────────────────────────────────────────────────────
// When a workspace has an active SIP trunk we dial through LiveKit's SIP
// Outbound Egress instead of Twilio TwiML.
//
// Flow:
//   1. Retrieve (or lazily create) a LiveKit SipOutboundTrunk using the stored
//      credentials (sip_host, username, password). Cache the trunk ID back into
//      the credentials JSONB to avoid redundant trunk creation on every call.
//   2. Call sipClient.createSipParticipant(trunkId, to, roomName) — LiveKit dials
//      `to` through the provider and joins it into the already-created room,
//      exactly like a Twilio SIP leg but provider-agnostic.
//   3. Record the call in `calls` with method='livekit_sip_egress'.

export interface SipTrunkCredentials {
  provider_name: string;
  sip_host: string;
  username: string;
  password: string;
  livekit_trunk_id?: string;
}

async function dialViaSipEgress(params: {
  admin: Admin;
  workspaceId: string;
  creds: SipTrunkCredentials;
  /** Pass for legacy integrations-table path; omit for new sip_trunks path */
  integrationId?: string;
  to: string;
  from: string;
  roomName: string;
  apiKey: string;
  apiSecret: string;
  httpUrl: string;
}): Promise<{ participantSid: string; trunkId: string }> {
  const sipClient = new SipClient(
    params.httpUrl,
    params.apiKey,
    params.apiSecret,
  );

  // Resolve or create the LiveKit outbound trunk for this workspace
  let trunkId = params.creds.livekit_trunk_id;
  if (!trunkId) {
    const trunk = await sipClient.createSipOutboundTrunk(
      `voiceos-${params.workspaceId}`,
      params.creds.sip_host,
      [params.from],
      {
        transport: 0, // SIP_TRANSPORT_AUTO
        authUsername: params.creds.username,
        authPassword: params.creds.password,
      },
    );
    trunkId = trunk.sipTrunkId;
    // Cache trunk ID into legacy integrations table (new sip_trunks path caches separately)
    if (params.integrationId) {
      void params.admin
        .from("integrations")
        .update({ credentials: { ...params.creds, livekit_trunk_id: trunkId } })
        .eq("id", params.integrationId)
        .then(
          () => null,
          () => null,
        );
    }
  }

  const participant = await sipClient.createSipParticipant(
    trunkId,
    params.to,
    params.roomName,
    {
      participantIdentity: `sip-${params.to}`,
      participantName: params.to,
      waitUntilAnswered: false,
      playRingtone: false,
    },
  );

  return { participantSid: participant.participantId ?? "", trunkId };
}

// Dial via SIP egress, insert the call record, and build the JSON response.
// On failure the concurrency slot is released and a 502 returned. Shared by both
// the sip_trunks-table path and the legacy integrations-table path.
export async function runSipEgressDial(params: {
  admin: Admin;
  workspaceId: string;
  agentId: string;
  to: string;
  callerId: string;
  roomName: string;
  creds: SipTrunkCredentials;
  integrationId: string;
  apiKey: string;
  apiSecret: string;
  httpUrl: string;
  providerLabel: string;
  /** routing_data.sip_trunk_id (sip_trunks path only) */
  sipTrunkId?: string;
  /** Post-dial caching hook (sip_trunks path); receives the resolved trunk ID */
  afterDial?: (trunkId: string) => void;
}): Promise<NextResponse> {
  try {
    const { participantSid, trunkId } = await dialViaSipEgress({
      admin: params.admin,
      workspaceId: params.workspaceId,
      creds: params.creds,
      integrationId: params.integrationId,
      to: params.to,
      from: params.callerId,
      roomName: params.roomName,
      apiKey: params.apiKey,
      apiSecret: params.apiSecret,
      httpUrl: params.httpUrl,
    });
    params.afterDial?.(trunkId);
    await params.admin.from("calls").insert({
      workspace_id: params.workspaceId,
      agent_id: params.agentId,
      retell_call_id: params.roomName,
      direction: "outbound",
      contact_phone: params.to,
      status: "dialing",
      cost_usd: 0,
      routing_data: {
        method: "livekit_sip_egress",
        sip_provider: params.providerLabel,
        ...(params.sipTrunkId ? { sip_trunk_id: params.sipTrunkId } : {}),
        livekit_trunk_id: trunkId,
        livekit_participant_sid: participantSid,
      },
    });
    return NextResponse.json({
      call_id: params.roomName,
      room_name: params.roomName,
      method: "livekit_sip_egress",
      sip_provider: params.providerLabel,
      status: "dialing",
    });
  } catch (err) {
    await releaseSlot(params.admin, params.workspaceId);
    return NextResponse.json(
      { error: `SIP egress error: ${String(err)}` },
      { status: 502 },
    );
  }
}
