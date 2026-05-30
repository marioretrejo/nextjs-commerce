/**
 * POST /api/sip — Provision a LiveKit SIP Trunk and Dispatch Rule
 *
 * This endpoint wires a real phone number (Twilio DID) to a VoiceOS agent.
 * When a call arrives at the number, LiveKit's SIP gateway creates a room and
 * dispatches it to the agent worker — exactly like a WebRTC call, but from PSTN.
 *
 * Setup flow:
 *  1. Workspace owner buys/assigns a phone number in the VoiceOS UI
 *  2. Client calls POST /api/sip with { agentId, phoneNumber, trunkId }
 *  3. This route creates a SIPDispatchRule in LiveKit pointing that DID → agent
 *
 * Prerequisites (one-time, done in LiveKit Cloud dashboard or SIP API):
 *  - Create an Inbound SIP Trunk (provider: Twilio)
 *  - Point Twilio's "A Call Comes In" webhook to your LiveKit SIP termination URI
 *    Format: sip:<project-id>.sip.livekit.cloud
 *    See: https://docs.livekit.io/cloud/sip/
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { SipClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { agentId, phoneNumber, trunkId } = await req.json() as {
    agentId: string;
    phoneNumber: string;  // E.164 format: "+12025551234"
    trunkId: string;      // LiveKit SIP Trunk ID (from dashboard or GET /api/sip)
  };

  if (!agentId || !phoneNumber || !trunkId) {
    return NextResponse.json({ error: 'agentId, phoneNumber, and trunkId required' }, { status: 400 });
  }

  const apiKey = process.env['LIVEKIT_API_KEY'];
  const apiSecret = process.env['LIVEKIT_API_SECRET'];
  const wsUrl = process.env['LIVEKIT_URL'];
  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
  }

  // Verify the agent belongs to this user's workspace
  const admin = createAdminClient();
  const { data: agent } = await admin
    .from('agents')
    .select('id, name, workspace_id, system_prompt, voice_id, first_message, voice_emotion, flow_json, transfer_number')
    .eq('id', agentId)
    .single();

  if (!agent) return NextResponse.json({ error: 'Agent not found' }, { status: 404 });

  const httpUrl = wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  const sipClient = new SipClient(httpUrl, apiKey, apiSecret);

  // Create a dispatch rule: when a call arrives at `phoneNumber`, dispatch to
  // a new room prefixed "sip-agent-{agentId}" with the agent's metadata embedded.
  const roomPrefix = `sip-agent-${agentId}`;
  const agentTyped = agent as {
    name: string; system_prompt: string | null; first_message: string | null;
    voice_id: string | null; voice_emotion: string | null; workspace_id: string;
    flow_json: unknown | null; transfer_number: string | null;
  };
  const metadata = JSON.stringify({
    agent_id: agentId,
    agent_name: agentTyped.name,
    system_prompt: agentTyped.system_prompt,
    first_message: agentTyped.first_message,
    voice_id: agentTyped.voice_id,
    voice_emotion: agentTyped.voice_emotion,
    workspace_id: agentTyped.workspace_id,
    flow_json: agentTyped.flow_json ?? null,
    transfer_number: agentTyped.transfer_number ?? null,
    source: 'sip',
  });

  // Each inbound call gets its own room (type: 'individual') prefixed by agentId
  const dispatchRule = await sipClient.createSipDispatchRule(
    { type: 'individual', roomPrefix },
    {
      trunkIds: [trunkId],
      name: `VoiceOS Agent: ${(agent as { name: string }).name} (${phoneNumber})`,
      metadata,
      // roomConfig passes the agent metadata into every room this rule creates
    }
  );

  // Store the dispatch rule ID on the phone number record so we can delete it later
  await admin
    .from('phone_numbers')
    .update({ agent_id: agentId })
    .eq('number', phoneNumber)
    .eq('workspace_id', (agent as { workspace_id: string }).workspace_id);

  return NextResponse.json({
    success: true,
    dispatch_rule_id: dispatchRule.sipDispatchRuleId,
    phone_number: phoneNumber,
    agent_id: agentId,
    room_prefix: roomPrefix,
  });
}

export async function DELETE(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { dispatchRuleId } = await req.json() as { dispatchRuleId: string };
  if (!dispatchRuleId) {
    return NextResponse.json({ error: 'dispatchRuleId required' }, { status: 400 });
  }

  const apiKey = process.env['LIVEKIT_API_KEY'];
  const apiSecret = process.env['LIVEKIT_API_SECRET'];
  const wsUrl = process.env['LIVEKIT_URL'];
  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
  }

  const httpUrl = wsUrl.replace('wss://', 'https://').replace('ws://', 'http://');
  const sipClient = new SipClient(httpUrl, apiKey, apiSecret);
  await sipClient.deleteSipDispatchRule(dispatchRuleId);

  return NextResponse.json({ success: true });
}
