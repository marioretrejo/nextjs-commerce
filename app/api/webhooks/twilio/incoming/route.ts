/**
 * POST /api/webhooks/twilio/incoming
 *
 * Receives Twilio Voice webhooks for inbound calls.
 * Flow:
 *   1. Validate Twilio signature
 *   2. Look up the called number → agent → workspace
 *   3. Check workspace is active and has minutes remaining
 *   4. Create a LiveKit room named sip-agent-{agentId}-{timestamp}
 *   5. Return TwiML telling Twilio to bridge the call to LiveKit SIP
 *   6. Worker (dispatch agent) auto-joins via LiveKit dispatch rules
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { RoomServiceClient } from 'livekit-server-sdk';
import { validateTwilioRequest } from '@/lib/twilio/validate';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function twiml(xml: string): NextResponse {
  return new NextResponse(
    `<?xml version="1.0" encoding="UTF-8"?>\n<Response>\n${xml}\n</Response>`,
    { headers: { 'Content-Type': 'text/xml' } },
  );
}

function rejectCall(message: string): NextResponse {
  return twiml(`  <Say voice="alice">${message}</Say>\n  <Hangup/>`);
}

export async function POST(req: Request) {
  const body = await req.text();

  // ── Signature validation ───────────────────────────────────────────────────
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'] ?? '';
  if (process.env['NODE_ENV'] === 'production') {
    const valid = validateTwilioRequest(req, body, appUrl, '/api/webhooks/twilio/incoming');
    if (!valid) return new NextResponse('Forbidden', { status: 403 });
  }

  const params = Object.fromEntries(new URLSearchParams(body));
  const calledNumber: string = params['To'] ?? '';
  const callerNumber: string = params['From'] ?? '';
  const callSid:      string = params['CallSid'] ?? '';

  if (!calledNumber) return rejectCall('This number is not configured.');

  const admin = createAdminClient();

  // ── Lookup: phone_number → agent → workspace ───────────────────────────────
  const { data: phoneRow } = await admin
    .from('phone_numbers')
    .select('id, workspace_id, agent_id, inbound_enabled, routing_rules, status')
    .eq('number', calledNumber)
    .single();

  if (!phoneRow || !(phoneRow as { inbound_enabled: boolean }).inbound_enabled) {
    return rejectCall('This number is not set up to receive calls.');
  }

  const phone = phoneRow as {
    id: string; workspace_id: string; agent_id: string | null;
    inbound_enabled: boolean; routing_rules: { default_agent_id: string | null };
    status: string;
  };

  if (phone.status === 'suspended') {
    return rejectCall('This service is temporarily unavailable.');
  }

  // Resolve agent: direct FK first, then routing_rules fallback
  const agentId = phone.agent_id ?? phone.routing_rules?.default_agent_id;
  if (!agentId) return rejectCall('No agent is configured for this number.');

  // ── Workspace guard: suspended + minutes ───────────────────────────────────
  const { data: wsRow } = await admin
    .from('workspaces')
    .select('id, is_suspended, minutes_used, minutes_limit')
    .eq('id', phone.workspace_id)
    .single();

  const ws = wsRow as { id: string; is_suspended: boolean; minutes_used: number; minutes_limit: number } | null;
  if (!ws || ws.is_suspended) return rejectCall('This service is currently unavailable.');
  if (Number(ws.minutes_used) >= Number(ws.minutes_limit)) {
    return rejectCall("We're sorry, this account has reached its usage limit. Please try again later.");
  }

  // ── Fetch agent metadata for the room ─────────────────────────────────────
  const { data: agentRow } = await admin
    .from('agents')
    .select('name, system_prompt, first_message, voice_id, voice_emotion')
    .eq('id', agentId)
    .single();

  const agent = agentRow as {
    name: string; system_prompt: string | null; first_message: string | null;
    voice_id: string | null; voice_emotion: string | null;
  } | null;

  // ── Create LiveKit room ────────────────────────────────────────────────────
  const wsUrl     = process.env['LIVEKIT_URL'] ?? '';
  const httpUrl   = wsUrl.replace('wss://', 'https://');
  const apiKey    = process.env['LIVEKIT_API_KEY'];
  const apiSecret = process.env['LIVEKIT_API_SECRET'];

  if (!httpUrl || !apiKey || !apiSecret) {
    return rejectCall('Voice infrastructure is not configured.');
  }

  const roomName = `sip-agent-${agentId}-${Date.now()}`;
  const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);

  try {
    await roomService.createRoom({
      name: roomName,
      metadata: JSON.stringify({
        agent_name:    agent?.name ?? 'Assistant',
        system_prompt: agent?.system_prompt ?? null,
        first_message: agent?.first_message ?? null,
        voice_id:      agent?.voice_id ?? null,
        voice_emotion: agent?.voice_emotion ?? null,
        workspace_id:  ws.id,
        caller_number: callerNumber,
        call_sid:      callSid,
        inbound_phone_id: phone.id,
      }),
      departureTimeout: 600,
    });
  } catch {
    return rejectCall("We're sorry, we couldn't connect your call right now. Please try again.");
  }

  // ── Log the inbound call ───────────────────────────────────────────────────
  void Promise.resolve(
    admin.from('calls').insert({
      workspace_id:    ws.id,
      agent_id:        agentId,
      retell_call_id:  roomName,
      direction:       'inbound',
      status:          'in_progress',
      cost_usd:        0,
      routing_data:    { caller_number: callerNumber, call_sid: callSid, phone_number_id: phone.id },
    })
  ).catch(() => null);

  // ── SIP bridge: direct Twilio to LiveKit's SIP endpoint ───────────────────
  // LiveKit SIP host format: sip.<region>.livekit.cloud or custom SIP trunk host
  const livekitSipHost = process.env['LIVEKIT_SIP_HOST'] ?? 'sip.livekit.run';
  const statusCallbackUrl = `${appUrl}/api/webhooks/twilio/status`;

  return twiml(
    `  <Dial callerId="${calledNumber}" action="${statusCallbackUrl}" method="POST" timeout="30">\n` +
    `    <Sip statusCallbackEvent="initiated ringing answered completed"\n` +
    `         statusCallback="${statusCallbackUrl}">\n` +
    `      sip:${encodeURIComponent(roomName)}@${livekitSipHost}\n` +
    `    </Sip>\n` +
    `  </Dial>`
  );
}
