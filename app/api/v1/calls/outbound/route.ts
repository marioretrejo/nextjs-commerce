/**
 * POST /api/v1/calls/outbound
 *
 * Public Outbound Calling API — allows B2B clients to programmatically
 * trigger AI-driven outbound calls via API key.
 *
 * Flow (Twilio path):
 *   1. Validate API key → workspaceId
 *   2. Validate balance + suspension + concurrency slot
 *   3. Create LiveKit room with agent metadata
 *   4. Call Twilio REST API → Twilio dials the recipient
 *   5. When recipient answers, Twilio fetches our TwiML callback URL
 *   6. TwiML callback returns <Dial><Sip> bridging into the LiveKit room
 *   7. Worker auto-joins and runs inference
 *
 * Authentication: Bearer <api_key>
 *
 * Request body:
 *   { "to": "+12025551234", "agentId": "uuid", "from": "+18005559876", "variables": {} }
 *
 * Response:
 *   { "call_id": "...", "room_name": "...", "status": "dialing" }
 *
 * External-service helpers (auth, LiveKit room/SIP, Twilio) live in _lib.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { getRegionalHttpUrl } from "@/lib/livekit/edge";
import { traceRequest } from "@/lib/tracing";
import { NextResponse } from "next/server";
import { authenticateApiKey } from "./_lib/auth";
import {
  createOutboundRoom,
  createOutboundSipParticipant,
  type OutboundAgent,
} from "./_lib/livekit";
import { resolveCallerId, initiateTwilioCall } from "./_lib/twilio";

export async function POST(req: Request) {
  const trace = traceRequest(req, "v1.calls.outbound");
  const admin = createAdminClient();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return NextResponse.json(
      { error: "Invalid or missing API key." },
      { status: 401 },
    );
  }
  const { workspaceId } = auth;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: {
    to?: string;
    agentId?: string;
    from?: string;
    variables?: Record<string, unknown>;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const { to, agentId, from: fromNumber, variables = {} } = body;

  if (!to || !/^\+[1-9]\d{6,14}$/.test(to)) {
    return NextResponse.json(
      { error: '"to" must be a valid E.164 phone number.' },
      { status: 400 },
    );
  }
  if (!agentId) {
    return NextResponse.json(
      { error: '"agentId" is required.' },
      { status: 400 },
    );
  }

  // ── Workspace + agent ─────────────────────────────────────────────────────
  const [{ data: ws }, { data: agentRow }] = await Promise.all([
    admin
      .from("workspaces")
      .select(
        "id, is_suspended, minutes_used, minutes_limit, active_calls, concurrent_calls_limit",
      )
      .eq("id", workspaceId)
      .single(),
    admin
      .from("agents")
      .select("*")
      .eq("id", agentId)
      .eq("workspace_id", workspaceId)
      .single(),
  ]);

  const workspace = ws as {
    id: string;
    is_suspended: boolean;
    minutes_used: number;
    minutes_limit: number;
    active_calls: number;
    concurrent_calls_limit: number;
  } | null;

  if (!workspace)
    return NextResponse.json(
      { error: "Workspace not found." },
      { status: 404 },
    );
  if (!agentRow)
    return NextResponse.json(
      { error: "Agent not found or access denied." },
      { status: 404 },
    );

  // Kill switches
  if (workspace.is_suspended) {
    trace.end({ blocked: "workspace_suspended" });
    return NextResponse.json(
      { error: "Workspace is suspended." },
      { status: 403 },
    );
  }
  if (Number(workspace.minutes_used) >= Number(workspace.minutes_limit)) {
    trace.end({ blocked: "minutes_exhausted" });
    return NextResponse.json(
      { error: "Minute limit reached. Upgrade your plan." },
      { status: 403 },
    );
  }

  // Auto-heal zombie slots before claiming
  const staleAt = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  try {
    await admin
      .from("workspaces")
      .update({ active_calls: 0 })
      .eq("id", workspaceId)
      .gt("active_calls", 0)
      .or(
        `active_calls_last_claimed_at.is.null,active_calls_last_claimed_at.lt.${staleAt}`,
      );
  } catch {
    /* non-fatal */
  }

  // ── Atomic claim of concurrent call slot ──────────────────────────────────
  const { data: claimed } = await admin.rpc("try_claim_call_slot", {
    p_workspace_id: workspaceId,
  });
  if (!claimed) {
    trace.end({ blocked: "concurrency_limit" });
    return NextResponse.json(
      { error: "Concurrent call limit reached.", code: "CONCURRENT_LIMIT" },
      { status: 429 },
    );
  }

  const releaseSlot = () =>
    void Promise.resolve(
      admin.rpc("release_call_slot", { p_workspace_id: workspaceId }),
    ).catch(() => null);

  // ── LiveKit config ────────────────────────────────────────────────────────
  const apiKey = process.env["LIVEKIT_API_KEY"];
  const apiSecret = process.env["LIVEKIT_API_SECRET"];
  const httpUrl = getRegionalHttpUrl();

  if (!apiKey || !apiSecret || !httpUrl) {
    releaseSlot();
    return NextResponse.json(
      { error: "LiveKit not configured." },
      { status: 500 },
    );
  }
  const creds = { httpUrl, apiKey, apiSecret };

  const agent = agentRow as OutboundAgent;

  // Use agent- prefix (not sip-agent-) so outbound rooms match the same worker pattern
  const roomName = `agent-${agentId}-${Date.now()}`;

  // ── Create LiveKit room ───────────────────────────────────────────────────
  try {
    await createOutboundRoom(creds, {
      roomName,
      agent,
      workspaceId,
      variables,
      to,
    });
  } catch (err) {
    releaseSlot();
    trace.end({ ok: false, error: String(err) });
    return NextResponse.json(
      { error: "Failed to create voice room." },
      { status: 500 },
    );
  }

  // ── Dial via Twilio REST API ──────────────────────────────────────────────
  const twilioSid = process.env["TWILIO_ACCOUNT_SID"];
  const twilioToken = process.env["TWILIO_AUTH_TOKEN"];
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "";
  const livekitSipHost = process.env["LIVEKIT_SIP_HOST"] ?? "sip.livekit.run";

  const callerId = await resolveCallerId(admin, workspaceId, fromNumber);

  if (!twilioSid || !twilioToken || !callerId) {
    // Fallback: LiveKit native outbound SIP (requires LIVEKIT_SIP_OUTBOUND_TRUNK_ID)
    const outboundTrunkId = process.env["LIVEKIT_SIP_OUTBOUND_TRUNK_ID"];
    if (outboundTrunkId) {
      try {
        const participantIdentity = await createOutboundSipParticipant(creds, {
          outboundTrunkId,
          to,
          roomName,
          ...(fromNumber ? { fromNumber } : {}),
        });

        await admin.from("calls").insert({
          workspace_id: workspaceId,
          agent_id: agentId,
          retell_call_id: roomName,
          direction: "outbound",
          contact_phone: to,
          status: "dialing",
          cost_usd: 0,
          routing_data: {
            method: "livekit_sip",
            participant_id: participantIdentity,
          },
        });

        trace.end({ ok: true, method: "livekit_sip", room_name: roomName });
        return NextResponse.json({
          call_id: roomName,
          room_name: roomName,
          status: "dialing",
        });
      } catch {
        releaseSlot();
        return NextResponse.json(
          { error: "Failed to initiate call." },
          { status: 500 },
        );
      }
    }

    releaseSlot();
    return NextResponse.json(
      {
        error:
          "Twilio credentials or caller ID not configured. Set TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and a phone number.",
      },
      { status: 503 },
    );
  }

  // TwiML callback URL — encodes room + LiveKit SIP host so no DB lookup needed
  const twimlCallbackUrl =
    `${appUrl}/api/v1/outbound/twiml` +
    `?room=${encodeURIComponent(roomName)}` +
    `&host=${encodeURIComponent(livekitSipHost)}`;

  const statusCallbackUrl = `${appUrl}/api/webhooks/twilio/status`;

  // Initiate the Twilio call
  let twilioCallSid: string;
  try {
    twilioCallSid = await initiateTwilioCall({
      twilioSid,
      twilioToken,
      to,
      callerId,
      twimlCallbackUrl,
      statusCallbackUrl,
    });
  } catch (err) {
    releaseSlot();
    trace.end({ ok: false, error: String(err) });
    return NextResponse.json(
      { error: "Twilio failed to initiate call." },
      { status: 502 },
    );
  }

  // ── Create call record ────────────────────────────────────────────────────
  await admin.from("calls").insert({
    workspace_id: workspaceId,
    agent_id: agentId,
    retell_call_id: roomName,
    direction: "outbound",
    contact_phone: to,
    status: "dialing",
    cost_usd: 0,
    routing_data: {
      method: "twilio_twiml",
      twilio_call_sid: twilioCallSid,
      caller_id: callerId,
      livekit_sip_host: livekitSipHost,
    },
  });

  trace.end({ ok: true, method: "twilio_twiml", room_name: roomName, to });
  return NextResponse.json({
    call_id: roomName,
    room_name: roomName,
    twilio_call_sid: twilioCallSid,
    status: "dialing",
  });
}
