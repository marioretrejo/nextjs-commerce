import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import type { Agent } from '@/lib/supabase/types';
import { AccessToken, RoomServiceClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

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

  // Fetch agent config to embed as room metadata for the worker
  const admin = createAdminClient();
  const { data: agentRow } = await admin.from('agents').select('*').eq('id', agentId).single();
  const agent = agentRow as Agent | null;

  const roomName = `agent-${agentId}-${Date.now()}`;
  const participantName = `user-${user.id.slice(0, 8)}`;

  // Create the room with agent metadata so the worker picks it up
  const roomService = new RoomServiceClient(wsUrl.replace('wss://', 'https://'), apiKey, apiSecret);
  await roomService.createRoom({
    name: roomName,
    metadata: JSON.stringify({
      agent_name: agent?.name ?? 'Assistant',
      system_prompt: agent?.system_prompt ?? null,
      first_message: agent?.first_message ?? null,
      voice_id: agent?.voice_id ?? null,
      voice_emotion: agent?.voice_emotion ?? null,
    }),
    // Auto-delete room 10 min after last participant leaves
    departureTimeout: 600,
  });

  // Mint a user token
  const at = new AccessToken(apiKey, apiSecret, {
    identity: participantName,
    name: 'You',
    ttl: '1h',
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
