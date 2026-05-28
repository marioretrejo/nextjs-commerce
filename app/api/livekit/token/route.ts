import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Agent, Workspace } from '@/lib/supabase/types';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { detectRegion, getRegionalWsUrl, getRegionalHttpUrl } from '@/lib/livekit/edge';
import { traceRequest } from '@/lib/tracing';
import { NextResponse } from 'next/server';

function sanitizePrompt(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw
    .replace(/ignore\s+(all\s+)?(previous|above|prior|prior\s+to\s+this)\s+(instructions?|prompts?|rules?|context)/gi, '[FILTERED]')
    .replace(/\b(forget|disregard|override)\s+(everything|all|prior|previous)\b/gi, '[FILTERED]')
    .replace(/you\s+are\s+now\s+(a|an|the)\s+/gi, 'You are a helpful ')
    .replace(/new\s+system\s*prompt\s*:/gi, '[FILTERED]:')
    .replace(/<\/?system>/gi, '')
    .slice(0, 4000);
}

export async function POST(req: Request) {
  const trace = traceRequest(req, 'token.issue');

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { agentId } = await req.json() as { agentId: string };

  // Route to the nearest LiveKit node for < 50ms audio latency
  const region = detectRegion(req);
  const wsUrl = getRegionalWsUrl(region) || process.env['LIVEKIT_URL'] || '';
  const httpUrl = getRegionalHttpUrl(region) || wsUrl.replace('wss://', 'https://');
  const apiKey = process.env['LIVEKIT_API_KEY'];
  const apiSecret = process.env['LIVEKIT_API_SECRET'];

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
  }

  // Fetch agent + workspace concurrently
  const admin = createAdminClient();
  const [{ data: agentRow }, { data: workspaceRow }] = await Promise.all([
    admin.from('agents').select('*').eq('id', agentId).single(),
    admin
      .from('workspaces')
      .select('id, minutes_used, minutes_limit, plan, active_calls, concurrent_calls_limit')
      .eq('owner_id', user.id)
      .single(),
  ]);

  const agent = agentRow as Agent | null;
  const workspace = workspaceRow as Pick<
    Workspace & { active_calls: number; concurrent_calls_limit: number },
    'id' | 'minutes_used' | 'minutes_limit' | 'plan' | 'active_calls' | 'concurrent_calls_limit'
  > | null;

  if (!workspace) {
    return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });
  }

  // ── Financial kill switch: block if out of minutes ───────────────────────
  if (Number(workspace.minutes_used) >= Number(workspace.minutes_limit)) {
    trace.end({ blocked: 'minutes_exhausted', workspace_id: workspace.id });
    return NextResponse.json(
      { error: 'Minute limit reached. Please upgrade your plan to continue.' },
      { status: 403 }
    );
  }

  // ── Rate limiter: atomic claim of a concurrent call slot ─────────────────
  // try_claim_call_slot also re-checks minutes inside a transaction to prevent
  // the TOCTOU race between the check above and the slot claim.
  const { data: claimed, error: claimError } = await admin.rpc('try_claim_call_slot', {
    p_workspace_id: workspace.id,
  });

  if (claimError || !claimed) {
    const reason = claimError ? 'rpc_error' : 'concurrency_limit';
    trace.end({ blocked: reason, workspace_id: workspace.id });
    return NextResponse.json(
      {
        error:
          reason === 'concurrency_limit'
            ? `Concurrent call limit reached (${workspace.concurrent_calls_limit} active calls). Please wait for an active call to finish.`
            : 'Service temporarily unavailable.',
        code: 'CONCURRENT_LIMIT',
      },
      { status: 429 }
    );
  }

  const roomName = `agent-${agentId}-${Date.now()}`;
  const participantName = `user-${user.id.slice(0, 8)}`;

  try {
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);
    await roomService.createRoom({
      name: roomName,
      metadata: JSON.stringify({
        agent_name: agent?.name ?? 'Assistant',
        system_prompt: sanitizePrompt(agent?.system_prompt),
        first_message: agent?.first_message ?? null,
        voice_id: agent?.voice_id ?? null,
        voice_emotion: agent?.voice_emotion ?? null,
        workspace_id: workspace.id,
        transfer_number: (agent as unknown as Record<string, unknown>)?.['transfer_number'] ?? null,
        region,
      }),
      departureTimeout: 600,
    });
  } catch (err) {
    // Room creation failed — release the slot we just claimed
    void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspace.id })).catch(() => null);
    trace.end({ ok: false, error: String(err) });
    return NextResponse.json({ error: 'Failed to create room' }, { status: 500 });
  }

  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    name: 'You',
    ttl: '30m',
  });
  at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
  const token = await at.toJwt();

  trace.end({ ok: true, workspace_id: workspace.id, agent_id: agentId, region });
  return NextResponse.json({ token, roomName, wsUrl, agentName: agent?.name ?? 'Assistant', region });
}
