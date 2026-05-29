/**
 * POST /api/calls/dial
 *
 * Session-auth version of the outbound caller, for use by the dashboard UI.
 * Accepts { agentId, to, variables? } and initiates a Twilio/LiveKit call.
 * Reuses the same logic as /api/v1/calls/outbound but uses Supabase session.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoomServiceClient, SipClient } from 'livekit-server-sdk';
import { getRegionalHttpUrl } from '@/lib/livekit/edge';
import { NextResponse } from 'next/server';

// ── SIP Egress helpers ───────────────────────────────────────────────────────
// When a workspace has an active 'sip_trunk' integration we dial through
// LiveKit's SIP Outbound Egress instead of Twilio TwiML.
//
// Flow:
//   1. Check integrations table for type='sip_trunk' + status='active'
//   2. Retrieve (or lazily create) a LiveKit SipOutboundTrunk using the stored
//      credentials (sip_host, username, password). Cache the trunk ID back into
//      the credentials JSONB to avoid redundant trunk creation on every call.
//   3. Call sipClient.createSipParticipant(trunkId, to, roomName) — this makes
//      LiveKit dial `to` through the provider and join it into the already-
//      created room, exactly like a Twilio SIP leg but provider-agnostic.
//   4. Record the call in `calls` with method='livekit_sip_egress'.
//
// Prerequisites (one-time, done via POST /api/settings/sip in the UI):
//   - Provider Name (e.g. "Squaretalk")
//   - SIP Host/URI  (e.g. "sip.squaretalk.com" or "sip:user@host")
//   - Username + Password  (SIP auth credentials from provider dashboard)

interface SipTrunkCredentials {
  provider_name: string;
  sip_host: string;
  username: string;
  password: string;
  livekit_trunk_id?: string;
}

async function dialViaSipEgress(params: {
  admin: ReturnType<typeof createAdminClient>;
  workspaceId: string;
  creds: SipTrunkCredentials;
  integrationId: string;
  to: string;
  from: string;
  roomName: string;
  apiKey: string;
  apiSecret: string;
  httpUrl: string;
}): Promise<{ participantSid: string; trunkId: string }> {
  const sipClient = new SipClient(params.httpUrl, params.apiKey, params.apiSecret);

  // Resolve or create the LiveKit outbound trunk for this workspace
  let trunkId = params.creds.livekit_trunk_id;
  if (!trunkId) {
    const trunk = await sipClient.createSipOutboundTrunk(
      `voiceos-${params.workspaceId}`,
      params.creds.sip_host,
      [params.from],
      {
        transport:    0, // SIP_TRANSPORT_AUTO
        authUsername: params.creds.username,
        authPassword: params.creds.password,
      }
    );
    trunkId = trunk.sipTrunkId;
    // Cache trunk ID — fire-and-forget, non-fatal if it fails
    void params.admin
      .from('integrations')
      .update({
        credentials: { ...params.creds, livekit_trunk_id: trunkId },
      })
      .eq('id', params.integrationId)
      .then(() => null, () => null);
  }

  const participant = await sipClient.createSipParticipant(
    trunkId,
    params.to,
    params.roomName,
    {
      participantIdentity: `sip-${params.to}`,
      participantName:     params.to,
      waitUntilAnswered:   false,
      playRingtone:        false,
    }
  );

  return { participantSid: participant.participantId ?? '', trunkId };
}
// ── End SIP Egress helpers ───────────────────────────────────────────────────

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

  // Resolve caller ID (phone number owned by this workspace)
  const { data: defaultNumber } = await admin
    .from('phone_numbers')
    .select('number')
    .eq('workspace_id', workspace.id)
    .eq('status', 'available')
    .limit(1)
    .single();
  const callerId = (defaultNumber as { number: string } | null)?.number
    ?? process.env['TWILIO_PHONE_NUMBER']
    ?? '';

  // ── SIP Egress path (Squaretalk / CommPeak / any SIP provider) ──────────
  // If the workspace has an active SIP trunk integration, dial through LiveKit
  // SIP Outbound Egress — no Twilio dependency required.
  const { data: sipIntegration } = await admin
    .from('integrations')
    .select('id, credentials')
    .eq('workspace_id', workspace.id)
    .eq('type', 'sip_trunk')
    .eq('status', 'connected')
    .maybeSingle();

  if (sipIntegration) {
    const creds = sipIntegration.credentials as SipTrunkCredentials;
    if (!callerId) {
      void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspace.id })).catch(() => null);
      return NextResponse.json({ error: 'No caller ID configured. Add a phone number in /numbers.' }, { status: 503 });
    }
    try {
      const { participantSid, trunkId } = await dialViaSipEgress({
        admin, workspaceId: workspace.id, creds,
        integrationId: sipIntegration.id as string,
        to, from: callerId, roomName,
        apiKey, apiSecret, httpUrl,
      });
      await admin.from('calls').insert({
        workspace_id: workspace.id, agent_id: agentId,
        retell_call_id: roomName, direction: 'outbound',
        contact_phone: to, status: 'dialing', cost_usd: 0,
        routing_data: {
          method: 'livekit_sip_egress',
          sip_provider: creds.provider_name,
          livekit_trunk_id: trunkId,
          livekit_participant_sid: participantSid,
        },
      });
      return NextResponse.json({
        call_id: roomName, room_name: roomName,
        method: 'livekit_sip_egress',
        sip_provider: creds.provider_name,
        status: 'dialing',
      });
    } catch (err) {
      void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspace.id })).catch(() => null);
      return NextResponse.json({ error: `SIP egress error: ${String(err)}` }, { status: 502 });
    }
  }

  // ── Twilio TwiML fallback ────────────────────────────────────────────────
  const twilioSid   = process.env['TWILIO_ACCOUNT_SID'];
  const twilioToken = process.env['TWILIO_AUTH_TOKEN'];
  const appUrl      = process.env['NEXT_PUBLIC_APP_URL'] ?? '';
  const livekitSipHost = process.env['LIVEKIT_SIP_HOST'] ?? 'sip.livekit.run';

  if (!twilioSid || !twilioToken || !callerId) {
    void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspace.id })).catch(() => null);
    return NextResponse.json({ error: 'No dialer configured. Connect a SIP trunk or Twilio in Settings.' }, { status: 503 });
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
