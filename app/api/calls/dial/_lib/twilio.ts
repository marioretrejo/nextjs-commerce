import { NextResponse } from "next/server";
import { releaseSlot, type Admin } from "./slots";

// POST an outbound call to the Twilio REST API. Returns the call SID, or throws
// on any non-2xx / network error (the caller releases the slot and returns 502).
export async function initiateTwilioCall(opts: {
  twilioSid: string;
  twilioToken: string;
  params: URLSearchParams;
}): Promise<string> {
  const res = await fetch(
    `https://api.twilio.com/2010-04-01/Accounts/${opts.twilioSid}/Calls.json`,
    {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${opts.twilioSid}:${opts.twilioToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: opts.params.toString(),
    },
  );
  if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
  const r = (await res.json()) as { sid: string };
  return r.sid;
}

// Twilio TwiML fallback: build the call params, place the call, record it, and
// build the JSON response. Releases the slot + returns 502 on failure.
export async function runTwilioDial(params: {
  admin: Admin;
  workspaceId: string;
  agentId: string;
  to: string;
  callerId: string;
  roomName: string;
  twilioSid: string;
  twilioToken: string;
  appUrl: string;
  livekitSipHost: string;
  maxDurationSec: number;
  amd_enabled: boolean;
  amd_action: "hangup" | "leave_voicemail";
  max_duration_min?: number;
  ringing_timeout_sec?: number;
}): Promise<NextResponse> {
  const twimlCallbackUrl = `${params.appUrl}/api/v1/outbound/twiml?room=${encodeURIComponent(params.roomName)}&host=${encodeURIComponent(params.livekitSipHost)}`;

  const twilioParams = new URLSearchParams({
    To: params.to,
    From: params.callerId,
    Url: twimlCallbackUrl,
    StatusCallback: `${params.appUrl}/api/webhooks/twilio/status`,
    StatusCallbackMethod: "POST",
    StatusCallbackEvent: "completed failed busy no-answer canceled",
  });
  if (params.ringing_timeout_sec)
    twilioParams.set("Timeout", String(params.ringing_timeout_sec));
  if (params.max_duration_min)
    twilioParams.set("TimeLimit", String(params.maxDurationSec));
  if (params.amd_enabled) {
    twilioParams.set("MachineDetection", "Enable");
    twilioParams.set("MachineDetectionTimeout", "30");
  }

  let twilioCallSid: string;
  try {
    twilioCallSid = await initiateTwilioCall({
      twilioSid: params.twilioSid,
      twilioToken: params.twilioToken,
      params: twilioParams,
    });
  } catch (err) {
    await releaseSlot(params.admin, params.workspaceId);
    return NextResponse.json(
      { error: `Twilio error: ${String(err)}` },
      { status: 502 },
    );
  }

  await params.admin.from("calls").insert({
    workspace_id: params.workspaceId,
    agent_id: params.agentId,
    retell_call_id: params.roomName,
    direction: "outbound",
    contact_phone: params.to,
    status: "dialing",
    cost_usd: 0,
    routing_data: {
      method: "twilio_twiml",
      twilio_call_sid: twilioCallSid,
      amd_action: params.amd_enabled ? params.amd_action : null,
      max_duration_min: params.max_duration_min ?? null,
      ringing_timeout_sec: params.ringing_timeout_sec ?? null,
    },
  });

  return NextResponse.json({
    call_id: params.roomName,
    room_name: params.roomName,
    twilio_call_sid: twilioCallSid,
    status: "dialing",
  });
}
