import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Agent, Workspace } from '@/lib/supabase/types';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

// Strip the most dangerous prompt injection patterns while preserving legit content
function sanitizePrompt(raw: string | null | undefined): string | null {
  if (!raw) return null;
  return raw
    .replace(/ignore\s+(all\s+)?(previous|above|prior|prior\s+to\s+this)\s+(instructions?|prompts?|rules?|context)/gi, '[FILTERED]')
    .replace(/\b(forget|disregard|override)\s+(everything|all|prior|previous)\b/gi, '[FILTERED]')
    .replace(/you\s+are\s+now\s+(a|an|the)\s+/gi, 'You are a helpful ')
    .replace(/new\s+system\s*prompt\s*:/gi, '[FILTERED]:')
    .replace(/<\/?system>/gi, '')
    .slice(0, 4000); // cap length — room metadata is limited
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { agentId } = await req.json() as { agentId: string };

  const apiKey = process.env['LIVEKIT_API_KEY'];
  const apiSecret = process.env['LIVEKIT_API_SECRET'];
  const wsUrl = process.env['LIVEKIT_URL'];
  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
  }

  // Fetch agent config + workspace in parallel
  const admin = createAdminClient();
  const [{ data: agentRow }, { data: workspaceRow }] = await Promise.all([
    admin.from('agents').select('*').eq('id', agentId).single(),
    admin
      .from('workspaces')
      .select('id, minutes_used, minutes_limit, plan')
      .eq('owner_id', user.id)
      .single(),
  ]);

  const agent = agentRow as Agent | null;
  const workspace = workspaceRow as Pick<Workspace, 'id' | 'minutes_used' | 'minutes_limit' | 'plan'> | null;

  // Pre-call credit gate — block if workspace is out of minutes
  if (workspace && Number(workspace.minutes_used) >= Number(workspace.minutes_limit)) {
    return NextResponse.json(
      { error: 'Minute limit reached. Please upgrade your plan to continue.' },
      { status: 403 }
    );
  }

  const roomName = `agent-${agentId}-${Date.now()}`;
  const participantName = `user-${user.id.slice(0, 8)}`;

  // Create the room with sanitized agent metadata for the worker
  const roomService = new RoomServiceClient(wsUrl.replace('wss://', 'https://'), apiKey, apiSecret);
  await roomService.createRoom({
    name: roomName,
    metadata: JSON.stringify({
      agent_name: agent?.name ?? 'Assistant',
      system_prompt: sanitizePrompt(agent?.system_prompt),
      first_message: agent?.first_message ?? null,
      voice_id: agent?.voice_id ?? null,
      voice_emotion: agent?.voice_emotion ?? null,
      workspace_id: workspace?.id ?? null,
    }),
    // Auto-delete room 10 min after last participant leaves
    departureTimeout: 600,
  });

  // Mint a short-lived participant token (30 min — reduced from 1h)
  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    name: 'You',
    ttl: '30m',
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: true,
    canSubscribe: true,
  });

  const token = await at.toJwt();

  return NextResponse.json({
    token,
    roomName,
    wsUrl,
    agentName: agent?.name ?? 'Assistant',
  });
}
