import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { AccessToken } from 'livekit-server-sdk';
import { detectRegion, getRegionalWsUrl } from '@/lib/livekit/edge';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(
  req: Request,
  { params }: { params: Promise<{ roomName: string }> }
) {
  const { roomName } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  // Verify the room belongs to this user's workspace
  const admin = createAdminClient();
  const { data: ws } = await admin
    .from('workspaces')
    .select('id')
    .eq('owner_id', user.id)
    .single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const { data: call } = await admin
    .from('calls')
    .select('id')
    .eq('retell_call_id', roomName)
    .eq('workspace_id', (ws as { id: string }).id)
    .single();
  if (!call) return NextResponse.json({ error: 'Room not found or access denied' }, { status: 403 });

  const apiKey    = process.env['LIVEKIT_API_KEY'];
  const apiSecret = process.env['LIVEKIT_API_SECRET'];
  const region    = detectRegion(req);
  const wsUrl     = getRegionalWsUrl(region) || process.env['LIVEKIT_URL'] || '';

  if (!apiKey || !apiSecret || !wsUrl) {
    return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });
  }

  const supervisorId = `supervisor-${user.id.slice(0, 8)}-${Date.now()}`;
  const at = new AccessToken(apiKey, apiSecret, {
    identity: supervisorId,
    name: 'Supervisor',
    ttl: '2h',
  });
  // Read-only observer: subscribe to audio, no publishing, hidden from participants
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: false,
    canSubscribe: true,
    hidden: true,
  });
  const token = await at.toJwt();

  return NextResponse.json({ token, wsUrl });
}
