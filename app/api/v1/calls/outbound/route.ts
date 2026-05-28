/**
 * POST /api/v1/calls/outbound
 *
 * Public Outbound Calling API — allows B2B clients to programmatically
 * trigger AI-driven outbound calls (appointment reminders, sales follow-ups,
 * support callbacks) via HTTP from any external system.
 *
 * Authentication: API Key (Bearer token) — same key system as the existing
 * API key middleware. Each key is scoped to a workspace.
 *
 * Rate limits: enforced via try_claim_call_slot (concurrent limit per plan).
 *
 * Request body:
 *   {
 *     "to":       "+12025551234",   // E.164 destination number (required)
 *     "agentId":  "uuid",           // VoiceOS agent configuration to use
 *     "from":     "+18005559876",   // Caller ID (optional, uses workspace default)
 *     "metadata": { "name": "..." } // Dynamic variables passed to agent (optional)
 *   }
 *
 * Response:
 *   { "call_id": "...", "room_name": "...", "status": "dialing" }
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { SipClient, RoomServiceClient, AccessToken } from 'livekit-server-sdk';
import { getRegionalHttpUrl } from '@/lib/livekit/edge';
import { traceRequest } from '@/lib/tracing';
import { NextResponse } from 'next/server';
import crypto from 'crypto';

// ─── API key auth (reuses the existing api_keys table) ───────────────────────

async function authenticateApiKey(
  req: Request
): Promise<{ workspaceId: string; userId: string } | null> {
  const authHeader = req.headers.get('Authorization') ?? '';
  const rawKey = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : '';
  if (!rawKey) return null;

  const hashed = crypto.createHash('sha256').update(rawKey).digest('hex');
  const admin = createAdminClient();

  const { data } = await admin
    .from('api_keys')
    .select('workspace_id, user_id, is_active')
    .eq('key_hash', hashed)
    .single();

  if (!data || !(data as { is_active: boolean }).is_active) return null;

  // Update last_used_at async
  void Promise.resolve(
    admin
      .from('api_keys')
      .update({ last_used_at: new Date().toISOString() })
      .eq('key_hash', hashed)
  ).catch(() => null);

  return {
    workspaceId: (data as { workspace_id: string }).workspace_id,
    userId: (data as { user_id: string }).user_id,
  };
}

export async function POST(req: Request) {
  const trace = traceRequest(req, 'v1.calls.outbound');
  const admin = createAdminClient();

  // ── Auth ──────────────────────────────────────────────────────────────────
  const auth = await authenticateApiKey(req);
  if (!auth) {
    return NextResponse.json({ error: 'Invalid or missing API key.' }, { status: 401 });
  }
  const { workspaceId } = auth;

  // ── Parse body ────────────────────────────────────────────────────────────
  let body: { to?: string; agentId?: string; from?: string; metadata?: Record<string, unknown> };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body.' }, { status: 400 });
  }

  const { to, agentId, from: fromNumber, metadata = {} } = body;

  if (!to || !/^\+[1-9]\d{6,14}$/.test(to)) {
    return NextResponse.json({ error: '"to" must be a valid E.164 phone number.' }, { status: 400 });
  }
  if (!agentId) {
    return NextResponse.json({ error: '"agentId" is required.' }, { status: 400 });
  }

  // ── Workspace + agent + rate limit check ──────────────────────────────────
  const [{ data: ws }, { data: agentRow }] = await Promise.all([
    admin
      .from('workspaces')
      .select('id, minutes_used, minutes_limit, plan, active_calls, concurrent_calls_limit')
      .eq('id', workspaceId)
      .single(),
    admin.from('agents').select('*').eq('id', agentId).eq('workspace_id', workspaceId).single(),
  ]);

  if (!ws) return NextResponse.json({ error: 'Workspace not found.' }, { status: 404 });
  if (!agentRow) return NextResponse.json({ error: 'Agent not found or access denied.' }, { status: 404 });

  // Kill switch: deny if out of minutes
  if (Number((ws as { minutes_used: number }).minutes_used) >= Number((ws as { minutes_limit: number }).minutes_limit)) {
    trace.end({ blocked: 'minutes_exhausted' });
    return NextResponse.json({ error: 'Minute limit reached. Upgrade your plan.' }, { status: 403 });
  }

  // Claim concurrent slot
  const { data: claimed } = await admin.rpc('try_claim_call_slot', { p_workspace_id: workspaceId });
  if (!claimed) {
    trace.end({ blocked: 'concurrency_limit' });
    return NextResponse.json({ error: 'Concurrent call limit reached.', code: 'CONCURRENT_LIMIT' }, { status: 429 });
  }

  const apiKey = process.env['LIVEKIT_API_KEY'];
  const apiSecret = process.env['LIVEKIT_API_SECRET'];
  const httpUrl = getRegionalHttpUrl();

  if (!apiKey || !apiSecret || !httpUrl) {
    void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspaceId })).catch(() => null);
    return NextResponse.json({ error: 'LiveKit not configured.' }, { status: 500 });
  }

  // ── Resolve outbound SIP trunk ────────────────────────────────────────────
  // Find the outbound trunk configured for this workspace (or use default)
  const outboundTrunkId = process.env['LIVEKIT_SIP_OUTBOUND_TRUNK_ID'] ?? '';
  if (!outboundTrunkId) {
    void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspaceId })).catch(() => null);
    return NextResponse.json(
      { error: 'Outbound SIP trunk not configured. Set LIVEKIT_SIP_OUTBOUND_TRUNK_ID.' },
      { status: 503 }
    );
  }

  const agent = agentRow as {
    id: string; name: string; system_prompt: string | null; first_message: string | null;
    voice_id: string | null; voice_emotion: string | null;
  };

  const roomName = `agent-${agentId}-${Date.now()}`;

  try {
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    const sipClient = new SipClient(httpUrl, apiKey, apiSecret);

    // Create the room with agent metadata (identical to inbound WebRTC flow)
    await roomService.createRoom({
      name: roomName,
      metadata: JSON.stringify({
        agent_name: agent.name,
        system_prompt: agent.system_prompt,
        first_message: agent.first_message,
        voice_id: agent.voice_id,
        voice_emotion: agent.voice_emotion,
        workspace_id: workspaceId,
        call_direction: 'outbound',
        dynamic_variables: metadata,
      }),
      departureTimeout: 600,
    });

    // Dial the destination number via the outbound SIP trunk.
    // LiveKit connects the PSTN call into the room and the agent worker picks it up.
    const sipParticipant = await sipClient.createSipParticipant(
      outboundTrunkId,
      to,
      roomName,
      {
        participantIdentity: `sip_outbound_${Date.now()}`,
        participantName: 'Caller',
        ...(fromNumber ? { fromNumber } : {}),
        playDialtone: true,
        waitUntilAnswered: false, // fire-and-forget; webhook notifies on answer
      }
    );

    // Create a call record for billing + history
    await admin.from('calls').insert({
      workspace_id: workspaceId,
      agent_id: agentId,
      retell_call_id: roomName,
      direction: 'outbound',
      contact_phone: to,
      status: 'dialing',
      cost_usd: 0,
    });

    trace.end({ ok: true, room_name: roomName, to });
    return NextResponse.json({
      call_id: roomName,
      room_name: roomName,
      status: 'dialing',
      participant_id: sipParticipant.participantIdentity,
    });

  } catch (err) {
    void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspaceId })).catch(() => null);
    trace.end({ ok: false, error: String(err) });
    return NextResponse.json({ error: 'Failed to initiate call.' }, { status: 500 });
  }
}
