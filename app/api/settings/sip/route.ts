/**
 * GET/POST/DELETE /api/settings/sip
 *
 * Manages the workspace's generic SIP trunk integration (Squaretalk, CommPeak,
 * Telnyx, Vonage, or any SIP/VoIP provider). Credentials are stored in the
 * `integrations` table under type='sip_trunk'.
 *
 * The stored credentials power two things:
 *  1. LiveKit Outbound SIP Egress — when a SIP trunk is active, outbound calls
 *     bypass Twilio and dial directly through the SIP provider via LiveKit's
 *     SIP gateway (see /api/calls/dial for the egress logic).
 *  2. Phone number registration — numbers belonging to this trunk are displayed
 *     in /numbers grouped under the provider name.
 */
import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

interface SipCredentials {
  provider_name: string;
  sip_host: string;
  username: string;
  password: string;
  // Populated after first outbound call — cached LiveKit trunk ID to avoid
  // recreating the trunk on every dial.
  livekit_trunk_id?: string;
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ connected: false });

  const admin = createAdminClient();
  const { data } = await admin
    .from('integrations')
    .select('id, status, credentials')
    .eq('workspace_id', ws.id)
    .eq('type', 'sip_trunk')
    .maybeSingle();

  if (!data) return NextResponse.json({ connected: false });

  const creds = data.credentials as SipCredentials | null;
  return NextResponse.json({
    connected: data.status === 'active',
    provider_name: creds?.provider_name ?? null,
    // Mask: show first 3 chars + ellipsis of username; never expose password
    username_hint: creds?.username
      ? creds.username.slice(0, 3) + '…'
      : null,
    sip_host: creds?.sip_host ?? null,
  });
}

export async function POST(req: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const body = await req.json() as {
    provider_name?: string;
    sip_host?: string;
    username?: string;
    password?: string;
  };

  if (!body.provider_name?.trim()) return NextResponse.json({ error: 'provider_name is required' }, { status: 400 });
  if (!body.sip_host?.trim())      return NextResponse.json({ error: 'sip_host is required' }, { status: 400 });
  if (!body.username?.trim())      return NextResponse.json({ error: 'username is required' }, { status: 400 });
  if (!body.password?.trim())      return NextResponse.json({ error: 'password is required' }, { status: 400 });

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const admin = createAdminClient();

  // Invalidate any cached LiveKit trunk ID so the next call regenerates it
  // with the new credentials.
  const { error } = await admin
    .from('integrations')
    .upsert(
      {
        workspace_id: ws.id,
        type: 'sip_trunk',
        status: 'active',
        credentials: {
          provider_name: body.provider_name.trim(),
          sip_host:      body.sip_host.trim(),
          username:      body.username.trim(),
          password:      body.password.trim(),
          // livekit_trunk_id intentionally omitted — reset on credential change
        } satisfies Omit<SipCredentials, 'livekit_trunk_id'>,
      },
      { onConflict: 'workspace_id,type' }
    );

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ connected: true, provider_name: body.provider_name.trim() });
}

export async function DELETE() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 });

  const admin = createAdminClient();
  await admin
    .from('integrations')
    .update({ status: 'inactive' })
    .eq('workspace_id', ws.id)
    .eq('type', 'sip_trunk');

  return NextResponse.json({ connected: false });
}
