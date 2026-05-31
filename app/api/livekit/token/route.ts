import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Agent, Workspace } from '@/lib/supabase/types';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { detectRegion, getRegionalWsUrl, getRegionalHttpUrl } from '@/lib/livekit/edge';
import { traceRequest } from '@/lib/tracing';
import { generateEmbedding } from '@/lib/embeddings';
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
      .select('id, minutes_used, minutes_limit, plan, active_calls, concurrent_calls_limit, is_suspended')
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

  // C1: verify agent belongs to this workspace — prevents cross-workspace token issuance
  const agentWorkspaceId = (agent as unknown as { workspace_id?: string })?.workspace_id;
  if (!agent || agentWorkspaceId !== workspace.id) {
    return NextResponse.json({ error: 'Agent not found' }, { status: 403 });
  }

  // ── Workspace suspension kill switch ─────────────────────────────────────
  if ((workspace as unknown as { is_suspended?: boolean }).is_suspended) {
    trace.end({ blocked: 'workspace_suspended', workspace_id: workspace.id });
    return NextResponse.json(
      { error: 'This account has been suspended. Please contact support.' },
      { status: 403 }
    );
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

  // ── RAG: inject relevant knowledge-base context into system prompt ────────
  let ragContext: string | null = null;
  try {
    const queryText = [agent?.name, agent?.system_prompt].filter(Boolean).join(' ').slice(0, 1000);
    const queryEmbedding = await Promise.race([
      generateEmbedding(queryText),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 3000)),
    ]);
    if (queryEmbedding) {
      const { data: chunks } = await admin.rpc('match_document_chunks', {
        query_embedding:  queryEmbedding as unknown as string,
        p_workspace_id:   workspace.id,
        match_threshold:  0.40,
        match_count:      6,
      });
      if (chunks && (chunks as unknown[]).length > 0) {
        const formatted = (chunks as { content: string; source_name: string; kb_name: string }[])
          .map((c, i) => `[${i + 1}] (${c.kb_name} › ${c.source_name})\n${c.content}`)
          .join('\n\n');
        ragContext = `\n\n---\nKNOWLEDGE BASE CONTEXT (use this to answer questions accurately):\n${formatted}\n---`;
      }
    }
  } catch {
    // RAG is best-effort — never block call setup
  }

  const basePrompt = sanitizePrompt(agent?.system_prompt);
  const augmentedPrompt = basePrompt
    ? `${basePrompt}${ragContext ?? ''}`
    : ragContext
      ? `You are a helpful voice assistant.${ragContext}`
      : null;

  const roomName = `agent-${agentId}-${Date.now()}`;
  const participantName = `user-${user.id.slice(0, 8)}`;

  try {
    // 8-second timeout keeps us well under Vercel's 10-second function limit
    const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret, { requestTimeout: 8 });
    await roomService.createRoom({
      name: roomName,
      metadata: JSON.stringify({
        agent_id:      agentId,
        agent_name:    agent?.name ?? 'Assistant',
        system_prompt: augmentedPrompt,
        first_message: agent?.first_message ?? null,
        voice_id:      agent?.voice_id ?? null,
        voice_emotion: agent?.voice_emotion ?? null,
        workspace_id:  workspace.id,
        transfer_number: (agent as unknown as Record<string, unknown>)?.['transfer_number'] ?? null,
        flow_json:     (agent as unknown as Record<string, unknown>)?.['flow_json'] ?? null,
        flow_config:   (agent as unknown as Record<string, unknown>)?.['flow_config'] ?? null,
        has_rag:       ragContext !== null,
        region,
      }),
      departureTimeout: 600,
    });
  } catch (err) {
    // Room creation failed — release the slot we just claimed
    void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspace.id })).catch(() => null);
    trace.end({ ok: false, error: String(err) });
    return NextResponse.json({ error: 'Call setup failed — please try again.' }, { status: 500 });
  }

  let token: string;
  try {
    const at = new AccessToken(apiKey, apiSecret, {
      identity: participantName,
      name: 'You',
      ttl: '30m',
    });
    at.addGrant({ roomJoin: true, room: roomName, canPublish: true, canSubscribe: true });
    token = await at.toJwt();
  } catch (err) {
    void Promise.resolve(admin.rpc('release_call_slot', { p_workspace_id: workspace.id })).catch(() => null);
    trace.end({ ok: false, error: String(err) });
    return NextResponse.json({ error: 'Call setup failed — please try again.' }, { status: 500 });
  }

  trace.end({ ok: true, workspace_id: workspace.id, agent_id: agentId, region });
  return NextResponse.json({ token, roomName, wsUrl, agentName: agent?.name ?? 'Assistant', region });
}
