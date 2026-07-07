/**
 * POST /api/calls/dial
 *
 * Session-auth version of the outbound caller, for use by the dashboard UI.
 * Accepts { agentId, to, variables? } and initiates a Twilio/LiveKit call.
 * Reuses the same logic as /api/v1/calls/outbound but uses Supabase session.
 *
 * External-service helpers live in _lib: room creation, SIP egress, Twilio,
 * and the concurrency-slot release.
 */
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRegionalHttpUrl } from "@/lib/livekit/edge";
import { resolveDialConfig, cacheLivekitTrunkId } from "@/lib/dialing/strategy";
import {
  checkDialEligibility,
  recordDialEligibilityCheck,
} from "@/lib/compliance/dial-eligibility";
import { NextResponse } from "next/server";
import { releaseSlot } from "./_lib/slots";
import { createOutboundRoom, type DialAgent } from "./_lib/room";
import { runSipEgressDial, type SipTrunkCredentials } from "./_lib/sip-egress";
import { runTwilioDial } from "./_lib/twilio";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user)
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: {
    agentId?: string;
    to?: string;
    variables?: Record<string, unknown>;
    amd_enabled?: boolean;
    amd_action?: "hangup" | "leave_voicemail";
    max_duration_min?: number;
    ringing_timeout_sec?: number;
    caller_id?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON." }, { status: 400 });
  }

  const {
    agentId,
    to,
    variables = {},
    amd_enabled = false,
    amd_action = "hangup",
    max_duration_min,
    ringing_timeout_sec,
    caller_id: requestedCallerId,
  } = body;
  if (!to || !/^\+[1-9]\d{6,14}$/.test(to)) {
    return NextResponse.json(
      { error: '"to" must be a valid E.164 phone number.' },
      { status: 400 },
    );
  }
  if (!agentId)
    return NextResponse.json(
      { error: '"agentId" is required.' },
      { status: 400 },
    );

  const admin = createAdminClient();
  const [{ data: ws }, { data: agentRow }] = await Promise.all([
    admin
      .from("workspaces")
      .select(
        "id, is_suspended, minutes_used, minutes_limit, active_calls, concurrent_calls_limit",
      )
      .eq("owner_id", user.id)
      .single(),
    admin
      .from("agents")
      .select(
        "id, name, system_prompt, first_message, voice_id, voice_emotion, flow_json, flow_config, transfer_number",
      )
      .eq("id", agentId)
      .single(),
  ]);

  const workspace = ws as {
    id: string;
    is_suspended: boolean;
    minutes_used: number;
    minutes_limit: number;
  } | null;
  if (!workspace)
    return NextResponse.json(
      { error: "Workspace not found." },
      { status: 404 },
    );
  if (!agentRow)
    return NextResponse.json({ error: "Agent not found." }, { status: 404 });

  if (workspace.is_suspended)
    return NextResponse.json(
      { error: "Workspace is suspended." },
      { status: 403 },
    );
  if (Number(workspace.minutes_used) >= Number(workspace.minutes_limit)) {
    return NextResponse.json(
      { error: "Minute limit reached." },
      { status: 403 },
    );
  }

  // ── Early dialer check — fail before claiming a slot or creating a room ──
  const [{ data: sipCheck }, { data: phoneCheck }] = await Promise.all([
    admin
      .from("integrations")
      .select("id")
      .eq("workspace_id", workspace.id)
      .eq("type", "sip_trunk")
      .eq("status", "connected")
      .limit(1)
      .maybeSingle(),
    admin
      .from("phone_numbers")
      .select("number")
      .eq("workspace_id", workspace.id)
      .eq("status", "available")
      .limit(1)
      .maybeSingle(),
  ]);
  const hasSip = !!sipCheck;
  const hasNumber = !!(phoneCheck as { number: string } | null)?.number;
  const hasTwilioEnv = !!(
    process.env["TWILIO_ACCOUNT_SID"] &&
    process.env["TWILIO_AUTH_TOKEN"] &&
    process.env["TWILIO_PHONE_NUMBER"]
  );
  if (!hasSip && !hasNumber && !hasTwilioEnv) {
    return NextResponse.json(
      {
        error:
          "No dialer configured. Add a phone number in /numbers or connect a SIP trunk in /integrations.",
      },
      { status: 503 },
    );
  }

  // ── Compliance pre-dial gate ─────────────────────────────────────────────────
  // Must run BEFORE slot acquisition, LiveKit room creation, and any Twilio call.
  const eligibility = await checkDialEligibility({
    workspaceId: workspace.id,
    phoneNumber: to,
    supabase: admin,
  });
  void recordDialEligibilityCheck(
    eligibility,
    { workspaceId: workspace.id, phoneNumber: to },
    admin,
  );
  if (!eligibility.allowed) {
    return NextResponse.json(
      {
        error: "Dial blocked by compliance",
        reason_code: eligibility.reason_code,
        reason: eligibility.reason,
      },
      { status: 422 },
    );
  }

  // Auto-heal: reset stale slots for this workspace before trying to claim one.
  // If active_calls > 0 but the last claim was >15 min ago, those are zombie
  // slots from crashed/timed-out agent sessions — safe to release.
  const staleThreshold = new Date(Date.now() - 15 * 60 * 1000).toISOString();
  try {
    await admin
      .from("workspaces")
      .update({ active_calls: 0 })
      .eq("id", workspace.id)
      .gt("active_calls", 0)
      .or(
        `active_calls_last_claimed_at.is.null,active_calls_last_claimed_at.lt.${staleThreshold}`,
      );
  } catch {
    /* non-fatal */
  }

  const { data: claimed } = await admin.rpc("try_claim_call_slot", {
    p_workspace_id: workspace.id,
  });
  if (!claimed)
    return NextResponse.json(
      { error: "Concurrent call limit reached.", code: "CONCURRENT_LIMIT" },
      { status: 429 },
    );

  const apiKey = process.env["LIVEKIT_API_KEY"];
  const apiSecret = process.env["LIVEKIT_API_SECRET"];
  const httpUrl = getRegionalHttpUrl();

  if (!apiKey || !apiSecret || !httpUrl) {
    await releaseSlot(admin, workspace.id);
    return NextResponse.json(
      { error: "LiveKit not configured." },
      { status: 500 },
    );
  }
  const creds = { httpUrl, apiKey, apiSecret };

  const agent = agentRow as DialAgent;
  const roomName = `agent-${agentId}-${Date.now()}`;
  const maxDurationSec = max_duration_min ? max_duration_min * 60 : 600;

  try {
    await createOutboundRoom(creds, {
      roomName,
      agentId,
      agent,
      workspaceId: workspace.id,
      variables,
      to,
      departureTimeout: maxDurationSec,
    });
  } catch {
    await releaseSlot(admin, workspace.id);
    return NextResponse.json(
      { error: "Failed to create room." },
      { status: 500 },
    );
  }

  // ── Dialing strategy: area-code local presence + SIP trunk selection ────
  const dialCfg = await resolveDialConfig(admin, workspace.id, agentId, to);

  // Respect caller schedule unless explicitly overridden by API consumer
  if (!dialCfg.withinSchedule) {
    await releaseSlot(admin, workspace.id);
    return NextResponse.json(
      {
        error: `Outside calling hours for timezone ${dialCfg.scheduleTimezone}.`,
        code: "OUTSIDE_SCHEDULE",
      },
      { status: 403 },
    );
  }

  // Prefer explicit caller_id if it's owned by this workspace, else strategy result
  let callerId = dialCfg.callerNumber ?? "";
  if (requestedCallerId) {
    const { data: ownedNumber } = await admin
      .from("phone_numbers")
      .select("number")
      .eq("workspace_id", workspace.id)
      .eq("number", requestedCallerId)
      .eq("status", "available")
      .maybeSingle();
    if (ownedNumber) callerId = (ownedNumber as { number: string }).number;
  }

  if (!callerId) callerId = process.env["TWILIO_PHONE_NUMBER"] ?? "";

  // ── SIP Egress via sip_trunks table (preferred) ──────────────────────────
  if (dialCfg.trunk) {
    const trunk = dialCfg.trunk;
    if (!callerId) {
      await releaseSlot(admin, workspace.id);
      return NextResponse.json(
        { error: "No caller ID configured. Add a phone number in /numbers." },
        { status: 503 },
      );
    }
    const trunkCreds: SipTrunkCredentials = {
      provider_name: trunk.provider,
      sip_host: trunk.sip_host,
      username: trunk.username,
      password: trunk.password,
      livekit_trunk_id: trunk.livekit_trunk_id ?? undefined,
    };
    return runSipEgressDial({
      admin,
      workspaceId: workspace.id,
      agentId,
      to,
      callerId,
      roomName,
      creds: trunkCreds,
      integrationId: trunk.id,
      apiKey,
      apiSecret,
      httpUrl,
      providerLabel: trunk.provider,
      sipTrunkId: trunk.id,
      // Cache LiveKit trunk ID so next call skips creation
      afterDial: (trunkId) => {
        if (!trunk.livekit_trunk_id)
          cacheLivekitTrunkId(admin, trunk.id, trunkId);
      },
    });
  }

  // ── Fallback: legacy integrations table SIP trunk ─────────────────────────
  const { data: sipIntegration } = await admin
    .from("integrations")
    .select("id, credentials")
    .eq("workspace_id", workspace.id)
    .eq("type", "sip_trunk")
    .eq("status", "connected")
    .maybeSingle();

  if (sipIntegration) {
    const legacyCreds = sipIntegration.credentials as SipTrunkCredentials;
    if (!callerId) {
      await releaseSlot(admin, workspace.id);
      return NextResponse.json(
        { error: "No caller ID configured. Add a phone number in /numbers." },
        { status: 503 },
      );
    }
    return runSipEgressDial({
      admin,
      workspaceId: workspace.id,
      agentId,
      to,
      callerId,
      roomName,
      creds: legacyCreds,
      integrationId: sipIntegration.id as string,
      apiKey,
      apiSecret,
      httpUrl,
      providerLabel: legacyCreds.provider_name,
    });
  }

  // ── Twilio TwiML fallback ────────────────────────────────────────────────
  const twilioSid = process.env["TWILIO_ACCOUNT_SID"];
  const twilioToken = process.env["TWILIO_AUTH_TOKEN"];
  const appUrl = process.env["NEXT_PUBLIC_APP_URL"] ?? "";
  const livekitSipHost = process.env["LIVEKIT_SIP_HOST"] ?? "sip.livekit.run";

  if (!twilioSid || !twilioToken || !callerId) {
    await releaseSlot(admin, workspace.id);
    return NextResponse.json(
      {
        error:
          "No dialer configured. Connect a SIP trunk or Twilio in Settings.",
      },
      { status: 503 },
    );
  }

  return runTwilioDial({
    admin,
    workspaceId: workspace.id,
    agentId,
    to,
    callerId,
    roomName,
    twilioSid,
    twilioToken,
    appUrl,
    livekitSipHost,
    maxDurationSec,
    amd_enabled,
    amd_action,
    max_duration_min,
    ringing_timeout_sec,
  });
}
