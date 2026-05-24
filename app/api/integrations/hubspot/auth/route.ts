import { NextResponse } from 'next/server';

export async function GET() {
  const clientId = process.env['HUBSPOT_CLIENT_ID'];
  const appUrl = process.env['NEXT_PUBLIC_APP_URL'];

  if (!clientId) {
    return NextResponse.json({ error: 'HubSpot integration not configured' }, { status: 503 });
  }

  const redirectUri = `${appUrl}/api/integrations/hubspot/callback`;
  const params = new URLSearchParams({
    client_id: clientId,
    redirect_uri: redirectUri,
    scope: 'crm.objects.contacts.write crm.objects.contacts.read timeline',
    response_type: 'code',
  });

  return NextResponse.redirect(`https://app.hubspot.com/oauth/authorize?${params.toString()}`);
}
