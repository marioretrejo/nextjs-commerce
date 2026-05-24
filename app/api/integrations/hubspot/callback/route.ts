import { createAdminClient } from '@/lib/supabase/admin';
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const code = searchParams.get('code');
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'];

  if (!code) return NextResponse.redirect(`${appUrl}/integrations?error=no_code`);

  const clientId = process.env['HUBSPOT_CLIENT_ID'];
  const clientSecret = process.env['HUBSPOT_CLIENT_SECRET'];
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${appUrl}/integrations?error=not_configured`);
  }

  // Exchange code for tokens
  const tokenRes = await fetch('https://api.hubapi.com/oauth/v1/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'authorization_code',
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: `${appUrl}/api/integrations/hubspot/callback`,
      code,
    }),
  });

  if (!tokenRes.ok) return NextResponse.redirect(`${appUrl}/integrations?error=token_exchange_failed`);

  const tokens = await tokenRes.json() as {
    access_token: string;
    refresh_token: string;
    expires_in: number;
  };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.redirect(`${appUrl}/login`);

  const { data: ws } = await supabase.from('workspaces').select('id').eq('owner_id', user.id).single();
  if (!ws) return NextResponse.redirect(`${appUrl}/integrations?error=no_workspace`);

  const expiresAt = new Date(Date.now() + tokens.expires_in * 1000).toISOString();

  const admin = createAdminClient();
  await admin.from('integrations').upsert({
    workspace_id: ws.id,
    type: 'hubspot',
    status: 'connected',
    credentials: {
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token,
      expires_at: expiresAt,
    },
    webhook_url: null,
    webhook_events: [],
  }, { onConflict: 'workspace_id,type' });

  return NextResponse.redirect(`${appUrl}/integrations?connected=hubspot`);
}
