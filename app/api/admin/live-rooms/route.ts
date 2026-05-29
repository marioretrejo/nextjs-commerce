import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { RoomServiceClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const admin = createAdminClient();
  const { data: me } = await admin.from('users').select('is_superadmin').eq('id', user.id).single();
  if (!(me as { is_superadmin: boolean } | null)?.is_superadmin) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const wsUrl = process.env['LIVEKIT_URL'] ?? '';
  const apiKey = process.env['LIVEKIT_API_KEY'];
  const apiSecret = process.env['LIVEKIT_API_SECRET'];

  if (!wsUrl || !apiKey || !apiSecret) {
    return NextResponse.json({ rooms: [] });
  }

  const httpUrl = wsUrl.replace('wss://', 'https://');
  const roomService = new RoomServiceClient(httpUrl, apiKey, apiSecret);

  try {
    const rooms = await roomService.listRooms();
    const result = rooms
      .filter((r) => r.name.startsWith('agent-') || r.name.startsWith('sip-agent-'))
      .map((r) => {
        let metadata: Record<string, unknown> = {};
        try { metadata = JSON.parse(r.metadata ?? '{}') as Record<string, unknown>; } catch { /* skip */ }
        return {
          name: r.name,
          numParticipants: r.numParticipants,
          creationTime: String(r.creationTime),
          metadata,
        };
      });
    return NextResponse.json({ rooms: result });
  } catch {
    return NextResponse.json({ rooms: [] });
  }
}
