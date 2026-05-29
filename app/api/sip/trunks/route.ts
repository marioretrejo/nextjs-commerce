/**
 * GET  /api/sip/trunks  — list LiveKit SIP inbound trunks
 * POST /api/sip/trunks  — create a new LiveKit SIP inbound trunk
 *
 * Superadmin-only. Used by the admin settings UI to provision
 * new SIP trunks that LiveKit will accept calls on.
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
    const trunks = await sip.listSipInboundTrunk();
    return NextResponse.json({ trunks });
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
    name: string;
    numbers: string[];      // E.164 format: ["+15551234567"]
    allowedAddresses?: string[]; // optional Twilio IP allowlist
  };

  if (!body.name || !body.numbers?.length) {
    return NextResponse.json({ error: 'name and numbers are required' }, { status: 400 });
  }

  try {
    const trunk = await sip.createSipInboundTrunk(
      body.name,
      body.numbers,
      { allowedAddresses: body.allowedAddresses },
    );
    return NextResponse.json({ trunk });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
