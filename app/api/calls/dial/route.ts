/**
 * POST /api/calls/dial
 *
 * Session-auth version of the outbound caller, for use by the dashboard UI.
 * Accepts { agentId, to, variables? } and initiates a Twilio/LiveKit call.
 * Reuses the same logic as /api/v1/calls/outbound but uses Supabase session.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoomServiceClient } from 'livekit-server-sdk';
import { getRegionalHttpUrl } from '@/lib/livekit/edge';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  let body: { agentId?: string; to?: string; variables?: Record<string, unknown> };
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
  }

  const { agentId, to, variables = {} } = body;
  if (!to || !/^\+[1-9]\d{6,14}$/.test(to)) {
    return NextResponse.json({ error: '"to" must be a valid E.164 phone number.' }, { status: 400 });
  }
  if (!agentId) return NextResponse.json({ error: '"agentId" is required.' }, { status: 400 });

  const admin = createAdminClient();
  const [{ data: ws }, { data: agentRow }] = await Promise.all([
    admin
      .from('workspaces')
      .select('id, is_suspended, minutes_used, minutes_limit, active_calls, concurrent_calls_limit')
      .eq('owner_id', user.id)
      .single(),
    admin.from('agents').select('id, name, system_prompt, first_message, voice_id, voice_emotion').eq('id', agentId).single(),
  ]);

  const workspace = ws as { id: string; is_suspended: boolean; minutes_used: number; minutes_limit: number } | null;
  if (!workspace) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
  if (!agentRow)  return NextResponse.json({ error: 'Agent not found.' }, { status: 404 });

  if (workspace.is_suspended) return NextResponse.json({ error: 'Workspace is suspended.' }, { status: 403 });
  if (Number(workspace.minutes_used) >= Number(workspace.minutes_limit)) {
    return NextResponse.json({ error: 'Minute limit reached.' }, { status: 403 });
  }

  const { data: claimed } = await admin.rpc('try_claim_call_slot', { p_workspace_id: workspace.id });
  if (!claimed) return NextResponse.json({ error: 'Concurrent call limit reached.', code: 'CONCURRENT_LIMIT' }, { status: 429 });

  const apiKey    = process.env['LIVEKIT_API_KEY'];
  const apiSecret = process.env['LIVEKIT_API_SECRET'];
  const httpUrl   = getRegionalHttpUrl();

  if (!apiKey || !apiSecret || !httpUrl) {
    void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspace.id })).catch(() => null);
    return NextResponse.json({ error: 'LiveKit not configured.' }, { status: 500 });
  }

  const agent = agentRow as { id: string; name: string; system_prompt: string | null; first_message: string | null; voice_id: string | null; voice_emotion: string | null };
  const roomName = `agent-${agentId}-${Date.now()}`;

  try {
    await new RoomServiceClient(httpUrl, apiKey, apiSecret).createRoom({
      name: roomName,
      metadata: JSON.stringify({
        agent_name: agent.name, system_prompt: agent.system_prompt,
        first_message: agent.first_message, voice_id: agent.voice_id,
        voice_emotion: agent.voice_emotion, workspace_id: workspace.id,
        call_direction: 'outbound', dynamic_variables: variables, recipient_number: to,
      }),
      departureTimeout: 600,
    });
  } catch (err) {
    void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspace.id })).catch(() => null);
    return NextResponse.json({ error: 'Failed to create room.' }, { status: 500 });
  }

  // Twilio REST dial
  const twilioSid   = process.env['TWILIO_ACCOUNT_SID'];
  const twilioToken = process.env['TWILIO_AUTH_TOKEN'];
  const appUrl      = process.env['NEXT_PUBLIC_APP_URL'] ?? '';
  const livekitSipHost = process.env['LIVEKIT_SIP_HOST'] ?? 'sip.livekit.run';

  let callerId = '';
  const { data: defaultNumber } = await admin
    .from('phone_numbers').select('number').eq('workspace_id', workspace.id).eq('status', 'available').limit(1).single();
  callerId = (defaultNumber as { number: string } | null)?.number ?? process.env['TWILIO_PHONE_NUMBER'] ?? '';

  if (!twilioSid || !twilioToken || !callerId) {
    void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspace.id })).catch(() => null);
    return NextResponse.json({ error: 'Twilio not configured. Check TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and a phone number.' }, { status: 503 });
  }

  const twimlCallbackUrl = `${appUrl}/api/v1/outbound/twiml?room=${encodeURIComponent(roomName)}&host=${encodeURIComponent(livekitSipHost)}`;

  let twilioCallSid: string;
  try {
    const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${twilioSid}/Calls.json`, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${Buffer.from(`${twilioSid}:${twilioToken}`).toString('base64')}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: to, From: callerId,
        Url: twimlCallbackUrl,
        StatusCallback: `${appUrl}/api/webhooks/twilio/status`,
        StatusCallbackMethod: 'POST',
        MachineDetection: 'Enable',
      }).toString(),
    });
    if (!res.ok) throw new Error(`Twilio ${res.status}: ${await res.text()}`);
    const r = await res.json() as { sid: string };
    twilioCallSid = r.sid;
  } catch (err) {
    void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspace.id })).catch(() => null);
    return NextResponse.json({ error: `Twilio error: ${String(err)}` }, { status: 502 });
  }

  await admin.from('calls').insert({
    workspace_id: workspace.id, agent_id: agentId,
    retell_call_id: roomName, direction: 'outbound',
    contact_phone: to, status: 'dialing', cost_usd: 0,
    routing_data: { method: 'twilio_twiml', twilio_call_sid: twilioCallSid },
  });

  return NextResponse.json({ call_id: roomName, room_name: roomName, twilio_call_sid: twilioCallSid, status: 'dialing' });
}
