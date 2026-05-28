/**
 * GET  /api/sip/dispatch  — list LiveKit SIP dispatch rules
 * POST /api/sip/dispatch  — create a dispatch rule that routes
 *                           inbound SIP calls to individual rooms
 *
 * A "Individual" dispatch rule creates one room per call, using
 * the room name prefix `sip-agent-` so our worker picks it up.
 * Superadmin-only.
 */
import { createClient } from '@/lib/supabase/server';
import { createAdminClient } from '@/lib/supabase/admin';
import { SipClient } from 'livekit-server-sdk';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

function getSipClient(): SipClient | null {
  const wsUrl     = process.env['LIVEKIT_URL'] ?? '';
  const apiKey    = process.env['LIVEKIT_API_KEY'];
  const apiSecret = process.env['LIVEKIT_API_SECRET'];
  if (!wsUrl || !apiKey || !apiSecret) return null;
  const httpUrl = wsUrl.replace('wss://', 'https://');
  return new SipClient(httpUrl, apiKey, apiSecret);
}

async function requireSuperadmin() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: me } = await admin.from('users').select('is_superadmin').eq('id', user.id).single();
  return (me as { is_superadmin: boolean } | null)?.is_superadmin ? user : null;
}

export async function GET() {
  const user = await requireSuperadmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sip = getSipClient();
  if (!sip) return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });

  try {
    const rules = await sip.listSipDispatchRule();
    return NextResponse.json({ rules });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

export async function POST(req: Request) {
  const user = await requireSuperadmin();
  if (!user) return NextResponse.json({ error: 'Forbidden' }, { status: 403 });

  const sip = getSipClient();
  if (!sip) return NextResponse.json({ error: 'LiveKit not configured' }, { status: 500 });

  const body = await req.json() as {
    trunkId: string;   // SIP trunk this rule applies to
    roomPrefix?: string;  // defaults to "sip-agent-"
    pin?: string;         // optional PIN for room entry
  };

  if (!body.trunkId) {
    return NextResponse.json({ error: 'trunkId is required' }, { status: 400 });
  }

  const roomPrefix = body.roomPrefix ?? 'sip-agent-';

  try {
    const rule = await sip.createSipDispatchRule(
      { type: 'individual', roomPrefix, pin: body.pin ?? '' },
      { name: `auto-${roomPrefix}`, trunkIds: [body.trunkId] }
    );
    return NextResponse.json({ rule });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
